import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { readJson, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/auth'
import crypto from 'crypto'
import { requireEmbeddingEntity } from '@/lib/embedding-security'

// POST /api/v1/embeddings — generate embeddings for semantic search
// Phase 5: deterministic hash-based embeddings (pgvector-ready).
// In production with PostgreSQL + pgvector, this will use a real embedding model.
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:write')
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:embeddings', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const body = await readJson(req, 'embeddings')
  const { texts, entityType, entityId } = body

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: 'texts[] required' }, { status: 400 })
  }

  if (texts.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 texts per request' }, { status: 400 })
  }
  if (texts.some(text => typeof text !== 'string' || text.length > 100_000)) {
    return NextResponse.json({ error: 'texts must contain strings of at most 100000 characters' }, { status: 400 })
  }
  if ((entityType !== undefined) !== (entityId !== undefined)) {
    return NextResponse.json({ error: 'entityType and entityId must be supplied together' }, { status: 400 })
  }
  if (entityType !== undefined) await requireEmbeddingEntity(entityType, entityId, authResult.tenantId)

  // Generate deterministic embeddings (hash-based, 256 dimensions)
  // In production: replace with real embedding model (e.g., text-embedding-3-small)
  const embeddings = texts.map(text => generateDeterministicEmbedding(text))

  // Cache in database if entityType + entityId provided
  if (entityType && entityId) {
    const textHash = crypto.createHash('sha256').update(texts.join('')).digest('hex').slice(0, 16)
    await db.embedding.upsert({
      where: {
        tenantId_entityType_entityId: { tenantId: authResult.tenantId, entityType, entityId },
      },
      update: {
        embeddingJson: JSON.stringify(embeddings[0]),
        textHash,
        model: 'deterministic-v1',
      },
      create: {
        tenantId: authResult.tenantId,
        entityType,
        entityId,
        embeddingJson: JSON.stringify(embeddings[0]),
        textHash,
        model: 'deterministic-v1',
        dimensions: 256,
      },
    })
  }

  // Log usage
  await logAction({
    tenantId: authResult.tenantId ?? 'unknown',
    apiKeyId: authResult.apiKeyId,
    action: 'api_v1_embeddings',
    entityType: 'embedding',
    afterJson: { apiKeyId: authResult.apiKeyId, textCount: texts.length, dimensions: 256 },
    request: req,
  })

  const res = NextResponse.json({
    model: 'deterministic-v1',
    dimensions: 256,
    count: embeddings.length,
    data: embeddings.map((emb, i) => ({
      index: i,
      embedding: emb,
      textPreview: texts[i].slice(0, 100),
    })),
    note: 'Phase 5 uses deterministic hash-based embeddings. Production with pgvector will use cosine similarity over real model embeddings.',
  })
  setRateLimitHeaders(res, rateLimit)
  return res
})

// GET /api/v1/embeddings — semantic search using cached embeddings
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:embeddings', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const searchParams = validatedSearch(req)
  const query = searchParams.get('q')
  const entityType = searchParams.get('entityType')
  const { limit } = pagination(searchParams, 10, 50)

  if (!query) {
    return NextResponse.json({ error: 'q parameter required for semantic search' }, { status: 400 })
  }

  // Generate query embedding
  const queryEmbedding = generateDeterministicEmbedding(query)

  // Fetch cached embeddings (optionally filtered by entity type)
  const where: Prisma.EmbeddingWhereInput = { tenantId: authResult.tenantId }
  if (entityType) where.entityType = entityType

  const cached = await db.embedding.findMany({
    where,
    take: 500,
  })

  // Compute cosine similarity (deterministic — would be real similarity in prod)
  const results = cached.map(e => {
    const emb = JSON.parse(e.embeddingJson) as number[]
    const similarity = cosineSimilarity(queryEmbedding, emb)
    return {
      entityType: e.entityType,
      entityId: e.entityId,
      similarity: Math.round(similarity * 1000) / 1000,
      model: e.model,
    }
  }).sort((a, b) => b.similarity - a.similarity).slice(0, limit)

  const res = NextResponse.json({
    query,
    model: 'deterministic-v1',
    count: results.length,
    results,
  })
  setRateLimitHeaders(res, rateLimit)
  return res
})

// ============================================================
// Deterministic embedding generation (dev fallback for pgvector)
// ============================================================

function generateDeterministicEmbedding(text: string, dimensions: number = 256): number[] {
  // Create a deterministic embedding by hashing tokens and projecting to dimensions
  const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 1)
  const embedding = new Array(dimensions).fill(0)

  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest()
    for (let i = 0; i < dimensions; i++) {
      embedding[i] += (hash[i % 32] / 255 - 0.5) * 0.1
    }
  }

  // Normalize to unit vector
  const norm = Math.sqrt(embedding.reduce((acc, v) => acc + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= norm
    }
  }

  // Round to 6 decimal places for storage efficiency
  return embedding.map(v => Math.round(v * 1e6) / 1e6)
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dot / denom : 0
}

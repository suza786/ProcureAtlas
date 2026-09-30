import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/extractions — list LLM extractions for review queue
export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const reviewStatus = searchParams.get('reviewStatus') ?? 'pending'
  const tenderId = searchParams.get('tenderId')

  const where: Record<string, unknown> = { tenantId: ctx.tenantId }
  if (reviewStatus !== 'all') where.reviewStatus = reviewStatus
  if (tenderId) where.tenderId = tenderId

  const items = await db.llmExtraction.findMany({
    where,
    include: {
      tender: { select: { id: true, title: true, market: true } },
      requestedBy: { select: { email: true, name: true } },
      reviewedBy: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      taskType: e.taskType,
      status: e.status,
      reviewStatus: e.reviewStatus,
      model: e.model,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      latencyMs: e.latencyMs,
      costUsd: e.costUsd,
      errorMessage: e.errorMessage,
      items: e.extractedItemsJson ? JSON.parse(e.extractedItemsJson) : [],
      tender: e.tender,
      requestedBy: e.requestedBy,
      reviewedBy: e.reviewedBy,
      reviewedAt: e.reviewedAt,
      reviewNotes: e.reviewNotes,
      createdAt: e.createdAt,
    })),
  })
}

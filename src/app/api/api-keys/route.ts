import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// GET /api/api-keys — list API keys for the tenant
export async function GET() {
  const ctx = await getCurrentTenant()
  const keys = await db.apiKey.findMany({
    where: { tenantId: ctx.tenantId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    items: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes.split(' '),
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    })),
  })
}

// POST /api/api-keys — create a new API key
// Returns the full key ONCE — only the hash is stored.
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { name, scopes, expiresAt } = body as {
    name: string
    scopes: string[]
    expiresAt?: string
  }

  if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'name and scopes[] required' }, { status: 400 })
  }

  const validScopes = ['mcp:read', 'api:read', 'api:write']
  const invalidScopes = scopes.filter((s) => !validScopes.includes(s))
  if (invalidScopes.length > 0) {
    return NextResponse.json({ error: `Invalid scopes: ${invalidScopes.join(', ')}. Valid: ${validScopes.join(', ')}` }, { status: 400 })
  }

  // Generate key: pak_<random>
  const rawKey = 'pak_' + crypto.randomBytes(24).toString('hex')
  const keyPrefix = rawKey.slice(0, 12)
  const keyHash = bcrypt.hashSync(rawKey, 10)

  const apiKey = await db.apiKey.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      name,
      keyPrefix,
      keyHash,
      scopes: scopes.join(' '),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'api_key_created',
    entityType: 'api_key',
    entityId: apiKey.id,
    afterJson: { name, scopes, keyPrefix },
    request: req,
  })

  return NextResponse.json({
    id: apiKey.id,
    name,
    key: rawKey, // returned ONCE — caller must store securely
    keyPrefix,
    scopes,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    warning: 'Store this key securely. It will not be shown again.',
  }, { status: 201 })
}

// DELETE /api/api-keys — revoke an API key
export async function DELETE(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  await db.apiKey.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { revokedAt: new Date() },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'api_key_revoked',
    entityType: 'api_key',
    entityId: id,
    request: req,
  })

  return NextResponse.json({ success: true })
}

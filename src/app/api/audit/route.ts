import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit — audit log for the current tenant (admin+ only in production; demo allows all)
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('admin')
  const searchParams = validatedSearch(req)
  const { limit } = pagination(searchParams, 50, 100)
  const { offset } = pagination(searchParams)
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')

  const where: Prisma.AuditLogWhereInput = { tenantId: ctx.tenantId }
  if (action) where.action = { contains: action }
  if (entityType) where.entityType = entityType

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ])

  return NextResponse.json({
    total,
    limit,
    offset,
    items: items.map((a) => ({
      id: a.id,
      action: a.action,
      actorType: a.actorType,
      apiKeyId: a.apiKeyId,
      entityType: a.entityType,
      entityId: a.entityId,
      user: a.user ? { email: a.user.email, name: a.user.name } : null,
      ipHash: a.ipHash,
      userAgent: a.userAgent,
      llmModel: a.llmModel,
      llmInputTokens: a.llmInputTokens,
      llmOutputTokens: a.llmOutputTokens,
      llmLatencyMs: a.llmLatencyMs,
      llmCostUsd: a.llmCostUsd,
      before: a.beforeJson ? JSON.parse(a.beforeJson) : null,
      after: a.afterJson ? JSON.parse(a.afterJson) : null,
      createdAt: a.createdAt,
    })),
  })
})

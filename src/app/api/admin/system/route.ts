import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/admin/system — system health overview for tenant admins
export async function GET() {
  const ctx = await getCurrentTenant()

  const [userCount, pursuitCount, tenderCount, alertCount, auditCount, extractionCount, uploadCount, connectorRuns, apiKeyCount] = await Promise.all([
    db.user.count({ where: { tenantId: ctx.tenantId } }),
    db.pursuit.count({ where: { tenantId: ctx.tenantId } }),
    db.tender.count(),
    db.alert.count({ where: { tenantId: ctx.tenantId, acknowledgedAt: null } }),
    db.auditLog.count({ where: { tenantId: ctx.tenantId } }),
    db.llmExtraction.count({ where: { tenantId: ctx.tenantId } }),
    db.fileUpload.count({ where: { tenantId: ctx.tenantId } }),
    db.connectorRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { id: true, sourceCode: true, status: true, startedAt: true, completedAt: true, itemsFetched: true, itemsCreated: true, errorMessage: true },
    }),
    db.apiKey.count({ where: { tenantId: ctx.tenantId, revokedAt: null } }),
  ])

  // LLM usage stats (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const llmStats = await db.auditLog.aggregate({
    where: {
      tenantId: ctx.tenantId,
      action: 'llm_call_success',
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { llmInputTokens: true, llmOutputTokens: true, llmCostUsd: true },
    _count: true,
  })

  // Storage usage
  const storageUsage = await db.fileUpload.aggregate({
    where: { tenantId: ctx.tenantId },
    _sum: { fileSizeKb: true },
  })

  return NextResponse.json({
    tenant: { id: ctx.tenantId, slug: ctx.tenantSlug },
    stats: {
      users: userCount,
      pursuits: pursuitCount,
      tenders: tenderCount,
      activeAlerts: alertCount,
      auditEntries: auditCount,
      llmExtractions: extractionCount,
      fileUploads: uploadCount,
      apiKeys: apiKeyCount,
    },
    llmUsage: {
      callsLast30Days: llmStats._count,
      inputTokens: llmStats._sum.llmInputTokens ?? 0,
      outputTokens: llmStats._sum.llmOutputTokens ?? 0,
      costUsd: llmStats._sum.llmCostUsd ?? 0,
    },
    storage: {
      totalKb: storageUsage._sum.fileSizeKb ?? 0,
      totalMb: Math.round((storageUsage._sum.fileSizeKb ?? 0) / 1024 * 100) / 100,
    },
    recentConnectorRuns: connectorRuns,
  })
}

import { readJson, pagination, validatedSearch } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/auth'
import { persistExport, removeExportArtifact } from '@/lib/export-storage'
import { exportRecords } from '@/lib/export-records'

export const runtime = 'nodejs'

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  const { limit: pageSize, offset } = pagination(validatedSearch(req), 20, 100)
  const limit = await checkRateLimit(authResult.identifier!, 'api:v1:exports', authResult.tier)
  const items = limit.allowed ? await db.dataExport.findMany({ where: { tenantId: authResult.tenantId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize + 1, skip: offset }) : []
  const res = limit.allowed ? NextResponse.json({ count: Math.min(items.length, pageSize), items: items.slice(0, pageSize), limit: pageSize, offset, hasMore: items.length > pageSize }) : NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  setRateLimitHeaders(res, limit)
  return res
})

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:write')
  const limit = await checkRateLimit(authResult.identifier!, 'api:v1:exports', authResult.tier)
  if (!limit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, limit)
    return res
  }
  const { exportType, format = 'json' } = await readJson(req, 'export')
  const job = await db.dataExport.create({ data: { tenantId: authResult.tenantId, requestedByApiKeyId: authResult.apiKeyId, exportType, format, status: 'processing' } })
  try {
    const { recordCount, fileSizeKb } = await persistExport(job.id, format, exportRecords(exportType, authResult.tenantId))
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const downloadUrl = `/api/v1/exports/${encodeURIComponent(job.id)}/download`
    await logAction({ tenantId: authResult.tenantId, apiKeyId: authResult.apiKeyId, action: 'api_v1_export_created', entityType: 'data_export', entityId: job.id, afterJson: { exportType, format, recordCount, fileSizeKb }, request: req })
    await db.dataExport.update({ where: { id: job.id }, data: { status: 'completed', recordCount, fileSizeKb, completedAt: new Date(), expiresAt, downloadUrl } })
    const res = NextResponse.json({ id: job.id, exportType, format, status: 'completed', recordCount, fileSizeKb, expiresAt: expiresAt.toISOString(), downloadUrl }, { status: 201 })
    setRateLimitHeaders(res, limit)
    return res
  } catch (error) {
    await removeExportArtifact(job.id)
    await db.dataExport.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: (error instanceof Error ? error.message : 'Export failed').slice(0, 2000), downloadUrl: null } })
    const res = NextResponse.json({ error: 'Export failed', id: job.id }, { status: 500 })
    setRateLimitHeaders(res, limit)
    return res
  }
})

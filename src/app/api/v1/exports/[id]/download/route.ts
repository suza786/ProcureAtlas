import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'
import { exportDownloadStatus, openExportArtifact } from '@/lib/export-storage'

export const runtime = 'nodejs'

export const GET = withApiErrors(async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  const limit = await checkRateLimit(authResult.identifier!, 'api:v1:exports:download', authResult.tier)
  if (!limit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, limit)
    return res
  }
  const { id } = await context.params
  const job = await db.dataExport.findFirst({ where: { id, tenantId: authResult.tenantId } })
  const status = exportDownloadStatus(job, authResult.tenantId)
  if (status !== 200 || !job) return NextResponse.json({ error: status === 410 ? 'Export expired' : status === 409 ? 'Export is not completed' : 'Export not found' }, { status })
  let artifact
  try { artifact = await openExportArtifact(id) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return NextResponse.json({ error: 'Export artifact unavailable' }, { status: 410 })
    throw error
  }
  const res = new NextResponse(artifact.stream, { headers: { 'Content-Type': job.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="export.${job.format === 'csv' ? 'csv' : 'json'}"`, 'Content-Length': String(artifact.bytes), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  setRateLimitHeaders(res, limit)
  return res
})

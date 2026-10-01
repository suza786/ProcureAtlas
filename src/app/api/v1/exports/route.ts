import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/auth'

// POST /api/v1/exports — create a data export job
// GET /api/v1/exports — list export jobs
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid || !authResult.tenantId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:exports', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const exports = await db.dataExport.findMany({
    where: { tenantId: authResult.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const res = NextResponse.json({ count: exports.length, items: exports })
  setRateLimitHeaders(res, rateLimit)
  return res
}

export async function POST(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid || !authResult.tenantId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:exports', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const body = await req.json()
  const { exportType, format } = body as { exportType: string; format?: string }

  if (!exportType || !['tenders', 'pursuits', 'evidence', 'audit_log', 'full_backup', 'awards'].includes(exportType)) {
    return NextResponse.json({ error: 'Invalid exportType' }, { status: 400 })
  }

  // Create export job
  const exportJob = await db.dataExport.create({
    data: {
      tenantId: authResult.tenantId,
      requestedById: authResult.apiKeyId,
      exportType,
      format: format ?? 'json',
      status: 'processing',
    },
  })

  // Process export synchronously (in production this would be async)
  try {
    let data: unknown[] = []
    let recordCount = 0

    switch (exportType) {
      case 'tenders': {
        data = await db.tender.findMany({
          where: { status: 'active' },
          select: { id: true, title: true, market: true, sector: true, country: true, valueUSD: true, submissionDeadline: true, status: true, sourcePortal: true, sourceUrl: true },
          take: 1000,
        })
        break
      }
      case 'pursuits': {
        data = await db.pursuit.findMany({
          where: { tenantId: authResult.tenantId },
          include: { tender: { select: { title: true } } },
        })
        break
      }
      case 'evidence': {
        const company = await db.company.findFirst({ where: { tenantId: authResult.tenantId } })
        if (company) {
          data = await db.evidence.findMany({ where: { companyId: company.id } })
        }
        break
      }
      case 'audit_log': {
        data = await db.auditLog.findMany({
          where: { tenantId: authResult.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        })
        break
      }
      case 'awards': {
        data = await db.award.findMany({
          include: { supplier: { select: { name: true } }, tender: { select: { title: true } } },
          take: 1000,
        })
        break
      }
      case 'full_backup': {
        const [pursuits, evidence, auditLogs, proposals] = await Promise.all([
          db.pursuit.findMany({ where: { tenantId: authResult.tenantId } }),
          db.company.findFirst({ where: { tenantId: authResult.tenantId }, include: { evidence: true, certifications: true } }),
          db.auditLog.findMany({ where: { tenantId: authResult.tenantId }, take: 500 }),
          db.proposal.findMany({ where: { tenantId: authResult.tenantId } }),
        ])
        data = [{ pursuits, company: evidence, auditLogs, proposals }]
        break
      }
    }

    recordCount = data.length
    const payload = format === 'csv' ? convertToCsv(data) : JSON.stringify(data, null, 2)
    const fileSizeKb = Math.ceil(payload.length / 1024)

    await db.dataExport.update({
      where: { id: exportJob.id },
      data: {
        status: 'completed',
        recordCount,
        fileSizeKb,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
      },
    })

    await logAction({
      tenantId: authResult.tenantId!,
      userId: authResult.apiKeyId,
      action: 'api_v1_export_created',
      entityType: 'data_export',
      entityId: exportJob.id,
      afterJson: { exportType, format, recordCount, fileSizeKb },
      request: req,
    })

    const res = NextResponse.json({
      id: exportJob.id,
      exportType,
      format: format ?? 'json',
      status: 'completed',
      recordCount,
      fileSizeKb,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      downloadUrl: `/api/v1/exports?id=${exportJob.id}`,
      data: format === 'csv' ? undefined : data,
      csvData: format === 'csv' ? payload : undefined,
    })
    setRateLimitHeaders(res, rateLimit)
    return res

  } catch (e) {
    await db.dataExport.update({
      where: { id: exportJob.id },
      data: {
        status: 'failed',
        errorMessage: (e as Error).message.slice(0, 2000),
      },
    })

    return NextResponse.json({ error: 'Export failed', message: (e as Error).message }, { status: 500 })
  }
}

function convertToCsv(data: unknown[]): string {
  if (data.length === 0) return ''
  const first = data[0] as Record<string, unknown>
  const headers = Object.keys(first)
  const rows = data.map(item => {
    const obj = item as Record<string, unknown>
    return headers.map(h => {
      const val = obj[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""')
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

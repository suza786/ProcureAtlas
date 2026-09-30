import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// POST /api/company/evidence — create a new evidence record (optionally linked to a file upload)
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()

  const {
    category,
    title,
    description,
    issuer,
    issuedAt,
    expiresAt,
    fileUploadId,
  } = body as {
    category: string
    title: string
    description?: string
    issuer?: string
    issuedAt?: string
    expiresAt?: string
    fileUploadId?: string
  }

  if (!category || !title) {
    return NextResponse.json({ error: 'category and title required' }, { status: 400 })
  }

  const company = await db.company.findFirst({ where: { tenantId: ctx.tenantId } })
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const evidence = await db.evidence.create({
    data: {
      companyId: company.id,
      category,
      title,
      description: description ?? null,
      issuer: issuer ?? null,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      verified: false, // always starts unverified; admin must verify
      confidence: 0.7, // default for user-submitted evidence
    },
  })

  // Link file upload if provided
  if (fileUploadId) {
    const upload = await db.fileUpload.findFirst({
      where: { id: fileUploadId, tenantId: ctx.tenantId },
    })
    if (upload) {
      await db.fileUpload.update({
        where: { id: upload.id },
        data: { evidenceId: evidence.id },
      })
    }
  }

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'evidence_created',
    entityType: 'evidence',
    entityId: evidence.id,
    afterJson: { category, title, issuer, fileUploadId },
    request: req,
  })

  return NextResponse.json({
    id: evidence.id,
    category: evidence.category,
    title: evidence.title,
    issuer: evidence.issuer,
    issuedAt: evidence.issuedAt,
    expiresAt: evidence.expiresAt,
    verified: evidence.verified,
    createdAt: evidence.createdAt,
  }, { status: 201 })
}

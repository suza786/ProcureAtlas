import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/auth'

// POST /api/company/evidence — create a new evidence record (optionally linked to a file upload)
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'evidence')

  const {
    category,
    title,
    description,
    issuer,
    issuedAt,
    expiresAt,
    fileUploadId,
  } = body

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
      factMetric: body.factMetric,
      factAmount: body.factAmount,
      factCurrency: body.factCurrency,
      factUnit: body.factUnit,
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
})

// Managers verify the source and structured facts; contributors cannot self-verify.
export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('manager')
  const input = await readJson(req, 'evidenceReview')
  const evidence = await db.$transaction(async tx => {
    const existing = await tx.evidence.findFirst({ where: { id: input.id, company: { tenantId: ctx.tenantId } } })
    if (!existing) throw new Response('Evidence not found', { status: 404 })
    const updated = await tx.evidence.update({ where: { id: input.id }, data: {
      verified: input.verified, verifiedBy: ctx.userId, verifiedAt: input.verified ? new Date() : null,
      factMetric: input.factMetric, factAmount: input.factAmount, factCurrency: input.factCurrency, factUnit: input.factUnit,
    } })
    const pursuits = await tx.pursuit.findMany({ where: { tenantId: ctx.tenantId, companyId: existing.companyId, stage: { notIn: ['submitted','won','lost'] } }, select: { id: true } })
    const pursuitIds = pursuits.map(row => row.id)
    await tx.approval.updateMany({ where: { tenantId: ctx.tenantId, pursuitId: { in: pursuitIds }, triggerType: { in: ['submission','pricing','legal'] } }, data: { decision: 'pending', decidedAt: null, reason: null } })
    await tx.proposal.updateMany({ where: { tenantId: ctx.tenantId, pursuitId: { in: pursuitIds }, status: { notIn: ['submitted','withdrawn'] } }, data: { status: 'draft', revision: { increment: 1 } } })
    await tx.bid.updateMany({ where: { pursuitId: { in: pursuitIds } }, data: { status: 'draft', submissionReady: false } })
    return updated
  })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'evidence_reviewed', entityType: 'evidence', entityId: input.id, afterJson: { verified: input.verified }, request: req })
  return NextResponse.json(evidence)
})

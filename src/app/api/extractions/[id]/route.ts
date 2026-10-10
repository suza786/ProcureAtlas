import { bodySchemas, readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/auth'

// PATCH /api/extractions/[id] — approve / reject / edit an LLM extraction
// Approved items remain private tenant annotations; canonical requirements are trusted ingestion data.
export const PATCH = withApiErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('manager')
  const body = await readJson(req, 'extraction')
  const { decision, notes, editedItems } = body

  if (!['approved', 'rejected', 'edited'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const result = await db.$transaction(async tx => {
    const extraction = await tx.llmExtraction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { tender: true },
    })

    if (!extraction) {
      throw NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    if (extraction.reviewStatus !== 'pending') {
      if (decision === 'approved' && extraction.reviewStatus === 'approved') {
        return { replay: true, createdCount: 0, tenderId: extraction.tenderId }
      }
      throw NextResponse.json({ error: 'Extraction has already been reviewed' }, { status: 409 })
    }
    const approving = decision === 'approved' || decision === 'edited'
    if (!['completed', 'needs_review'].includes(extraction.status) ||
        (approving && (!extraction.tenderId || extraction.taskType !== 'requirement_extraction'))) {
      throw NextResponse.json({ error: 'Extraction is not ready for this review' }, { status: 400 })
    }
    const parsed = approving ? bodySchemas.extraction.safeParse({ decision: 'edited', editedItems: editedItems ?? JSON.parse(extraction.extractedItemsJson ?? '[]') }) : null
    if (parsed && !parsed.success) throw NextResponse.json({ error: 'Invalid reviewed requirement items' }, { status: 400 })
    const items = parsed?.success ? parsed.data.editedItems!.map(item => ({ ...item,
      thresholdStatus: item.evaluationMetric && item.thresholdAmount !== undefined && item.thresholdUnit &&
        item.operator && ['>=', '<=', '==', '>', '<'].includes(item.operator) &&
        (item.thresholdUnit !== 'money' || item.thresholdCurrency) ? 'reviewed' : 'unreviewed',
    })) : null
    const itemsJson = items !== null ? JSON.stringify(items) : null
    const createdCount = items?.length ?? 0
    const claimed = await tx.llmExtraction.updateMany({
      where: { id, tenantId: ctx.tenantId, reviewStatus: 'pending', status: { in: ['completed', 'needs_review'] },
        ...(approving ? { taskType: 'requirement_extraction', tenderId: extraction.tenderId } : {}) },
      data: { reviewStatus: decision, reviewedById: ctx.userId, reviewedAt: new Date(), reviewNotes: notes ?? null,
        ...(itemsJson !== null ? { extractedItemsJson: itemsJson } : {}) },
    })
    if (claimed.count !== 1) {
      const current = await tx.llmExtraction.findFirst({ where: { id, tenantId: ctx.tenantId } })
      if (decision === 'approved' && current?.reviewStatus === 'approved') {
        return { replay: true, createdCount: 0, tenderId: current.tenderId }
      }
      throw NextResponse.json({ error: 'Extraction review changed; retry the request' }, { status: 409 })
    }
    if (itemsJson !== null) {
      await tx.tenantRequirementReview.create({
        data: { tenantId: ctx.tenantId, extractionId: id, tenderId: extraction.tenderId!, itemsJson },
      })
    } else {
      await tx.tenantRequirementReview.deleteMany({ where: { extractionId: id, tenantId: ctx.tenantId } })
    }
    return { replay: false, createdCount, tenderId: extraction.tenderId }
  })

  if (!result.replay) await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: `extraction_${decision}`,
    entityType: 'llm_extraction',
    entityId: id,
    afterJson: { createdRequirements: result.createdCount, tenderId: result.tenderId },
    request: req,
  })

  return NextResponse.json({
    success: true,
    decision,
    requirementsCreated: result.createdCount,
    ...(result.replay ? { idempotent: true } : {}),
    scope: 'tenant_private',
  })
})

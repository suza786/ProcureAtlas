import { parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractRequirements } from '@/lib/llm'
import { logAction } from '@/lib/auth'

// POST /api/tenders/[id]/extract-requirements
// Triggers LLM extraction of requirements from the tender description.
// Output is saved as an LlmExtraction record with reviewStatus=pending.
// Human approval stores tenant-private reviewed annotations; canonical Requirement rows are unchanged.
export const POST = withApiErrors(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')

  const tender = await db.tender.findUnique({
    where: { id },
    include: { requirements: true },
  })

  if (!tender) {
    return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
  }

  // Build the input text from tender description + existing requirements context
  const tenderText = [
    `Title: ${tender.title}`,
    tender.titleLocal ? `Local title: ${tender.titleLocal}` : '',
    `Country: ${tender.country}`,
    `Market: ${tender.market}`,
    `Sector: ${tender.sector}`,
    `Procurement method: ${tender.procurementMethod ?? 'unknown'}`,
    `Estimated value: ${tender.estimatedValue} ${tender.currency}`,
    tender.submissionDeadline ? `Submission deadline: ${tender.submissionDeadline.toISOString()}` : '',
    tender.bidValidityDays ? `Bid validity: ${tender.bidValidityDays} days` : '',
    tender.tenderSecurityPct ? `Tender security: ${tender.tenderSecurityPct}%` : '',
    tender.performanceSecurityPct ? `Performance security: ${tender.performanceSecurityPct}%` : '',
    '',
    'DESCRIPTION:',
    tender.description ?? '(no description available)',
  ].filter(Boolean).join('\n')

  // Call the LLM
  const result = await extractRequirements({
    tenderTitle: tender.title,
    tenderDescription: tender.description ?? '',
    tenderText,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    request: req,
  })

  // Persist the LlmExtraction record regardless of success/failure (for audit + review queue)
  const extraction = await db.llmExtraction.create({
    data: {
      tenantId: ctx.tenantId,
      tenderId: tender.id,
      requestedById: ctx.userId,
      taskType: 'requirement_extraction',
      status: result.success ? 'completed' : 'failed',
      reviewStatus: result.success ? 'pending' : 'rejected',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
      promptHash: result.promptHash,
      outputJson: result.success ? JSON.stringify(result.data) : null,
      extractedItemsJson: result.success && result.data ? JSON.stringify(result.data.items) : null,
      errorMessage: result.error,
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'llm_extraction_triggered',
    entityType: 'tender',
    entityId: tender.id,
    afterJson: { extractionId: extraction.id, success: result.success, itemCount: result.data?.items.length ?? 0 },
    request: req,
  })

  return NextResponse.json({
    extractionId: extraction.id,
    success: result.success,
    needsReview: result.needsReview,
    error: result.error,
    items: result.data?.items ?? [],
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    costUsd: result.costUsd,
    note: result.success
      ? 'Extraction complete. Items are pending human review — nothing has been written to the Requirement table.'
      : 'Extraction failed. Manual review required.',
  })
})

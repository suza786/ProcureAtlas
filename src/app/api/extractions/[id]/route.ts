import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// PATCH /api/extractions/[id] — approve / reject / edit an LLM extraction
// When approved, the extracted items are written to the Requirement table.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { decision, notes, editedItems } = body as {
    decision: 'approved' | 'rejected' | 'edited'
    notes?: string
    editedItems?: Array<{
      category: string
      criterion: string
      operator: string | null
      threshold: string | null
      isMandatory: boolean
      sourceSnippet: string
      confidence: number
    }>
  }

  if (!['approved', 'rejected', 'edited'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const extraction = await db.llmExtraction.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { tender: true },
  })

  if (!extraction) {
    return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
  }

  // Update the extraction record
  await db.llmExtraction.update({
    where: { id },
    data: {
      reviewStatus: decision,
      reviewedById: ctx.userId,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
      extractedItemsJson: editedItems ? JSON.stringify(editedItems) : extraction.extractedItemsJson,
    },
  })

  // If approved, write items to the Requirement table
  let createdCount = 0
  if (decision === 'approved' || decision === 'edited') {
    const items = editedItems ?? (extraction.extractedItemsJson ? JSON.parse(extraction.extractedItemsJson) : [])
    for (const item of items) {
      await db.requirement.create({
        data: {
          tenderId: extraction.tenderId!,
          category: item.category,
          criterion: item.criterion,
          operator: item.operator,
          threshold: item.threshold,
          description: item.sourceSnippet,
          isMandatory: item.isMandatory,
          sourceDoc: `LLM extraction ${extraction.id.slice(-8)}`,
          sourcePage: null,
          sourceClause: null,
          extractedText: item.sourceSnippet,
          confidence: item.confidence,
        },
      })
      createdCount++
    }
  }

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: `extraction_${decision}`,
    entityType: 'llm_extraction',
    entityId: id,
    afterJson: { createdRequirements: createdCount, tenderId: extraction.tenderId },
    request: req,
  })

  return NextResponse.json({
    success: true,
    decision,
    requirementsCreated: createdCount,
  })
}

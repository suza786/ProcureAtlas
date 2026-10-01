import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// PATCH /api/proposals/[id]/sections/[sectionId] — update section content
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { id, sectionId } = await params
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { content, status, evidenceIds, assignedTo } = body as {
    content?: string
    status?: string
    evidenceIds?: string[]
    assignedTo?: string
  }

  // Verify proposal belongs to tenant
  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const section = await db.proposalSection.findUnique({
    where: { id: sectionId, proposalId: id },
  })
  if (!section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    lastEditedAt: new Date(),
    lastEditedBy: ctx.userId,
  }
  if (content !== undefined) {
    updates.content = content
    updates.wordCount = content.trim().split(/\s+/).filter(Boolean).length
  }
  if (status) updates.status = status
  if (assignedTo) updates.assignedTo = assignedTo
  if (evidenceIds) {
    updates.evidenceIds = JSON.stringify(evidenceIds)
    updates.evidenceCount = evidenceIds.length
    updates.hasGaps = false // when evidence is linked, gaps are addressed
  }

  const updated = await db.proposalSection.update({
    where: { id: sectionId },
    data: updates,
  })

  // Recompute proposal-level stats
  const allSections = await db.proposalSection.findMany({
    where: { proposalId: id },
    select: { status: true, wordCount: true, evidenceCount: true, hasGaps: true },
  })
  const totalWordCount = allSections.reduce((acc, s) => acc + s.wordCount, 0)
  const completedSections = allSections.filter(s => s.status === 'approved' || s.status === 'in_review').length
  const sectionsWithEvidence = allSections.filter(s => s.evidenceCount > 0).length
  const evidenceCoverage = allSections.length > 0 ? sectionsWithEvidence / allSections.length : 0

  await db.proposal.update({
    where: { id },
    data: {
      wordCount: totalWordCount,
      completedSections,
      evidenceCoverage,
      lastEditedAt: new Date(),
      lastEditedBy: ctx.userId,
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_section_updated',
    entityType: 'proposal_section',
    entityId: sectionId,
    afterJson: { status, wordCount: updates.wordCount, evidenceCount: updates.evidenceCount },
    request: req,
  })

  return NextResponse.json(updated)
}

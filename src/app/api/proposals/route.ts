import { createSubmissionApprovals } from '@/lib/approval-workflow'
import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/proposals — list proposals for the current tenant
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const pursuitId = searchParams.get('pursuitId')
  const status = searchParams.get('status')

  const where: Prisma.ProposalWhereInput = { tenantId: ctx.tenantId }
  if (pursuitId) where.pursuitId = pursuitId
  if (status) where.status = status

  const proposals = await db.proposal.findMany({
    where,
    include: {
      pursuit: { include: { tender: { select: { title: true, market: true, sector: true, submissionDeadline: true, valueUSD: true } } } },
      sections: { select: { id: true, status: true, sectionType: true, title: true, wordCount: true, evidenceCount: true, hasGaps: true } },
      _count: { select: { versions: true, approvals: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({
    items: proposals.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      currentVersion: p.currentVersion,
      totalSections: p.totalSections,
      completedSections: p.completedSections,
      evidenceCoverage: p.evidenceCoverage,
      wordCount: p.wordCount,
      lastEditedAt: p.lastEditedAt,
      lastEditedBy: p.lastEditedBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      pursuit: {
        id: p.pursuit.id,
        stage: p.pursuit.stage,
        tender: p.pursuit.tender,
      },
      sections: p.sections,
      versionCount: p._count.versions,
      approvalCount: p._count.approvals,
    })),
  })
})

// POST /api/proposals — create a new proposal
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'proposalCreate')
  const { pursuitId, title } = body

  if (!pursuitId || !title) {
    return NextResponse.json({ error: 'pursuitId and title required' }, { status: 400 })
  }

  // Verify pursuit belongs to tenant
  const pursuit = await db.pursuit.findFirst({
    where: { id: pursuitId, tenantId: ctx.tenantId },
  })
  if (!pursuit) {
    return NextResponse.json({ error: 'Pursuit not found' }, { status: 404 })
  }

  // Create proposal with default sections
  const defaultSections = [
    { sectionType: 'executive_summary', title: 'Executive Summary', order: 1 },
    { sectionType: 'technical_approach', title: 'Technical Approach', order: 2 },
    { sectionType: 'methodology', title: 'Methodology', order: 3 },
    { sectionType: 'team', title: 'Team & Key Personnel', order: 4 },
    { sectionType: 'past_performance', title: 'Past Performance', order: 5 },
    { sectionType: 'pricing', title: 'Pricing', order: 6 },
    { sectionType: 'compliance', title: 'Compliance Matrix', order: 7 },
    { sectionType: 'risk', title: 'Risk Management', order: 8 },
    { sectionType: 'timeline', title: 'Timeline & Milestones', order: 9 },
  ]

  const proposal = await db.$transaction(async tx => {
  const currentPursuit = await tx.pursuit.findFirst({ where: { id: pursuitId, tenantId: ctx.tenantId } })
  if (!currentPursuit || ['submitted','won','lost','no_bid'].includes(currentPursuit.stage)) throw new Response('Pursuit unavailable for proposals', { status: 409 })
  const proposal = await tx.proposal.create({
    data: {
      tenantId: ctx.tenantId,
      pursuitId,
      title,
      currentVersion: 0,
      totalSections: defaultSections.length,
      lastEditedAt: new Date(),
      lastEditedBy: ctx.userId,
      sections: {
        create: defaultSections,
      },
    },
    include: { sections: true },
  })

    await createSubmissionApprovals(tx, ctx.tenantId, pursuitId, proposal.id, ctx.userId)
    return proposal
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_created',
    entityType: 'proposal',
    entityId: proposal.id,
    afterJson: { title, pursuitId, sectionCount: defaultSections.length },
    request: req,
  })

  return NextResponse.json(proposal, { status: 201 })
})

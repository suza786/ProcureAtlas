import { transitionProposal } from '@/lib/proposal-workflow'
import { readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/proposals/[id] — full proposal with sections + versions
export const GET = withApiErrors(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const ctx = await getCurrentTenant()

  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      pursuit: {
        include: {
          tender: { select: { title: true, market: true, sector: true, submissionDeadline: true, valueUSD: true, requirements: { select: { id: true, criterion: true, category: true, isMandatory: true } } } },
          company: { select: { name: true, country: true, description: true } },
        },
      },
      sections: { orderBy: { order: 'asc' } },
      versions: { orderBy: { versionNumber: 'desc' }, take: 10 },
      approvals: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  return NextResponse.json(proposal)
})

// PATCH /api/proposals/[id] — update proposal status
export const PATCH = withApiErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'proposalUpdate')
  const { status, title } = body

  const updated = await transitionProposal(ctx, id, body)

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_updated',
    entityType: 'proposal',
    entityId: id,
    afterJson: { status, title },
    request: req,
  })

  return NextResponse.json(updated)
})

// DELETE /api/proposals/[id]
export const DELETE = withApiErrors(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')

  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  if (['submitted','approved'].includes(proposal.status)) throw new Response('Approved or submitted proposals must be retained', { status: 409 })
  await db.$transaction(async tx => {
    const current = await tx.proposal.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!current || ['submitted','approved'].includes(current.status)) throw new Response('Proposal changed; reload before deleting', { status: 409 })
    await tx.proposal.delete({ where: { id } })
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_deleted',
    entityType: 'proposal',
    entityId: id,
    request: req,
  })

  return NextResponse.json({ success: true })
})

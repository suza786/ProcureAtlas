import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/proposals/[id] — full proposal with sections + versions
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
}

// PATCH /api/proposals/[id] — update proposal status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { status, title } = body as { status?: string; title?: string }

  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (title) updates.title = title
  updates.lastEditedAt = new Date()
  updates.lastEditedBy = ctx.userId

  if (status === 'submitted') {
    updates.submittedAt = new Date()
  }

  const updated = await db.proposal.update({
    where: { id },
    data: updates,
  })

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
}

// DELETE /api/proposals/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()

  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  await db.proposal.delete({ where: { id } })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_deleted',
    entityType: 'proposal',
    entityId: id,
    request: req,
  })

  return NextResponse.json({ success: true })
}

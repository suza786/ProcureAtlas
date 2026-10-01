import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// PATCH /api/approvals/[id] — approve / reject / request changes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { decision, reason } = body as { decision: string; reason?: string }

  if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const approval = await db.approval.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!approval) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
  }

  const updated = await db.approval.update({
    where: { id },
    data: {
      decision,
      reason: reason ?? null,
      decidedAt: new Date(),
      approverId: ctx.userId,
    },
  })

  // If approved and this is a submission trigger, update pursuit stage
  if (decision === 'approved' && approval.triggerType === 'submission') {
    await db.pursuit.update({
      where: { id: approval.pursuitId },
      data: { stage: 'submitted' },
    })
  }

  // If rejected on a bid_decision, update pursuit to no_bid
  if (decision === 'rejected' && approval.triggerType === 'bid_decision') {
    await db.pursuit.update({
      where: { id: approval.pursuitId },
      data: { stage: 'no_bid', bidDecision: 'no_bid', decisionReason: reason ?? 'Rejected in approval' },
    })
  }

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: `approval_${decision}`,
    entityType: 'approval',
    entityId: id,
    afterJson: { triggerType: approval.triggerType, reason },
    request: req,
  })

  return NextResponse.json(updated)
}

import { readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { decideApproval } from '@/lib/approval-workflow'
import { logAction } from '@/lib/auth'

// PATCH /api/approvals/[id] — approve / reject / request changes
export const PATCH = withApiErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('manager')
  const body = await readJson(req, 'approval')
  const { decision, reason } = body

  if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const updated = await decideApproval(ctx, id, { decision, reason })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: `approval_${decision}`,
    entityType: 'approval',
    entityId: id,
    afterJson: { triggerType: updated.triggerType, reason },
    request: req,
  })

  return NextResponse.json(updated)
})

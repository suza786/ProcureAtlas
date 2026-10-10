import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { parseIds, readJson } from '@/lib/api-validation'
import { requireTenantWithRole } from '@/lib/tenant'
import { invalidatePursuitReview } from '@/lib/pursuit-workflow'
import { logAction } from '@/lib/auth'

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { ctx } = await requireTenantWithRole('contributor')
  const { id, taskId } = parseIds(await params)
  const input = await readJson(req, 'taskUpdate')
  const task = await db.$transaction(async tx => {
    const pursuit = await tx.pursuit.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { stage: true } })
    if (!pursuit) throw new Response('Pursuit not found', { status: 404 })
    if (['submitted', 'won', 'lost'].includes(pursuit.stage)) throw new Response('Submitted pursuit tasks are locked', { status: 409 })
    const task = await tx.task.findFirst({ where: { id: taskId, pursuitId: id } })
    if (!task) throw new Response('Task not found for this pursuit', { status: 404 })
    const updated = await tx.task.update({ where: { id: taskId }, data: { status: input.status } })
    if (task.status !== input.status) await invalidatePursuitReview(tx, ctx.tenantId, id)
    return updated
  }, { isolationLevel: 'Serializable' })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'task_updated', entityType: 'pursuit', entityId: id,
    afterJson: { taskId, status: task.status }, request: req })
  return NextResponse.json(task)
})

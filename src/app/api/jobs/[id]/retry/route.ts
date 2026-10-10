import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'

export const POST = withApiErrors(async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireTenantWithRole('manager')
  const { id } = await context.params
  const job = await db.outboxJob.findFirst({ where: { id, tenantId: ctx.tenantId } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  const changed = await db.outboxJob.updateMany({ where: { id, tenantId: ctx.tenantId, status: 'failed' }, data: { status: 'pending', attempts: 0, availableAt: new Date(), lockedAt: null, lockedBy: null, error: null, completedAt: null } })
  if (!changed.count) return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 409 })
  return NextResponse.json({ success: true, jobId: id }, { status: 202 })
})

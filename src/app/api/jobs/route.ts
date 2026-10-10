import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { requireTenantWithRole } from '@/lib/tenant'

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('manager')
  const params = validatedSearch(req)
  const { limit, offset } = pagination(params, 50, 100)
  const status = params.get('status') === 'all' ? null : params.get('status')
  if (status && !['pending', 'running', 'retrying', 'failed', 'completed'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const items = await db.outboxJob.findMany({
    where: { tenantId: ctx.tenantId, ...(status ? { status } : {}) }, take: limit, skip: offset, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    // Payloads can contain private account tokens; inspection only exposes operational metadata.
    select: { id: true, kind: true, status: true, attempts: true, maxAttempts: true, availableAt: true, lockedAt: true, error: true, completedAt: true, createdAt: true },
  })
  return NextResponse.json({ items, limit, offset })
})

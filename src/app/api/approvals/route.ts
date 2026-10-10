import type { Prisma } from '@prisma/client'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/approvals — list approvals for the tenant
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const { limit, offset } = pagination(searchParams)
  const status = searchParams.get('status')
  const triggerType = searchParams.get('triggerType')

  const where: Prisma.ApprovalWhereInput = { tenantId: ctx.tenantId }
  if (status && status !== 'all') where.decision = status
  if (triggerType) where.triggerType = triggerType

  const approvals = await db.approval.findMany({
    where,
    include: {
      pursuit: {
        include: { tender: { select: { title: true, market: true, submissionDeadline: true, valueUSD: true } } },
      },
      approver: { select: { email: true, name: true } },
      proposal: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit, skip: offset,
  })

  return NextResponse.json({
    items: approvals.map(a => ({
      id: a.id,
      triggerType: a.triggerType,
      stepOrder: a.stepOrder,
      requestedBy: a.requestedBy,
      approverRole: a.approverRole,
      decision: a.decision,
      reason: a.reason,
      slaDueAt: a.slaDueAt,
      decidedAt: a.decidedAt,
      escalatedAt: a.escalatedAt,
      createdAt: a.createdAt,
      pursuit: a.pursuit,
      approver: a.approver,
      proposal: a.proposal,
      isOverdue: a.slaDueAt ? a.slaDueAt < new Date() && a.decision === 'pending' : false,
    })),
  })
})

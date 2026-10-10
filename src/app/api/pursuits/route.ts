import { pagination, validatedSearch } from '@/lib/api-validation'
import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import { initializePursuit } from '@/lib/pursuit-workflow'

// GET /api/pursuits — list pursuits for tenant
export const GET = withApiErrors(async function GET(req: Request) {
  const { limit, offset } = pagination(validatedSearch(req))
  const ctx = await getCurrentTenant()

  const pursuits = await db.pursuit.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      tender: { include: { buyer: { include: { organization: true } } } },
      company: true,
      bid: { include: { tasks: true } },
      _count: { select: { complianceItems: true, tasks: true, approvals: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit, skip: offset,
  })

  return NextResponse.json({
    items: pursuits.map(p => ({
      id: p.id,
      stage: p.stage,
      bidDecision: p.bidDecision,
      decisionReason: p.decisionReason,
      priority: p.priority,
      estimatedValueUSD: p.estimatedValueUSD,
      winProbability: p.winProbability,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      tender: {
        id: p.tender.id,
        title: p.tender.title,
        market: p.tender.market,
        sector: p.tender.sector,
        country: p.tender.country,
        submissionDeadline: p.tender.submissionDeadline,
        valueUSD: p.tender.valueUSD,
        buyer: p.tender.buyer?.organization?.name ?? null,
      },
      company: { id: p.company.id, name: p.company.name },
      bid: p.bid ? {
        id: p.bid.id,
        status: p.bid.status,
        submissionReady: p.bid.submissionReady,
        taskCount: p.bid.tasks.length,
        tasks: p.bid.tasks.map(t => ({
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt,
        })),
      } : null,
      counts: { compliance: p._count.complianceItems, tasks: p._count.tasks, approvals: p._count.approvals },
    })),
  })
})

// POST /api/pursuits — create a pursuit (bid/no-bid decision recorded)
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'pursuit')
  const { tenderId, companyId, priority } = body
  const { pursuit, created } = await db.$transaction(tx => initializePursuit(tx, ctx.tenantId, tenderId, companyId, priority), { isolationLevel: 'Serializable' })

  if (created) await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'pursuit_created',
    entityType: 'pursuit',
    entityId: pursuit.id,
    afterJson: { stage: pursuit.stage, bidDecision: pursuit.bidDecision, tenderId, companyId: pursuit.companyId },
    request: req,
  })

  return NextResponse.json(pursuit, { status: created ? 201 : 200 })
})

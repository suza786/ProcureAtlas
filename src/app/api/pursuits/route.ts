import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/pursuits — list pursuits for tenant (Phase 1: hardcoded tenant slug)
export async function GET() {
  const tenant = await db.tenant.findUnique({ where: { slug: 'atlas-demo' } })
  if (!tenant) return NextResponse.json({ items: [], total: 0 })

  const pursuits = await db.pursuit.findMany({
    where: { tenantId: tenant.id },
    include: {
      tender: { include: { buyer: { include: { organization: true } } } },
      company: true,
      bid: { include: { tasks: true } },
      _count: { select: { complianceItems: true, tasks: true, approvals: true } },
    },
    orderBy: { updatedAt: 'desc' },
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
}

// POST /api/pursuits — create a pursuit (bid/no-bid decision)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenderId, companyId, stage, bidDecision, decisionReason, priority } = body

  if (!tenderId || !companyId) {
    return NextResponse.json({ error: 'tenderId and companyId required' }, { status: 400 })
  }

  const tenant = await db.tenant.findUnique({ where: { slug: 'atlas-demo' } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const pursuit = await db.pursuit.create({
    data: {
      tenantId: tenant.id,
      tenderId,
      companyId,
      stage: stage ?? 'discovering',
      bidDecision: bidDecision ?? 'pending',
      decisionReason: decisionReason ?? null,
      priority: priority ?? 'medium',
      decidedAt: bidDecision && bidDecision !== 'pending' ? new Date() : null,
    },
  })

  return NextResponse.json(pursuit, { status: 201 })
}

import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/dashboard — Command Center aggregate (KPIs + recent activity)
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  if (!ctx.tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId } })
  const company = await db.company.findFirst({ where: { tenantId: ctx.tenantId } })

  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  // Severity is stored as a string; database lexical ordering is not priority ordering.
  const severityRank = ['critical', 'high', 'medium', 'low'] as const
  const [tenders, pursuits, alertGroups, awards, activeTenderCount, pursuitTotals, criticalAlerts] = await Promise.all([
    db.tender.findMany({
      where: { status: 'active', submissionDeadline: { gte: now, lte: weekAhead } },
      select: { id: true, title: true, market: true, sector: true, valueUSD: true, submissionDeadline: true },
      orderBy: { submissionDeadline: 'asc' },
    }),
    db.pursuit.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        tender: { select: { title: true, submissionDeadline: true, valueUSD: true, market: true } },
        bid: { select: { status: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    Promise.all(severityRank.map(severity => db.alert.findMany({
      where: { tenantId: ctx.tenantId, acknowledgedAt: null, severity },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 8,
    }))),
    db.award.findMany({
      include: {
        tender: { select: { title: true, market: true, sector: true } },
        supplier: { select: { name: true, country: true } },
      },
      orderBy: { awardedAt: 'desc' },
      take: 5,
    }),
    db.tender.count({ where: { status: 'active' } }),
    db.pursuit.groupBy({
      by: ['stage'],
      where: { tenantId: ctx.tenantId },
      _count: { _all: true },
      _sum: { estimatedValueUSD: true },
    }),
    db.alert.count({ where: { tenantId: ctx.tenantId, acknowledgedAt: null, severity: { in: ['critical', 'high'] } } }),
  ])
  const alerts = alertGroups.flat().slice(0, 8)

  // KPIs
  const stageCount = (stage: string) => pursuitTotals.find(p => p.stage === stage)?._count._all ?? 0
  const activePursuits = stageCount('discovering') + stageCount('qualifying') + stageCount('bidding')
  const biddingPursuits = stageCount('bidding')
  const totalPipelineValue = pursuitTotals
    .filter(p => ['discovering', 'qualifying', 'bidding', 'submitted'].includes(p.stage))
    .reduce((acc, p) => acc + (p._sum.estimatedValueUSD ?? 0), 0)
  const wonCount = stageCount('won')
  const lostCount = stageCount('lost')

  // Next 7 days deadlines
  const deadlinesThisWeek = tenders
    .map(t => ({
      id: t.id,
      title: t.title,
      market: t.market,
      valueUSD: t.valueUSD,
      submissionDeadline: t.submissionDeadline,
      days: Math.floor((t.submissionDeadline!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => a.days - b.days)

  // Pipeline distribution
  const pipelineDistribution = {
    discovering: stageCount('discovering'),
    qualifying: stageCount('qualifying'),
    bidding: stageCount('bidding'),
    submitted: stageCount('submitted'),
    won: wonCount,
    lost: lostCount,
    no_bid: stageCount('no_bid'),
  }

  return NextResponse.json({
    tenant: { name: tenant?.name ?? ctx.tenantSlug, plan: tenant?.plan ?? 'professional', region: tenant?.region ?? 'BD' },
    company: company ? { id: company.id, name: company.name, country: company.country, annualTurnoverUSD: company.annualTurnoverUSD } : null,
    kpis: {
      activeTenderCount,
      activePursuits,
      biddingPursuits,
      totalPipelineValue,
      wonCount,
      lostCount,
      criticalAlerts,
      winRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
    },
    deadlinesThisWeek,
    pipelineDistribution,
    recentPursuits: pursuits.slice(0, 5).map(p => ({
      id: p.id,
      stage: p.stage,
      priority: p.priority,
      bidDecision: p.bidDecision,
      tender: p.tender,
      estimatedValueUSD: p.estimatedValueUSD,
    })),
    alerts: alerts.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      dueAt: a.dueAt,
    })),
    recentAwards: awards.map(a => ({
      supplier: a.supplier.name,
      supplierCountry: a.supplier.country,
      contractValue: a.contractValue,
      currency: a.currency,
      awardedAt: a.awardedAt,
      tender: a.tender,
    })),
    generatedAt: new Date().toISOString(),
  })
})

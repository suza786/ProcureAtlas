import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/dashboard — Command Center aggregate (KPIs + recent activity)
export async function GET() {
  const ctx = await getCurrentTenant()
  if (!ctx.tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId } })
  const company = await db.company.findFirst({ where: { tenantId: ctx.tenantId } })

  const [tenders, pursuits, alerts, awards] = await Promise.all([
    db.tender.findMany({
      where: { status: 'active' },
      select: { id: true, title: true, market: true, sector: true, valueUSD: true, submissionDeadline: true },
      orderBy: { submissionDeadline: 'asc' },
      take: 20,
    }),
    db.pursuit.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        tender: { select: { title: true, submissionDeadline: true, valueUSD: true, market: true } },
        bid: { select: { status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.alert.findMany({
      where: { tenantId: ctx.tenantId, acknowledgedAt: null },
      orderBy: { severity: 'desc' },
      take: 8,
    }),
    db.award.findMany({
      include: {
        tender: { select: { title: true, market: true, sector: true } },
        supplier: { select: { name: true, country: true } },
      },
      orderBy: { awardedAt: 'desc' },
      take: 5,
    }),
  ])

  // KPIs
  const activeTenderCount = tenders.length
  const activePursuits = pursuits.filter(p => ['discovering', 'qualifying', 'bidding'].includes(p.stage)).length
  const biddingPursuits = pursuits.filter(p => p.stage === 'bidding').length
  const totalPipelineValue = pursuits.reduce((acc, p) => acc + (p.estimatedValueUSD ?? 0), 0)
  const wonCount = pursuits.filter(p => p.stage === 'won').length
  const lostCount = pursuits.filter(p => p.stage === 'lost').length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length

  // Next 7 days deadlines
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const deadlinesThisWeek = tenders
    .filter(t => t.submissionDeadline && t.submissionDeadline <= weekAhead)
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
    discovering: pursuits.filter(p => p.stage === 'discovering').length,
    qualifying: pursuits.filter(p => p.stage === 'qualifying').length,
    bidding: pursuits.filter(p => p.stage === 'bidding').length,
    submitted: pursuits.filter(p => p.stage === 'submitted').length,
    won: wonCount,
    lost: lostCount,
    no_bid: pursuits.filter(p => p.stage === 'no_bid').length,
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
}

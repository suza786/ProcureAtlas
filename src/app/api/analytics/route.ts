import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/analytics — tenant analytics with 6-month snapshots
export async function GET() {
  const ctx = await getCurrentTenant()

  const snapshots = await db.analyticsSnapshot.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { snapshotDate: 'asc' },
    take: 12,
  })

  // Compute current metrics from live data
  const [pursuits, alerts, auditLogs] = await Promise.all([
    db.pursuit.findMany({
      where: { tenantId: ctx.tenantId },
      select: { stage: true, estimatedValueUSD: true, createdAt: true },
    }),
    db.alert.count({ where: { tenantId: ctx.tenantId, acknowledgedAt: null } }),
    db.auditLog.findMany({
      where: { tenantId: ctx.tenantId, action: { contains: 'llm_' }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { llmCostUsd: true, llmInputTokens: true, llmOutputTokens: true, createdAt: true },
    }),
  ])

  const activePursuits = pursuits.filter(p => ['discovering', 'qualifying', 'bidding'].includes(p.stage)).length
  const biddingPursuits = pursuits.filter(p => p.stage === 'bidding').length
  const submittedPursuits = pursuits.filter(p => p.stage === 'submitted').length
  const wonPursuits = pursuits.filter(p => p.stage === 'won').length
  const lostPursuits = pursuits.filter(p => p.stage === 'lost' || p.stage === 'no_bid').length
  const pipelineValue = pursuits
    .filter(p => ['discovering', 'qualifying', 'bidding', 'submitted'].includes(p.stage))
    .reduce((acc, p) => acc + (p.estimatedValueUSD ?? 0), 0)
  const wonValue = pursuits
    .filter(p => p.stage === 'won')
    .reduce((acc, p) => acc + (p.estimatedValueUSD ?? 0), 0)
  const winRate = wonPursuits + lostPursuits > 0 ? wonPursuits / (wonPursuits + lostPursuits) : 0
  const llmCost30d = auditLogs.reduce((acc, a) => acc + (a.llmCostUsd ?? 0), 0)

  // Win rate trend from snapshots
  const winRateTrend = snapshots.map(s => ({
    month: s.snapshotDate.toLocaleDateString('en', { month: 'short' }),
    winRate: Math.round(s.winRate * 100),
    won: s.wonPursuits,
    lost: s.lostPursuits,
  }))

  // Pipeline value trend
  const pipelineTrend = snapshots.map(s => ({
    month: s.snapshotDate.toLocaleDateString('en', { month: 'short' }),
    value: Math.round(s.pipelineValueUSD / 1000),
    won: Math.round(s.wonValueUSD / 1000),
  }))

  // LLM usage trend
  const llmTrend = snapshots.map(s => ({
    month: s.snapshotDate.toLocaleDateString('en', { month: 'short' }),
    calls: s.llmCallsCount,
    cost: Math.round(s.llmCostUsd * 10000) / 10000,
  }))

  // Evidence coverage trend
  const evidenceTrend = snapshots.map(s => ({
    month: s.snapshotDate.toLocaleDateString('en', { month: 'short' }),
    coverage: Math.round(s.evidenceCoverage * 100),
    count: s.evidenceCount,
  }))

  // Bid cycle time trend
  const bidCycleTrend = snapshots.map(s => ({
    month: s.snapshotDate.toLocaleDateString('en', { month: 'short' }),
    days: s.avgBidCycleDays,
    wordCount: s.avgProposalWordCount,
  }))

  return NextResponse.json({
    current: {
      activePursuits,
      biddingPursuits,
      submittedPursuits,
      wonPursuits,
      lostPursuits,
      pipelineValueUSD: pipelineValue,
      wonValueUSD: wonValue,
      winRate: Math.round(winRate * 100),
      activeAlerts: alerts,
      llmCalls30d: auditLogs.length,
      llmCost30d: Math.round(llmCost30d * 10000) / 10000,
    },
    trends: {
      winRate: winRateTrend,
      pipelineValue: pipelineTrend,
      llmUsage: llmTrend,
      evidenceCoverage: evidenceTrend,
      bidCycleTime: bidCycleTrend,
    },
    snapshots: snapshots.length,
  })
}

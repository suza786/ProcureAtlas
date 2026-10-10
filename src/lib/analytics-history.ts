import { createHash } from 'node:crypto'
import type { OutboxJob, Prisma } from '@prisma/client'
import { db } from './db'
import { JobFailure } from './outbox'

export const ANALYTICS_JOB = 'analytics.snapshot'
export const HISTORY_DAYS = 180
export function utcDay(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) }
export function analyticsJobId(tenantId: string, day: Date) {
  return `analytics_${createHash('sha256').update(JSON.stringify([tenantId, day.toISOString()])).digest('hex')}`
}

/** Bounded page; the worker retains the cursor until the sweep finishes. */
export async function scheduleAnalyticsPage(now = new Date(), cursor?: string, pageSize = 100) {
  const take = Math.min(100, Math.max(1, pageSize))
  const tenants = await db.tenant.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
  const day = utcDay(now)
  for (const tenant of tenants) {
    const id = analyticsJobId(tenant.id, day)
    await db.outboxJob.upsert({ where: { id }, update: {}, create: {
      id, tenantId: tenant.id, kind: ANALYTICS_JOB, payloadJson: JSON.stringify({ date: day.toISOString() }), availableAt: now,
    } })
  }
  return { scheduled: tenants.length, cursor: tenants.length === take ? tenants.at(-1)!.id : undefined }
}

export async function aggregateTenantAnalytics(tx: Prisma.TransactionClient, tenantId: string, now = new Date()) {
  const usageWhere = { tenantId, kind: 'provider_call', createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000), lte: now } }
  const [stages, alerts, usage, pendingCalls, evidenceCount, verifiedCount, proposal, cycles] = await Promise.all([
    tx.pursuit.groupBy({ by: ['stage'], where: { tenantId }, _count: { _all: true }, _sum: { estimatedValueUSD: true } }),
    tx.alert.count({ where: { tenantId, acknowledgedAt: null } }),
    tx.usageEvent.aggregate({ where: usageWhere, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true } }),
    tx.usageEvent.count({ where: { ...usageWhere, tokenSource: 'reserved_upper_bound' } }),
    tx.evidence.count({ where: { company: { tenantId } } }),
    tx.evidence.count({ where: { company: { tenantId }, verified: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    tx.proposal.aggregate({ where: { tenantId, pursuit: { tenantId } }, _avg: { wordCount: true } }),
    tx.$queryRaw<Array<{ days: number | null }>>`SELECT AVG((julianday(CASE WHEN typeof(b.submittedAt) IN ('integer','real') THEN b.submittedAt/1000 ELSE b.submittedAt END, CASE WHEN typeof(b.submittedAt) IN ('integer','real') THEN 'unixepoch' ELSE '+0 seconds' END) - julianday(CASE WHEN typeof(b.createdAt) IN ('integer','real') THEN b.createdAt/1000 ELSE b.createdAt END, CASE WHEN typeof(b.createdAt) IN ('integer','real') THEN 'unixepoch' ELSE '+0 seconds' END))) AS days FROM Bid b JOIN Pursuit p ON p.id=b.pursuitId WHERE p.tenantId=${tenantId} AND b.submittedAt IS NOT NULL AND b.submittedAt >= b.createdAt`,
  ])
  const count = (stage: string) => stages.find(s => s.stage === stage)?._count._all ?? 0
  const value = (stage: string) => stages.find(s => s.stage === stage)?._sum.estimatedValueUSD ?? 0
  const won = count('won'), lost = count('lost')
  return {
    activePursuits: count('discovering') + count('qualifying') + count('bidding'),
    biddingPursuits: count('bidding'), submittedPursuits: count('submitted'), wonPursuits: won, lostPursuits: lost,
    pipelineValueUSD: ['discovering', 'qualifying', 'bidding', 'submitted'].reduce((sum, stage) => sum + value(stage), 0), wonValueUSD: value('won'),
    winRate: won + lost ? won / (won + lost) : 0,
    avgBidCycleDays: cycles[0]?.days ?? 0, avgProposalWordCount: Math.round(proposal._avg.wordCount ?? 0),
    llmCallsCount: usage._count._all, llmInputTokens: usage._sum.inputTokens ?? 0, llmOutputTokens: usage._sum.outputTokens ?? 0,
    llmCostUsd: 0, llmCostKnown: false,
    evidenceCount, evidenceCoverage: evidenceCount ? verifiedCount / evidenceCount : 0,
    activeAlerts: alerts, pendingProviderCalls: pendingCalls,
  }
}

export async function dispatchAnalyticsSnapshot(job: OutboxJob, now = new Date()) {
  let payload: { date?: string }
  try { payload = JSON.parse(job.payloadJson) } catch { throw new JobFailure('Invalid analytics snapshot payload', true) }
  const day = utcDay(now)
  if (!payload || !payload.date || !Number.isFinite(Date.parse(payload.date))) throw new JobFailure('Missing analytics snapshot date', true)
  // Delayed jobs must never label today's observed state as yesterday's history.
  if (payload.date !== day.toISOString()) return
  await db.$transaction(async tx => {
    if (!await tx.tenant.findUnique({ where: { id: job.tenantId }, select: { id: true } })) return
    const existing = await tx.analyticsSnapshot.findUnique({ where: { tenantId_snapshotDate: { tenantId: job.tenantId, snapshotDate: day } } })
    if (existing?.source === 'observed') return
    const { activeAlerts: _alerts, pendingProviderCalls: _pending, ...metrics } = await aggregateTenantAnalytics(tx, job.tenantId, now)
    const data = { ...metrics, source: 'observed', observedAt: now }
    await tx.analyticsSnapshot.upsert({ where: { tenantId_snapshotDate: { tenantId: job.tenantId, snapshotDate: day } }, create: { tenantId: job.tenantId, snapshotDate: day, ...data }, update: data })
  })
}

export async function tenantAnalytics(tenantId: string, now = new Date()) {
  return db.$transaction(async tx => {
    const since = new Date(utcDay(now).getTime() - (HISTORY_DAYS - 1) * 86_400_000)
    const snapshots = (await tx.analyticsSnapshot.findMany({ where: { tenantId, source: 'observed', snapshotDate: { gte: since, lte: utcDay(now) } }, orderBy: { snapshotDate: 'desc' }, take: HISTORY_DAYS })).reverse()
    const metrics = await aggregateTenantAnalytics(tx, tenantId, now)
    const rows = snapshots.map(s => ({ ...s, date: s.snapshotDate.toISOString().slice(0, 10), observedAt: s.observedAt?.toISOString() ?? null, winRate: Math.round(s.winRate * 100), llmCostUsd: s.llmCostKnown ? s.llmCostUsd : null }))
    return {
      current: { ...metrics, llmCostUsd: null, winRate: Math.round(metrics.winRate * 100), llmCalls30d: metrics.llmCallsCount, llmCost30d: null },
      metadata: { timezone: 'UTC', period: 'daily', historyDays: HISTORY_DAYS, providerUsageWindowDays: 30, observedAt: now.toISOString(), source: 'observed', evidenceDefinition: 'Verified, unexpired evidence divided by all tenant-owned evidence' },
      history: rows, snapshots: rows.length,
      trends: {
        winRate: rows.map(s => ({ date: s.date, winRate: s.winRate, won: s.wonPursuits, lost: s.lostPursuits })),
        pipelineValue: rows.map(s => ({ date: s.date, value: s.pipelineValueUSD / 1000, won: s.wonValueUSD / 1000 })),
        llmUsage: rows.map(s => ({ date: s.date, calls: s.llmCallsCount, cost: s.llmCostUsd })),
        evidenceCoverage: rows.map(s => ({ date: s.date, coverage: Math.round(s.evidenceCoverage * 100), count: s.evidenceCount })),
        bidCycleTime: rows.map(s => ({ date: s.date, days: s.avgBidCycleDays, wordCount: s.avgProposalWordCount })),
      },
    }
  })
}

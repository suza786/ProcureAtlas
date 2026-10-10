import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tenderFind: vi.fn(), tenderCount: vi.fn(), pursuitFind: vi.fn(), pursuitGroup: vi.fn(),
  alertFind: vi.fn(), alertCount: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: {
  tenant: { findUnique: async () => ({ name: 'Tenant' }) },
  company: { findFirst: async () => null },
  tender: { findMany: mocks.tenderFind, count: mocks.tenderCount },
  pursuit: { findMany: mocks.pursuitFind, groupBy: mocks.pursuitGroup },
  alert: { findMany: mocks.alertFind, count: mocks.alertCount },
  award: { findMany: async () => [] },
} }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: async () => ({ tenantId: 'tenant' }) }))
import { GET } from '@/app/api/dashboard/route'

const now = new Date('2026-10-09T12:00:00Z')
let tenders: Array<{ id: string; title: string; status: string; submissionDeadline: Date | null }>
let pursuits: Array<{ id: string; tenantId: string; stage: string; estimatedValueUSD: number | null; tender: object }>
let alerts: Array<{ id: string; tenantId: string; severity: string; acknowledgedAt: Date | null; createdAt: Date }>

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  tenders = Array.from({ length: 35 }, (_, i) => ({
    id: `t${i}`, title: `Tender ${i}`, status: 'active',
    submissionDeadline: new Date(now.getTime() + (i - 22) * 86400000),
  }))
  pursuits = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, tenantId: 'tenant', stage: 'bidding', estimatedValueUSD: 100, tender: {} })),
    ...['discovering', 'qualifying', 'submitted', 'won', 'lost', 'no_bid'].map(stage => ({ id: stage, tenantId: 'tenant', stage, estimatedValueUSD: 200, tender: {} })),
    { id: 'foreign', tenantId: 'other', stage: 'bidding', estimatedValueUSD: 99999, tender: {} },
  ]
  alerts = Array.from({ length: 12 }, (_, i) => ({ id: `high${i}`, tenantId: 'tenant', severity: 'high', acknowledgedAt: null, createdAt: now }))
  alerts.push({ id: 'critical', tenantId: 'tenant', severity: 'critical', acknowledgedAt: null, createdAt: now })
  alerts.push(...Array.from({ length: 20 }, (_, i) => ({ id: `low${i}`, tenantId: 'tenant', severity: 'low', acknowledgedAt: null, createdAt: now })))
  alerts.push({ id: 'foreign', tenantId: 'other', severity: 'critical', acknowledgedAt: null, createdAt: now })
  alerts.push({ id: 'acknowledged', tenantId: 'tenant', severity: 'critical', acknowledgedAt: now, createdAt: now })

  mocks.tenderCount.mockImplementation(() => tenders.filter(t => t.status === 'active').length)
  mocks.tenderFind.mockImplementation(({ where, take }: any) => tenders.filter(t => t.status === where.status &&
    (!where.submissionDeadline || (t.submissionDeadline && t.submissionDeadline >= where.submissionDeadline.gte && t.submissionDeadline <= where.submissionDeadline.lte)))
    .sort((a, b) => (a.submissionDeadline?.getTime() ?? 0) - (b.submissionDeadline?.getTime() ?? 0)).slice(0, take))
  mocks.pursuitFind.mockImplementation(({ where, take }: any) => pursuits.filter(p => p.tenantId === where.tenantId).slice(0, take))
  mocks.pursuitGroup.mockImplementation(({ where }: any) => [...new Set(pursuits.filter(p => p.tenantId === where.tenantId).map(p => p.stage))].map(stage => {
    const rows = pursuits.filter(p => p.tenantId === where.tenantId && p.stage === stage)
    return { stage, _count: { _all: rows.length }, _sum: { estimatedValueUSD: rows.reduce((sum, p) => sum + (p.estimatedValueUSD ?? 0), 0) } }
  }))
  const filteredAlerts = (where: any) => alerts.filter(a => a.tenantId === where.tenantId && a.acknowledgedAt === null &&
    (!where.severity || (typeof where.severity === 'string' ? a.severity === where.severity : where.severity.in.includes(a.severity))))
  mocks.alertCount.mockImplementation(({ where }: any) => filteredAlerts(where).length)
  mocks.alertFind.mockImplementation(({ where, take, orderBy }: any) => {
    const rows = filteredAlerts(where)
    if (orderBy?.severity) rows.sort((a, b) => b.severity.localeCompare(a.severity))
    return rows.slice(0, take)
  })
})
afterEach(() => vi.useRealTimers())

describe('dashboard totals', () => {
  it('counts all active tenders and high priority alerts beyond preview limits', async () => {
    const body = await (await GET()).json()
    expect(body.kpis.activeTenderCount).toBe(35)
    expect(body.kpis.criticalAlerts).toBe(13)
  })
  it('returns every deadline in the next seven days without expired deadlines crowding them out', async () => {
    const body = await (await GET()).json()
    expect(body.deadlinesThisWeek.map((t: { id: string }) => t.id)).toEqual(['t22', 't23', 't24', 't25', 't26', 't27', 't28', 't29'])
    expect(body.deadlinesThisWeek.every((t: { days: number }) => t.days >= 0 && t.days <= 7)).toBe(true)
  })
  it('sums open pipeline stages while retaining tenant totals and finished-stage distribution', async () => {
    const body = await (await GET()).json()
    expect(body.kpis).toMatchObject({ activePursuits: 32, biddingPursuits: 30, totalPipelineValue: 3600, wonCount: 1, lostCount: 1, winRate: 50 })
    expect(body.pipelineDistribution).toEqual({ discovering: 1, qualifying: 1, bidding: 30, submitted: 1, won: 1, lost: 1, no_bid: 1 })
    expect(body.recentPursuits).toHaveLength(5)
  })
  it('places critical alerts ahead of high, medium, and low with an eight-row preview', async () => {
    const body = await (await GET()).json()
    expect(body.alerts).toHaveLength(8)
    expect(body.alerts[0]).toMatchObject({ id: 'critical', severity: 'critical' })
    expect(body.alerts.slice(1).every((a: { severity: string }) => a.severity === 'high')).toBe(true)
  })
  it('ranks medium alerts ahead of low alerts when high alerts are absent', async () => {
    alerts = alerts.filter(a => a.severity !== 'high')
    alerts.push({ id: 'medium', tenantId: 'tenant', severity: 'medium', acknowledgedAt: null, createdAt: now })
    const body = await (await GET()).json()
    expect(body.alerts.map((a: { severity: string }) => a.severity)).toEqual(['critical', 'medium', 'low', 'low', 'low', 'low', 'low', 'low'])
    expect(body.kpis.criticalAlerts).toBe(1)
  })
  it('excludes null and inactive deadlines and treats null pipeline estimates as zero', async () => {
    tenders.push({ id: 'null', title: 'No deadline', status: 'active', submissionDeadline: null })
    tenders.push({ id: 'inactive', title: 'Closed', status: 'closed', submissionDeadline: now })
    pursuits.push({ id: 'null', tenantId: 'tenant', stage: 'submitted', estimatedValueUSD: null, tender: {} })
    const body = await (await GET()).json()
    expect(body.kpis.activeTenderCount).toBe(36)
    expect(body.kpis.totalPipelineValue).toBe(3600)
    expect(body.pipelineDistribution.submitted).toBe(2)
    expect(body.deadlinesThisWeek).toHaveLength(8)
  })
  it('returns zero values and empty previews when there is no live data', async () => {
    tenders = []; pursuits = []; alerts = []
    const body = await (await GET()).json()
    expect(body.kpis).toEqual({ activeTenderCount: 0, activePursuits: 0, biddingPursuits: 0, totalPipelineValue: 0, wonCount: 0, lostCount: 0, criticalAlerts: 0, winRate: 0 })
    expect(body.deadlinesThisWeek).toEqual([])
    expect(body.alerts).toEqual([])
  })
})

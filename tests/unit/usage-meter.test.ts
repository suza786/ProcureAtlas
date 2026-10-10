import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  tenantFind: vi.fn(), tenantUpdate: vi.fn(), subscriptionFind: vi.fn(), subscriptionUpsert: vi.fn(),
  metricUpsert: vi.fn(), metricUpdate: vi.fn(), metricUpdateMany: vi.fn(), metricFind: vi.fn(),
  eventCreate: vi.fn(), eventFind: vi.fn(), eventUpdate: vi.fn(), eventUpdateMany: vi.fn(),
  pursuitCount: vi.fn(), pursuitGroup: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: {
  tenant: { findUnique: mocks.tenantFind, update: mocks.tenantUpdate },
  subscription: { findUnique: mocks.subscriptionFind, upsert: mocks.subscriptionUpsert },
  usageMetric: { upsert: mocks.metricUpsert, update: mocks.metricUpdate, updateMany: mocks.metricUpdateMany, findUnique: mocks.metricFind },
  usageEvent: { create: mocks.eventCreate, findUnique: mocks.eventFind, update: mocks.eventUpdate, updateMany: mocks.eventUpdateMany },
  pursuit: { count: mocks.pursuitCount, groupBy: mocks.pursuitGroup }, $transaction: mocks.transaction,
} }))
import { db } from '@/lib/db'
import { ensureSubscription } from '@/lib/subscription'
import { PLANS } from '@/lib/plans'
import { meterApiRequest, reserveProviderCall, settleProviderCall, assertPursuitQuota } from '@/lib/usage-meter'
import { runApiRequest } from '@/lib/request-context'

type Metric = { count: number; reservedCount: number; limit: number; tenantId: string; metricType: string }
type Event = { id: string; tenantId: string; kind: string; inputTokens?: number | null; outputTokens?: number | null; tokenSource?: string | null; endpoint?: string }
let metrics: Map<string, Metric>
let events: Event[]
let subscription: Record<string, unknown> | null
let tenant: { id: string; plan: string }

function applyMetric(row: Metric, data: Record<string, unknown>) {
  for (const key of ['count', 'reservedCount'] as const) {
    const value = data[key]
    if (typeof value === 'number') row[key] = value
    else if (value && typeof value === 'object') {
      const change = value as { increment?: number; decrement?: number }
      row[key] += (change.increment ?? 0) - (change.decrement ?? 0)
    }
  }
  if (typeof data.limit === 'number') row.limit = data.limit
  return row
}

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', 'false'); vi.stubEnv('DEMO_BILLING_SWITCHING', 'false')
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))
  metrics = new Map(); events = []; subscription = null; tenant = { id: 'a', plan: 'free' }
  mocks.tenantFind.mockImplementation(async () => ({ ...tenant }))
  mocks.tenantUpdate.mockImplementation(async ({ data }) => Object.assign(tenant, data))
  mocks.subscriptionFind.mockImplementation(async () => subscription && { ...subscription })
  mocks.subscriptionUpsert.mockImplementation(async ({ create, update }) => {
    subscription = subscription ? { ...subscription, ...update } : { id: 'sub', status: 'active', ...create }
    return { ...subscription }
  })
  mocks.metricUpsert.mockImplementation(async ({ create, update }) => {
    const key = create.metricType
    const row = metrics.get(key)
    if (row) return { ...applyMetric(row, update) }
    const created = { count: 0, reservedCount: 0, ...create }; metrics.set(key, created); return { ...created }
  })
  mocks.metricFind.mockImplementation(async ({ where }) => metrics.get(where.subscriptionId_metricType_periodStart.metricType) ?? null)
  mocks.metricUpdate.mockImplementation(async ({ where, data }) => applyMetric(metrics.get(where.subscriptionId_metricType_periodStart.metricType)!, data))
  mocks.metricUpdateMany.mockImplementation(async ({ where, data }) => {
    const row = metrics.get(where.metricType ?? 'llm_tokens')
    if (!row || (where.count?.lte != null && row.count > where.count.lte) || (where.reservedCount?.lte != null && row.reservedCount > where.reservedCount.lte)) return { count: 0 }
    applyMetric(row, data); return { count: 1 }
  })
  mocks.eventCreate.mockImplementation(async ({ data }) => { const event = { id: `event-${events.length}`, ...data }; events.push(event); return { ...event } })
  mocks.eventFind.mockImplementation(async ({ where }) => { const event = events.find(e => e.id === where.id); return event ? { ...event } : null })
  mocks.eventUpdate.mockImplementation(async ({ where, data }) => Object.assign(events.find(e => e.id === where.id)!, data))
  mocks.eventUpdateMany.mockImplementation(async ({ where, data }) => {
    const event = events.find(e => e.id === where.id && (!where.tenantId || e.tenantId === where.tenantId) && (!where.tokenSource || e.tokenSource === where.tokenSource))
    if (!event) return { count: 0 }
    Object.assign(event, data); return { count: 1 }
  })
  mocks.pursuitCount.mockResolvedValue(0); mocks.pursuitGroup.mockResolvedValue([])
  // Model transactional rollback and serialization, including overlapping callers.
  let queue = Promise.resolve()
  mocks.transaction.mockImplementation(callback => {
    const result = queue.then(async () => {
      const savedMetrics = structuredClone(metrics), savedEvents = structuredClone(events), savedSubscription = structuredClone(subscription)
      try { return await callback(db) }
      catch (error) { metrics = savedMetrics; events = savedEvents; subscription = savedSubscription; throw error }
    })
    queue = result.then(() => undefined, () => undefined)
    return result
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('provider accounting', () => {
  it.each([-1, 0, 0.5, NaN, Infinity, 32001])('rejects invalid output token bounds %s before reserving quota', async bound => {
    await expect(reserveProviderCall('a', 'input', bound)).rejects.toMatchObject({ status: 400 })
    expect(metrics.size).toBe(0)
    expect(events).toHaveLength(0)
  })
  it('holds quota as a reservation without reporting upper bounds as actual tokens', async () => {
    const reservation = await reserveProviderCall('a', 'abcd', 100)
    expect(reservation.reserved).toBe(104)
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 0, reservedCount: 104 })
    expect(events[0].inputTokens ?? 0).toBe(0)
    expect(events[0].outputTokens ?? 0).toBe(0)
  })
  it('settles reported actual usage once and releases the reservation', async () => {
    const reservation = await reserveProviderCall('a', 'abcd', 100)
    await settleProviderCall(reservation, { prompt_tokens: 8, completion_tokens: 12 }, 'abcd', 'output')
    await settleProviderCall(reservation, { prompt_tokens: 8, completion_tokens: 12 }, 'abcd', 'output')
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 20, reservedCount: 0 })
    expect(events[0]).toMatchObject({ inputTokens: 8, outputTokens: 12, tokenSource: 'provider_reported' })
  })
  it('labels fallback token estimates and releases reservations after an empty response', async () => {
    const reservation = await reserveProviderCall('a', 'abcdefgh', 100)
    await settleProviderCall(reservation, null, 'abcdefgh', '')
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 2, reservedCount: 0 })
    expect(events[0]).toMatchObject({ inputTokens: 2, outputTokens: 0, tokenSource: 'estimated' })
  })
  it('settles concurrent repeated responses once and rejects malformed provider token totals as reported facts', async () => {
    const reservation = await reserveProviderCall('a', 'abcdefgh', 100)
    await Promise.all([
      settleProviderCall(reservation, { prompt_tokens: -1, completion_tokens: 3 }, 'abcdefgh', 'abcd'),
      settleProviderCall(reservation, { prompt_tokens: -1, completion_tokens: 3 }, 'abcdefgh', 'abcd'),
    ])
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 3, reservedCount: 0 })
    expect(events[0]).toMatchObject({ inputTokens: 2, outputTokens: 1, tokenSource: 'estimated' })
  })
  it('reserves quota for overlapping calls and rejects the excess before provider execution', async () => {
    const provider = vi.fn(async () => 'result')
    const call = async () => { await reserveProviderCall('a', '', 3000); return provider() }
    const results = await Promise.allSettled([call(), call()])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const rejection = results.find(r => r.status === 'rejected') as PromiseRejectedResult
    expect(rejection.reason.status).toBe(429)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 0, reservedCount: 3000 })
    expect(events).toHaveLength(1)
  })
  it('does not settle a reservation event belonging to another tenant', async () => {
    const reservation = await reserveProviderCall('a', 'abcd', 100)
    await settleProviderCall({ ...reservation, tenantId: 'b' }, { prompt_tokens: 1, completion_tokens: 1 }, 'abcd', '')
    expect(metrics.get('llm_tokens')).toMatchObject({ count: 0, reservedCount: 104 })
  })
})

describe('request and pursuit quotas', () => {
  it('shares quota rejection with every concurrent lookup in the same request', async () => {
    metrics.set('api_calls', { count: 100, reservedCount: 0, limit: 100, tenantId: 'a', metricType: 'api_calls' })
    const outcomes = await runApiRequest(new Request('http://localhost/api/tenders'), () => Promise.allSettled([meterApiRequest('a'), meterApiRequest('a')]))
    expect(outcomes.every(outcome => outcome.status === 'rejected')).toBe(true)
    expect(events).toHaveLength(1)
  })
  it('counts repeated lookups once per request and counts concurrent distinct requests independently', async () => {
    await Promise.all(['one', 'two'].map(path => runApiRequest(new Request(`http://localhost/api/${path}`), async () => {
      await Promise.all([meterApiRequest('a', { userId: 'u' }), meterApiRequest('a', { userId: 'u' })])
      await meterApiRequest('a')
    })))
    expect(metrics.get('api_calls')?.count).toBe(2)
    expect(events.map(e => e.endpoint).sort()).toEqual(['/api/one', '/api/two'])
  })
  it('blocks exhausted API quota while keeping billing recovery endpoints accessible', async () => {
    metrics.set('api_calls', { count: 100, reservedCount: 0, limit: 100, tenantId: 'a', metricType: 'api_calls' })
    await expect(runApiRequest(new Request('http://localhost/api/tenders'), () => meterApiRequest('a'))).rejects.toMatchObject({ status: 429 })
    await expect(runApiRequest(new Request('http://localhost/api/billing/subscription'), () => meterApiRequest('a'))).resolves.toBeUndefined()
  })
  it('enforces tenant pursuit quota before a write', async () => {
    mocks.pursuitCount.mockResolvedValue(1)
    await expect(assertPursuitQuota(db as unknown as Prisma.TransactionClient, 'a', 't')).rejects.toMatchObject({ status: 429 })
    expect(mocks.pursuitCount).toHaveBeenCalledWith({ where: { tenantId: 'a' } })
  })
  it('counts distinct tracked tenders for the tenant, permitting an already tracked tender', async () => {
    subscription = { id: 'sub', tenantId: 'a', plan: 'solo', billingVerifiedAt: new Date('2026-10-01'), status: 'active', currentPeriodStart: new Date('2026-10-01'), currentPeriodEnd: new Date('2026-11-01') }
    mocks.pursuitGroup.mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ tenderId: `t${i}` })))
    await expect(assertPursuitQuota(db as unknown as Prisma.TransactionClient, 'a', 'new')).rejects.toMatchObject({ status: 429 })
    await expect(assertPursuitQuota(db as unknown as Prisma.TransactionClient, 'a', 't0')).resolves.toBeUndefined()
    expect(mocks.pursuitGroup).toHaveBeenCalledWith({ by: ['tenderId'], where: { tenantId: 'a' } })
  })
})

describe('subscription initialization and trust', () => {
  it('initializes free plan quotas despite a paid tenant label, then preserves the period on repeated upserts', async () => {
    tenant.plan = 'professional'
    const first = await ensureSubscription('a')
    const second = await ensureSubscription('a')
    expect(first).toMatchObject({ plan: 'free', ...PLANS.free.limits, currentPeriodStart: new Date('2026-10-01'), currentPeriodEnd: new Date('2026-11-01') })
    expect(second).toEqual(first)
    expect(tenant.plan).toBe('free')
  })
  it.each(['unverified', 'expired', 'past_due'])('downgrades %s paid subscriptions to free quotas', async state => {
    subscription = { id: 'sub', tenantId: 'a', plan: 'professional', status: state === 'past_due' ? 'past_due' : 'active', billingVerifiedAt: state === 'unverified' ? null : new Date('2026-09-01'), currentPeriodStart: new Date('2026-09-01'), currentPeriodEnd: new Date(state === 'expired' ? '2026-10-01' : '2026-11-01') }
    const result = await ensureSubscription('a')
    expect(result).toMatchObject({ plan: 'free', ...PLANS.free.limits })
    if (state === 'expired') expect(result.currentPeriodEnd).toEqual(new Date('2026-11-01'))
  })
  it('retains current verified paid quotas and ignores a demo flag without explicit demo billing switching', async () => {
    subscription = { id: 'sub', tenantId: 'a', plan: 'solo', status: 'active', billingVerifiedAt: new Date('2026-10-01'), currentPeriodStart: new Date('2026-10-01'), currentPeriodEnd: new Date('2026-11-01') }
    expect(await ensureSubscription('a')).toMatchObject({ plan: 'solo', ...PLANS.solo.limits })
    subscription = { ...subscription, plan: 'professional', billingVerifiedAt: null }
    vi.stubEnv('DEMO_MODE', 'true')
    expect(await ensureSubscription('a')).toMatchObject({ plan: 'free', ...PLANS.free.limits })
  })
  it('permits demo plan quotas only with both explicit demo flags', async () => {
    vi.stubEnv('DEMO_MODE', 'true'); vi.stubEnv('DEMO_BILLING_SWITCHING', 'true'); tenant.plan = 'professional'
    expect(await ensureSubscription('a')).toMatchObject({ plan: 'professional', ...PLANS.professional.limits })
  })
  it('does not treat a future verification timestamp as trusted paid billing', async () => {
    subscription = { id: 'sub', tenantId: 'a', plan: 'professional', status: 'active', billingVerifiedAt: new Date('2026-10-10'), currentPeriodStart: new Date('2026-10-01'), currentPeriodEnd: new Date('2026-11-01') }
    expect(await ensureSubscription('a')).toMatchObject({ plan: 'free', ...PLANS.free.limits })
  })
})

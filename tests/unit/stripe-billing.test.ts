import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mock.transaction } }))
import { POST } from '@/app/api/billing/events/route'
import { getPlan } from '@/lib/plans'

type Subscription = { id: string; tenantId: string; stripeCustomerId: string; stripeSubscriptionId: string | null; billingEventCreatedAt: number; plan: string; [key: string]: unknown }
let state: { subscriptions: Subscription[]; events: Array<{ provider: string; eventId: string; tenantId: string; payloadHash: string }>; tenantPlan: string }
let failTenantWrite: boolean
const timestamp = () => Math.floor(Date.now() / 1000)
const event = (overrides: Record<string, unknown> = {}) => ({ id: 'evt_1', type: 'customer.subscription.updated', created: timestamp(), livemode: true,
  data: { object: { id: 'sub_1', customer: 'cus_trusted', status: 'active', cancel_at_period_end: false,
    metadata: { tenantId: 'attacker' }, items: { data: [{ current_period_start: timestamp() - 100, current_period_end: timestamp() + 10000,
      price: { id: 'price_pro', recurring: { interval: 'month', interval_count: 1 } } }] } } }, ...overrides })
const request = (body: unknown, valid = true) => {
  const raw = JSON.stringify(body)
  const time = timestamp()
  const signature = crypto.createHmac('sha256', 'whsec_test').update(`${time}.${raw}`).digest('hex')
  return POST(new Request('http://localhost/api/billing/events', { method: 'POST', body: raw,
    headers: { 'stripe-signature': `t=${time},v1=${valid ? signature : '0'.repeat(64)}` } }))
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_PRICE_PLANS', JSON.stringify({ price_pro: 'professional' }))
  vi.stubEnv('DEMO_MODE', 'false')
  failTenantWrite = false
  state = { subscriptions: [{ id: 'local', tenantId: 'trusted', stripeCustomerId: 'cus_trusted', stripeSubscriptionId: null, billingEventCreatedAt: 0, plan: 'free' }], events: [], tenantPlan: 'free' }
  mock.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => {
    const draft = structuredClone(state)
    const tx = {
      billingEvent: {
        findUnique: async ({ where }: any) => draft.events.find(e => e.provider === where.provider_eventId.provider && e.eventId === where.provider_eventId.eventId) ?? null,
        create: async ({ data }: any) => { draft.events.push(data); return data },
      },
      subscription: {
        findMany: async ({ where, take }: any) => draft.subscriptions.filter(s => s.stripeCustomerId === where.stripeCustomerId).slice(0, take),
        updateMany: async ({ where, data }: any) => {
          const s = draft.subscriptions.find(s => s.id === where.id && s.billingEventCreatedAt <= where.billingEventCreatedAt.lte)
          if (!s) return { count: 0 }
          Object.assign(s, data); return { count: 1 }
        },
      },
      tenant: { update: async ({ where, data }: any) => {
        if (failTenantWrite) throw new Error('database failed')
        if (where.id !== 'trusted') throw new Error('wrong tenant')
        draft.tenantPlan = data.plan
      } },
    }
    const result = await run(tx)
    state = draft
    return result
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('signed Stripe billing events', () => {
  it('lets revocation win events generated in the same second', async () => {
    await request(event())
    expect(state.tenantPlan).toBe('professional')
    await request(event({ id: 'evt_same_second_delete', type: 'customer.subscription.deleted' }))
    expect(state.tenantPlan).toBe('free')
  })
  it('cannot re-grant access after a same-second revocation', async () => {
    await request(event({ type: 'customer.subscription.deleted' }))
    const response = await request(event({ id: 'evt_same_second_active' }))
    expect(await response.json()).toMatchObject({ ignored: 'stale' })
    expect(state.tenantPlan).toBe('free')
  })
  it('does not grant access before a future billing period begins', async () => {
    const value = event()
    value.data.object.items.data[0].current_period_start = timestamp() + 100
    expect((await request(value)).status).toBe(200)
    expect(state.tenantPlan).toBe('free')
  })
  it('rejects invalid signatures before database access', async () => {
    expect((await request(event(), false)).status).toBe(401)
    expect(mock.transaction).not.toHaveBeenCalled()
    expect(state.events).toHaveLength(0)
  })
  it('grants only the trusted customer tenant the configured plan and limits', async () => {
    const response = await request(event())
    expect(response.status).toBe(200)
    expect(state.tenantPlan).toBe('professional')
    expect(state.subscriptions[0]).toMatchObject({ ...getPlan('professional').limits, plan: 'professional', stripeSubscriptionId: 'sub_1', status: 'active' })
    expect(state.subscriptions[0].billingVerifiedAt).toBeInstanceOf(Date)
    expect(state.events[0]).toMatchObject({ provider: 'stripe', eventId: 'evt_1', tenantId: 'trusted' })
  })
  it('rejects unbound and ambiguously bound customers despite metadata', async () => {
    state.subscriptions = []
    expect((await request(event())).status).toBe(409)
    expect(state.events).toEqual([])
    state.subscriptions = [{ id: 'a', tenantId: 'a', stripeCustomerId: 'cus_trusted', stripeSubscriptionId: null, billingEventCreatedAt: 0, plan: 'free' },
      { id: 'b', tenantId: 'b', stripeCustomerId: 'cus_trusted', stripeSubscriptionId: null, billingEventCreatedAt: 0, plan: 'free' }]
    expect((await request(event())).status).toBe(409)
    expect(state.events).toEqual([])
  })
  it('rejects prices missing from the server mapping', async () => {
    vi.stubEnv('STRIPE_PRICE_PLANS', '{}')
    expect((await request(event())).status).toBe(422)
    expect(state.events).toHaveLength(0)
    expect(state.tenantPlan).toBe('free')
  })
  it('ignores older revocations and equal-time grants without rolling back entitlements', async () => {
    await request(event())
    for (const created of [timestamp() - 1]) {
      const response = await request(event({ id: `evt_stale_${created}`, created, type: 'customer.subscription.deleted' }))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ ignored: 'stale' })
    }
    expect(await (await request(event({ id: 'evt_equal_active' }))).json()).toMatchObject({ ignored: 'stale' })
    expect(state.tenantPlan).toBe('professional')
    expect(state.events).toHaveLength(3)
  })
  it('acknowledges identical retries and rejects changed payloads with the same event ID', async () => {
    const original = event()
    await request(original)
    const response = await request(original)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ duplicate: true })
    expect((await request({ ...original, type: 'customer.subscription.deleted' })).status).toBe(409)
    expect(state.events).toHaveLength(1)
    expect(state.tenantPlan).toBe('professional')
  })
  it('rolls back the event receipt and subscription when tenant synchronization fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    failTenantWrite = true
    expect((await request(event())).status).toBe(500)
    expect(state.events).toEqual([])
    expect(state.subscriptions[0].plan).toBe('free')
    failTenantWrite = false
    expect((await request(event())).status).toBe(200)
    expect(state.tenantPlan).toBe('professional')
    errorLog.mockRestore()
  })
  it('downgrades canceled subscriptions and rejects production test-mode events', async () => {
    await request(event())
    expect((await request(event({ id: 'evt_delete', type: 'customer.subscription.deleted', created: timestamp() + 1 }))).status).toBe(200)
    expect(state.tenantPlan).toBe('free')
    expect(state.subscriptions[0]).toMatchObject({ ...getPlan('free').limits, status: 'canceled' })
    expect((await request(event({ id: 'evt_test', livemode: false }))).status).toBe(400)
  })
  it.each(['past_due', 'unpaid', 'paused', 'incomplete'])('removes paid limits for signed %s status', async status => {
    const payload = event()
    payload.data.object.status = status
    expect((await request(payload)).status).toBe(200)
    expect(state.tenantPlan).toBe('free')
    expect(state.subscriptions[0]).toMatchObject({ status, ...getPlan('free').limits })
  })
  it('grants verified unexpired trials and supports legacy top-level periods', async () => {
    const payload = event()
    payload.data.object.status = 'trialing'
    const first = payload.data.object.items.data[0]
    const snapshot = { ...payload.data.object, current_period_start: first.current_period_start, current_period_end: first.current_period_end,
      customer: { id: 'cus_trusted' }, items: { data: [{ price: { id: 'price_pro', recurring: { interval: 'year', interval_count: 1 } } }] } }
    expect((await request({ ...payload, data: { object: snapshot } })).status).toBe(200)
    expect(state.subscriptions[0]).toMatchObject({ plan: 'professional', status: 'trialing', billingCycle: 'yearly' })
  })
  it('never grants paid entitlements from an already expired billing period', async () => {
    const payload = event()
    payload.data.object.items.data[0].current_period_start = timestamp() - 1000
    payload.data.object.items.data[0].current_period_end = timestamp() - 1
    expect((await request(payload)).status).toBe(200)
    expect(state.tenantPlan).toBe('free')
  })
  it('rejects a new event for a subscription different from the existing binding', async () => {
    state.subscriptions[0].stripeSubscriptionId = 'sub_other'
    expect((await request(event())).status).toBe(409)
    expect(state.events).toEqual([])
  })
  it('rejects malformed price mapping and a missing webhook secret', async () => {
    vi.stubEnv('STRIPE_PRICE_PLANS', 'not-json')
    expect((await request(event())).status).toBe(503)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect((await request(event())).status).toBe(503)
    expect(state.events).toEqual([])
  })
  it('acknowledges unrelated signed Stripe events without changing billing', async () => {
    expect(await (await request(event({ type: 'invoice.paid' }))).json()).toMatchObject({ ignored: 'unsupported' })
    expect(mock.transaction).not.toHaveBeenCalled()
    expect(state.tenantPlan).toBe('free')
  })
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), role: vi.fn(), audit: vi.fn(), subscriptionUpdate: vi.fn(), tenantUpdate: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: mocks.role, getCurrentTenant: vi.fn() }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.audit }))
vi.mock('@/lib/subscription', () => ({ ensureSubscription: async () => ({ id: 'sub-a', tenantId: 'a', plan: 'free' }), getSubscription: vi.fn() }))
import { PATCH } from '@/app/api/billing/subscription/route'
import { PLANS } from '@/lib/plans'
let storedSubscription: Record<string, unknown>
let tenantPlan: string
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', 'false'); vi.stubEnv('DEMO_BILLING_SWITCHING', 'false')
  storedSubscription = { id: 'sub-a', plan: 'free' }; tenantPlan = 'free'
  mocks.role.mockResolvedValue({ ctx: { tenantId: 'a', userId: 'owner-a' } })
  mocks.subscriptionUpdate.mockImplementation(async ({ data }) => { storedSubscription = { ...storedSubscription, ...data }; return storedSubscription })
  mocks.tenantUpdate.mockImplementation(async ({ data }) => { tenantPlan = data.plan; return { plan: tenantPlan } })
  mocks.transaction.mockImplementation(async callback => callback({ subscription: { update: mocks.subscriptionUpdate }, tenant: { update: mocks.tenantUpdate } }))
})
afterEach(() => vi.unstubAllEnvs())
const request = (body: object) => PATCH(new NextRequest('http://localhost/api/billing/subscription', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

it.each([[false, false], [true, false], [false, true]])('rejects direct production subscription switching with demo flags %s/%s', async (mode, switching) => {
  vi.stubEnv('DEMO_MODE', String(mode)); vi.stubEnv('DEMO_BILLING_SWITCHING', String(switching))
  const response = await request({ plan: 'professional' })
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ error: expect.any(String), code: 'BILLING_VERIFICATION_REQUIRED' })
  expect(storedSubscription.plan).toBe('free'); expect(tenantPlan).toBe('free')
  expect(mocks.transaction).not.toHaveBeenCalled()
})
it('updates subscription and tenant plan quotas together in explicit demo mode', async () => {
  vi.stubEnv('DEMO_MODE', 'true'); vi.stubEnv('DEMO_BILLING_SWITCHING', 'true')
  const response = await request({ plan: 'professional', billingCycle: 'yearly' })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ plan: 'professional', billingCycle: 'yearly', ...PLANS.professional.limits })
  expect(tenantPlan).toBe('professional')
  expect(mocks.role).toHaveBeenCalledWith('owner')
  expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'a', userId: 'owner-a', action: 'demo_subscription_updated' }))
})
it.each([{ plan: 'unknown' }, { apiCallsLimit: 999999 }, { cancelAtPeriodEnd: 'false' }])('rejects invalid bodies before demo plan writes %j', async body => {
  vi.stubEnv('DEMO_MODE', 'true'); vi.stubEnv('DEMO_BILLING_SWITCHING', 'true')
  expect((await request(body)).status).toBe(400)
  expect(storedSubscription.plan).toBe('free'); expect(mocks.transaction).not.toHaveBeenCalled()
})

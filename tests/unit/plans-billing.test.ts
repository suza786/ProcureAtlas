import { describe, it, expect, vi, afterEach } from 'vitest'
import { PLANS, getPlan } from '@/lib/plans'
import { demoBillingEnabled, verifyStripeSignature } from '@/lib/billing-security'
import crypto from 'node:crypto'
afterEach(() => vi.unstubAllEnvs())
describe('plan and billing policy', () => {
  it('defines quota and rate tiers for every paid plan', () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.limits.apiCallsLimit).toBeGreaterThan(0)
      if (plan.id !== 'free') expect(plan.rate.requestsPerHour).toBeGreaterThan(PLANS.free.rate.requestsPerHour)
    }
    expect(getPlan('professional').limits.seatsIncluded).toBe(3)
    expect(getPlan('unknown').id).toBe('free')
  })
  it('requires both explicit demo flags even in production', () => {
    vi.stubEnv('DEMO_MODE', 'true'); expect(demoBillingEnabled()).toBe(false)
    vi.stubEnv('DEMO_BILLING_SWITCHING', 'true'); expect(demoBillingEnabled()).toBe(true)
    vi.stubEnv('DEMO_MODE', 'false'); expect(demoBillingEnabled()).toBe(false)
  })
  it('checks raw body, timestamp and signature', () => {
    const body = '{}', now = 1000, secret = 'test-secret'
    const signed = crypto.createHmac('sha256', secret).update(now + '.' + body).digest('hex')
    expect(() => verifyStripeSignature(body, `t=${now},v1=${signed}`, secret, now)).not.toThrow()
    expect(() => verifyStripeSignature('{"fake":true}', `t=${now},v1=${signed}`, secret, now)).toThrow()
    expect(() => verifyStripeSignature(body, `t=${now},v1=${signed}`, secret, now + 301)).toThrow()
    expect(() => verifyStripeSignature(body, null, secret, now)).toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { bodySchemas, dateSchema, pagination } from '@/lib/api-validation'
describe('request validation', () => {
  it.each([{}, { email: [], password: 123 }, { email: 'a@example.com', password: 'x'.repeat(73) }, { email: 'a@example.com', password: 'é'.repeat(37) }])('rejects malformed credentials %j', value => {
    expect(bodySchemas.login.safeParse(value).success).toBe(false)
  })
  it.each(['NaN', '-1', '0', '101', '1.5', '3oops', 'Infinity'])('rejects limit %s', value => {
    expect(() => pagination(new URLSearchParams({ limit: value }))).toThrow()
  })
  it('rejects invalid states, dates, currencies, money and approval step orders', () => {
    expect(bodySchemas.proposalUpdate.safeParse({ status: 'garbage' }).success).toBe(false)
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(bodySchemas.currencyRate.safeParse({ baseCurrency: 'XYZ', quoteCurrency: 'USD', rate: -1 }).success).toBe(false)
    expect(bodySchemas.currencyRate.safeParse({ baseCurrency: 'USD', quoteCurrency: 'BDT', rate: Number.MIN_VALUE }).success).toBe(false)
    expect(bodySchemas.cost.safeParse({ pursuitId: 'p', label: 'Cost', laborCost: Infinity }).success).toBe(false)
    expect(bodySchemas.chainCreate.safeParse({ name: 'Chain', triggerType: 'submission', steps: [{ order: 1, role: 'manager' }, { order: 1, role: 'owner' }] }).success).toBe(false)
  })
  it('accepts valid timezone-aware dates without changing their calendar day', () => {
    expect(dateSchema.safeParse('2026-10-09T00:00:00+06:00').success).toBe(true)
  })
})

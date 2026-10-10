import { expect, it } from 'vitest'
import { calculateBidPrice, normalizeAward, summarizeAwardValues, compareBidToTenderUSD } from '@/lib/financial-calculations'

const rates = [
  { tenantId: 'a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 120, rateDate: new Date('2026-01-01'), source: 'manual' },
  { tenantId: 'a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 150, rateDate: new Date('2027-01-01'), source: 'future' },
  { tenantId: 'b', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 10, rateDate: new Date('2026-02-01'), source: 'other tenant' },
]
const award = { contractValue: 12000, currency: 'BDT', valueUSD: null, awardedAt: new Date('2026-03-01') }

it('prices a 20% profit margin as profit divided by selling price, distinct from markup', () => {
  const result = calculateBidPrice([100], 10, 20)
  expect(result.totalCost).toBe(110)
  expect(result.proposedPrice).toBe(137.5)
  expect(result.profitAmount / result.proposedPrice).toBeCloseTo(0.2)
  expect(result.markupPct).toBe(25)
})
it.each([-1, 100, 101, NaN])('rejects invalid margin %s', margin => {
  expect(() => calculateBidPrice([100], 10, margin)).toThrow()
})
it('normalizes using the tenant rate dated on or before the award and preserves the original', () => {
  expect(normalizeAward(award, rates, 'a')).toMatchObject({ contractValue: 12000, currency: 'BDT', valueUSD: 100, normalizationRate: 1 / 120, normalizationDate: new Date('2026-01-01'), normalizationSource: 'manual' })
})
it('leaves absent FX and absent original currency values unknown', () => {
  expect(normalizeAward(award, [], 'a').valueUSD).toBeNull()
  expect(normalizeAward({ ...award, currency: '' }, rates, 'a').valueUSD).toBeNull()
})
it('computes averages only from known normalized values and reports excluded coverage', () => {
  expect(summarizeAwardValues([{ valueUSD: 100 }, { valueUSD: null }, { valueUSD: 0 }])).toEqual({ totalValueUSD: 100, averageValueUSD: 50, normalizedCount: 2, unnormalizedCount: 1 })
})
it('compares converted bid prices to USD tender values, and refuses missing FX', () => {
  expect(compareBidToTenderUSD(12000, 'BDT', 200, rates, 'a', new Date('2026-03-01')).percentage).toBe(50)
  expect(compareBidToTenderUSD(12000, 'BDT', 200, [], 'a', new Date('2026-03-01')).percentage).toBeNull()
})

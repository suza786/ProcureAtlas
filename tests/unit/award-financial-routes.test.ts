import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ aggregate: vi.fn(), awards: vi.fn(), rates: vi.fn(), estimates: vi.fn(), create: vi.fn(), pursuit: vi.fn(), tenant: vi.fn(), role: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $queryRaw: mocks.aggregate, award: { findMany: mocks.awards }, currencyRate: { findMany: mocks.rates }, bidCostEstimate: { findMany: mocks.estimates, create: mocks.create }, pursuit: { findFirst: mocks.pursuit } } }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: mocks.tenant, requireTenantWithRole: mocks.role }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.audit }))
import { GET as awards } from '@/app/api/awards/route'
import { GET as estimates, POST } from '@/app/api/bid-cost-estimates/route'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant.mockResolvedValue({ tenantId: 'a' })
  mocks.role.mockResolvedValue({ ctx: { tenantId: 'a', userId: 'u' } })
  mocks.rates.mockResolvedValue([{ tenantId: 'a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 120, rateDate: new Date('2026-01-01'), source: 'manual' }])
})
it('aggregates all filtered awards while limiting only recent rows, with normalized coverage', async () => {
  const data = Array.from({ length: 55 }, (_, i) => ({ id: String(i), supplierOrgId: `s${i % 11}`, supplier: { name: `supplier${i % 11}`, country: 'BD' }, tender: { market: 'BD', sector: 'IT' }, contractValue: 12000, currency: i === 54 ? 'EUR' : 'BDT', valueUSD: i === 54 ? null : 100, awardedAt: new Date('2026-03-01') }))
  mocks.awards.mockResolvedValue(data.slice(0,40))
  mocks.aggregate.mockResolvedValueOnce([{totalAwards:55,totalValueUSD:5400,averageValueUSD:100,normalizedCount:54,unnormalizedCount:1,distinctWinnerCount:11}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
  const response = await awards(new NextRequest('http://localhost/api/awards?limit=40&market=BD'))
  const result = await response.json()
  expect(result.total).toBe(55)
  expect(result.items).toHaveLength(40)
  expect(result.totalValueUSD).toBe(5400)
  expect(result.normalizedCount).toBe(54)
  expect(result.unnormalizedCount).toBe(1)
  expect(result.distinctWinnerCount).toBe(11)
  expect(mocks.awards.mock.calls[0][0].take).toBe(40)
  expect(mocks.awards.mock.calls[0][0].where).toEqual({ tender: { market: 'BD' } })
  expect(mocks.aggregate).toHaveBeenCalledTimes(4)
  expect(mocks.rates).not.toHaveBeenCalled()
})
it('converts estimate prices before comparing them to USD tender values', async () => {
  mocks.estimates.mockResolvedValue([{ proposedPrice: 12000, currency: 'BDT', createdAt: new Date('2026-03-01'), pursuit: { tender: { valueUSD: 200 } } }])
  const result = await (await estimates(new NextRequest('http://localhost/api/bid-cost-estimates'))).json()
  expect(result.items[0].tenderValuePct).toBe(50)
  expect(result.items[0].proposedPriceUSD).toBe(100)
})
it('persists a selling-price margin rather than treating it as markup', async () => {
  mocks.pursuit.mockResolvedValue({ id: 'p' })
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'e', ...data }))
  const response = await POST(new NextRequest('http://localhost/api/bid-cost-estimates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pursuitId: 'p', label: 'Test', laborCost: 100, contingencyPct: 10, marginPct: 20 }) }))
  expect(response.status).toBe(201)
  expect((await response.json()).proposedPrice).toBe(137.5)
})

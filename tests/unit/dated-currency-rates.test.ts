import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), tenant: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { currencyRate: { findUnique: mocks.findUnique, create: mocks.create, update: mocks.update } } }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: mocks.tenant }))
import { POST } from '@/app/api/currency-rates/route'
beforeEach(() => {
  vi.clearAllMocks(); mocks.tenant.mockResolvedValue({ ctx: { tenantId: 'tenant-a' } })
  mocks.findUnique.mockResolvedValue(null); mocks.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }))
})
const post = (body: object) => POST(new NextRequest('http://localhost/api/currency-rates', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))
it('preserves separate dated snapshots using the tenant pair and date unique key', async () => {
  const result = await post({ baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 120, rateDate: '2026-09-01' })
  expect(result.status).toBe(201)
  expect(mocks.findUnique).toHaveBeenCalledWith({ where: { tenantId_baseCurrency_quoteCurrency_rateDate: {
    tenantId: 'tenant-a', baseCurrency: 'USD', quoteCurrency: 'BDT', rateDate: new Date('2026-09-01T00:00:00Z'),
  } } })
  expect(mocks.create.mock.calls[0][0].data.rateDate).toEqual(new Date('2026-09-01T00:00:00Z'))
})
it.each([{}, { rateDate: '2026-02-30' }, { rateDate: 'tomorrow' }])('rejects missing or impossible rate dates %j', async date => {
  const result = await post({ baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 120, ...date })
  expect(result.status).toBe(400); expect(mocks.create).not.toHaveBeenCalled()
})

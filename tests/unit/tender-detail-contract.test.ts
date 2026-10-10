import { beforeEach, expect, it, vi } from 'vitest'
import { validApiPayload } from '@/lib/api-client'
const mocks = vi.hoisted(() => ({ tenant: vi.fn(), tender: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: mocks.tenant }))
vi.mock('@/lib/db', () => ({ db: { tender: { findUnique: mocks.tender } } }))
import { GET } from '@/app/api/tenders/[id]/route'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant.mockResolvedValue({ tenantId: 'tenant-a' })
})
it('returns a browser-valid detail payload including tenant-filtered alerts', async () => {
  const alerts = [{ id: 'alert-a', tenantId: 'tenant-a', message: 'Deadline approaching' }]
  mocks.tender.mockResolvedValue({ id: 'tender-a', buyer: null, lots: [], requirements: [], documents: [], amendments: [], awards: [], alerts })
  const response = await GET(new Request('http://localhost/api/tenders/tender-a'), { params: Promise.resolve({ id: 'tender-a' }) })
  const payload = await response.json()
  expect(response.status).toBe(200)
  expect(validApiPayload('/api/tenders/tender-a', payload)).toBe(true)
  expect(payload.alerts).toEqual(alerts)
  expect(mocks.tender.mock.calls[0][0].include.alerts.where).toEqual({ tenantId: 'tenant-a' })
})
it('returns a JSON 404 for an absent tender', async () => {
  mocks.tender.mockResolvedValue(null)
  const response = await GET(new Request('http://localhost/api/tenders/missing'), { params: Promise.resolve({ id: 'missing' }) })
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: 'Tender not found' })
})

import { beforeEach, describe, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ tenant: vi.fn(), tender: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { tender: { findUnique: mocks.tender } } }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: mocks.tenant }))
import { withApiErrors } from '@/lib/api-errors'
import { GET as tenders } from '@/app/api/tenders/route'
import { NextRequest } from 'next/server'
import { GET as search } from '@/app/api/search/route'
import { GET as buyers } from '@/app/api/buyers/route'
import { GET as awards } from '@/app/api/awards/route'
import { GET as competitors } from '@/app/api/competitors/route'
import { GET as markets } from '@/app/api/markets/route'
import { GET as pulse } from '@/app/api/market-pulse/route'
import { GET as tenderDetail } from '@/app/api/tenders/[id]/route'
const request = () => new NextRequest('http://localhost/api/test')
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant.mockImplementation(() => Promise.reject(new Response('Unauthorized', { status: 401 })))
})

describe('API contracts', () => {
  it.each([400, 401, 403, 404])('returns deliberate %s errors as JSON', async status => {
    const response = await withApiErrors(async () => { throw new Response('denied', { status }) })()
    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'denied' })
  })
  it('rejects anonymous catalog reads before querying', async () => {
    const response = await tenders(new NextRequest('http://localhost/api/tenders'))
    expect(response.status).toBe(401)
  })
  it.each([
    ['search', () => search(request())], ['buyers', () => buyers(request())], ['awards', () => awards(request())],
    ['competitors', () => competitors(request())], ['markets', () => markets()], ['market-pulse', () => pulse()],
  ] as const)('requires authentication on %s', async (_name, handler) => {
    const response = await handler()
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
  it('limits tender detail alerts to the current tenant', async () => {
    mocks.tenant.mockResolvedValue({ tenantId: 'tenant-a' })
    mocks.tender.mockResolvedValue(null)
    expect((await tenderDetail(request(), { params: Promise.resolve({ id: 'tender-a' }) })).status).toBe(404)
    expect(mocks.tender).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ alerts: { where: { tenantId: 'tenant-a' }, take: 5 } }) }))
  })
  it('preserves authentication challenge headers', async () => {
    const response = await withApiErrors(async () => { throw new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }) })()
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
})

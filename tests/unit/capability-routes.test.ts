import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ role: vi.fn(), tenant: vi.fn(), company: vi.fn(), evidence: vi.fn(), supplier: vi.fn(), fact: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), annotation: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: mocks.tenant, requireTenantWithRole: mocks.role }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/catalog-analytics', () => ({ cachedCatalog: vi.fn(), awardSummary: vi.fn(), awardGroups: vi.fn(), summaryStats: vi.fn() }))
vi.mock('@/lib/db', () => {
  const tx = { company: { findFirst: mocks.company }, evidence: { findFirst: mocks.evidence }, organization: { findFirst: mocks.supplier }, capabilityFact: { findFirst: mocks.fact, create: mocks.create, update: mocks.update, deleteMany: mocks.remove }, tenantSupplierAnnotation: { upsert: mocks.annotation } }
  return { db: { ...tx, $transaction: (callback: (tx: object) => unknown) => callback(tx) } }
})
import { POST, PATCH, DELETE } from '@/app/api/company/capabilities/route'
import { PATCH as annotate } from '@/app/api/competitors/[id]/route'
const body = { companyId: 'company-a', kind: 'sector', value: 'Cyber', evidenceId: 'evidence-a' }
const request = (method: string, data: object) => new NextRequest('http://localhost/api/company/capabilities', { method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role.mockResolvedValue({ ctx: { tenantId: 'tenant-a', userId: 'user-a' } })
  mocks.company.mockResolvedValue({ id: 'company-a' })
  mocks.evidence.mockResolvedValue({ id: 'evidence-a', category: 'catalogue' })
  mocks.create.mockResolvedValue({ id: 'fact-a' })
  mocks.supplier.mockResolvedValue({ id: 'supplier-a' })
  mocks.annotation.mockResolvedValue({ id: 'annotation-a', isCompetitor: true, isPartner: false, notes: 'Private note' })
})
it('requires contributor role and same-tenant evidence/company links before creation', async () => {
  expect((await POST(request('POST', body))).status).toBe(201)
  expect(mocks.role).toHaveBeenCalledWith('contributor')
  expect(mocks.company).toHaveBeenCalledWith({ where: { id: 'company-a', tenantId: 'tenant-a' } })
  expect(mocks.evidence).toHaveBeenCalledWith({ where: { id: 'evidence-a', companyId: 'company-a', company: { tenantId: 'tenant-a' } } })
  expect(mocks.create).toHaveBeenCalledWith({ data: { ...body, tenantId: 'tenant-a' } })
})
it('rejects another company evidence and refuses updates to another tenant facts', async () => {
  mocks.evidence.mockResolvedValueOnce(null)
  expect((await POST(request('POST', body))).status).toBe(404)
  expect(mocks.create).not.toHaveBeenCalled()
  mocks.fact.mockResolvedValueOnce(null)
  expect((await PATCH(request('PATCH', { ...body, id: 'other-tenant-fact' }))).status).toBe(404)
  expect(mocks.update).not.toHaveBeenCalled()
})
it('validates turnover values and rejects additional properties', async () => {
  expect((await POST(request('POST', { ...body, kind: 'turnover' }))).status).toBe(400)
  expect((await POST(request('POST', { ...body, tenantId: 'tenant-b' }))).status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
})
it('deletes by the tenant boundary and returns not found for an inaccessible ID', async () => {
  mocks.remove.mockResolvedValueOnce({ count: 0 })
  expect((await DELETE(new NextRequest('http://localhost/api/company/capabilities?id=other-fact', { method: 'DELETE' }))).status).toBe(404)
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'other-fact', tenantId: 'tenant-a' } })
})
it('persists private supplier flags and notes using tenant/organization compound key', async () => {
  const res = await annotate(request('PATCH', { isCompetitor: true, notes: 'Private note' }), { params: Promise.resolve({ id: 'supplier-a' }) })
  expect(res.status).toBe(200)
  expect(mocks.annotation).toHaveBeenCalledWith({ where: { tenantId_organizationId: { tenantId: 'tenant-a', organizationId: 'supplier-a' } }, create: { tenantId: 'tenant-a', organizationId: 'supplier-a', isCompetitor: true, notes: 'Private note' }, update: { isCompetitor: true, notes: 'Private note' } })
})

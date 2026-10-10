import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ validate: vi.fn(), find: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), persist: vi.fn(), open: vi.fn(), remove: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { dataExport: { findFirst: mocks.find, findMany: mocks.list, create: mocks.create, update: mocks.update } } }))
vi.mock('@/lib/rate-limit', () => ({ validateApiKey: mocks.validate, checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }), setRateLimitHeaders: vi.fn() }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/export-records', () => ({ exportRecords: vi.fn() }))
vi.mock('@/lib/export-storage', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/export-storage')>(), persistExport: mocks.persist, openExportArtifact: mocks.open, removeExportArtifact: mocks.remove }))
import { GET as download } from '@/app/api/v1/exports/[id]/download/route'
import { POST as create, GET as list } from '@/app/api/v1/exports/route'
const req = (method = 'GET', body?: string) => new NextRequest('http://localhost/api/v1/exports/export-a/download', { method, ...(body ? { body, headers: { 'Content-Type': 'application/json' } } : {}) })
const context = { params: Promise.resolve({ id: 'export-a' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.validate.mockResolvedValue({ valid: true, tenantId: 'tenant-a', apiKeyId: 'key-a', scopes: ['api:read', 'api:write'] })
  mocks.find.mockResolvedValue({ tenantId: 'tenant-a', status: 'completed', format: 'csv', expiresAt: new Date(Date.now() + 60_000) })
  mocks.create.mockResolvedValue({ id: 'export-a' })
  mocks.persist.mockResolvedValue({ recordCount: 3, fileSizeKb: 1 })
  mocks.remove.mockResolvedValue(undefined)
  mocks.log.mockResolvedValue(undefined)
})
describe('authenticated export routes', () => {
  it('paginates tenant export history without an inaccessible fixed top 20', async () => {
    mocks.list.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const response = await list(new NextRequest('http://localhost/api/v1/exports?limit=2&offset=20'))
    expect(await response.json()).toMatchObject({ count: 2, items: [{ id: 'a' }, { id: 'b' }], limit: 2, offset: 20, hasMore: true })
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' }, take: 3, skip: 20 }))
  })
  it('rejects anonymous or insufficient-scope downloads before storage access', async () => {
    mocks.validate.mockResolvedValueOnce({ valid: false })
    expect((await download(req(), context)).status).toBe(401)
    mocks.validate.mockResolvedValueOnce({ valid: true, tenantId: 'tenant-a', scopes: ['api:write'] })
    expect((await download(req(), context)).status).toBe(403)
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('scopes job lookup and enforces expiration before reading bytes', async () => {
    mocks.find.mockResolvedValueOnce(null)
    expect((await download(req(), context)).status).toBe(404)
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: 'export-a', tenantId: 'tenant-a' } })
    mocks.find.mockResolvedValueOnce({ tenantId: 'tenant-a', status: 'completed', expiresAt: new Date(0) })
    expect((await download(req(), context)).status).toBe(410)
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('serves authenticated persisted bytes as an attachment', async () => {
    const bytes = new TextEncoder().encode('"id"\r\n"a"\r\n')
    mocks.open.mockResolvedValue({ bytes: bytes.length, stream: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }) })
    const response = await download(req(), context)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('"id"\r\n"a"\r\n')
  })
  it('returns a usable URL only after persistence and metadata succeed', async () => {
    const response = await create(req('POST', '{"exportType":"pursuits","format":"csv"}'))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ downloadUrl: '/api/v1/exports/export-a/download', status: 'completed', recordCount: 3 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed', downloadUrl: '/api/v1/exports/export-a/download' }) }))
  })
  it('records failure without reporting completion or leaving an artifact', async () => {
    mocks.persist.mockRejectedValueOnce(new Error('storage unavailable'))
    const response = await create(req('POST', '{"exportType":"pursuits"}'))
    expect(response.status).toBe(500)
    expect(mocks.remove).toHaveBeenCalledWith('export-a')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', downloadUrl: null }) }))
    expect(mocks.log).not.toHaveBeenCalled()
  })
})

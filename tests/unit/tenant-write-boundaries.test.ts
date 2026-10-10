import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), keys: vi.fn(), rate: vi.fn(), log: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn(),
  evidenceFind: vi.fn(), evidenceList: vi.fn(), companyFind: vi.fn(), embeddingList: vi.fn(), embeddingUpsert: vi.fn(),
  fileCreate: vi.fn(), proposalFind: vi.fn(), sectionFind: vi.fn(), sectionUpdate: vi.fn(),
  extractionFind: vi.fn(), extractionUpdate: vi.fn(), reviewCreate: vi.fn(), reviewDelete: vi.fn(), canonical: vi.fn(),
  inboundCreate: vi.fn(), inboundUpdate: vi.fn(), tenderCreate: vi.fn(), transaction: vi.fn(), tenantFind: vi.fn(), jobCreate: vi.fn(),
}))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: mocks.auth, getCurrentTenant: mocks.auth }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/rate-limit', () => ({ validateApiKey: mocks.keys, checkRateLimit: mocks.rate, setRateLimitHeaders: vi.fn() }))
vi.mock('fs/promises', () => ({ default: { mkdir: mocks.mkdir, writeFile: mocks.writeFile } }))
vi.mock('@/lib/db', () => ({ db: {
  evidence: { findFirst: mocks.evidenceFind, findMany: mocks.evidenceList }, company: { findFirst: mocks.companyFind },
  embedding: { findMany: mocks.embeddingList, upsert: mocks.embeddingUpsert }, fileUpload: { create: mocks.fileCreate },
  proposal: { findFirst: mocks.proposalFind }, proposalSection: { findUnique: mocks.sectionFind, update: mocks.sectionUpdate },
  llmExtraction: { findFirst: mocks.extractionFind, updateMany: mocks.extractionUpdate },
  tenantRequirementReview: { create: mocks.reviewCreate, deleteMany: mocks.reviewDelete },
  requirement: { create: mocks.canonical }, inboundWebhook: { create: mocks.inboundCreate, update: mocks.inboundUpdate },
  tender: { create: mocks.tenderCreate }, $transaction: mocks.transaction,
  tenant: { findUnique: mocks.tenantFind }, outboxJob: { create: mocks.jobCreate },
} }))
import { db } from '@/lib/db'
import { GET as searchEmbeddings, POST as embed } from '@/app/api/v1/embeddings/route'
import { POST as upload } from '@/app/api/uploads/route'
import { PATCH as section } from '@/app/api/proposals/[id]/sections/[sectionId]/route'
import { PATCH as review } from '@/app/api/extractions/[id]/route'
import { POST as ingest } from '@/app/api/v1/webhooks/ingest/route'

const request = (url: string, body: unknown, method = 'POST') => new NextRequest('http://localhost' + url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ ctx: { tenantId: 'tenant-a', userId: 'user-a', authenticated: true, role: 'manager' } })
  mocks.keys.mockResolvedValue({ valid: true, tenantId: 'tenant-a', scopes: ['api:read', 'api:write'], identifier: 'key' })
  mocks.rate.mockResolvedValue({ allowed: true })
  mocks.extractionUpdate.mockResolvedValue({ count: 1 })
  mocks.transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db))
})
afterEach(() => vi.unstubAllEnvs())
describe('tenant write boundaries', () => {
  it('scopes embedding searches to the API key tenant', async () => {
    mocks.embeddingList.mockResolvedValue([])
    expect((await searchEmbeddings(new NextRequest('http://localhost/api/v1/embeddings?q=test'))).status).toBe(200)
    expect(mocks.embeddingList).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } }))
  })
  it('denies caching a foreign company embedding', async () => {
    mocks.companyFind.mockResolvedValue(null)
    expect((await embed(request('/api/v1/embeddings', { texts: ['test'], entityType: 'company', entityId: 'foreign' }))).status).toBe(404)
    expect(mocks.embeddingUpsert).not.toHaveBeenCalled()
  })
  it('upserts embeddings by tenant and entity, never a global selector', async () => {
    mocks.companyFind.mockResolvedValue({ id: 'company-a' })
    expect((await embed(request('/api/v1/embeddings', { texts: ['test'], entityType: 'company', entityId: 'company-a' }))).status).toBe(200)
    expect(mocks.embeddingUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId_entityType_entityId: { tenantId: 'tenant-a', entityType: 'company', entityId: 'company-a' } } }))
  })
  it.each(['../foreign', 'evidence'])('rejects invalid paths or foreign evidence before writing (%s)', async category => {
    mocks.evidenceFind.mockResolvedValue(null)
    const form = new FormData(); form.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt'); form.append('category', category); form.append('evidenceId', 'foreign')
    const response = await upload(new NextRequest('http://localhost/api/uploads', { method: 'POST', body: form }))
    expect(response.status).toBe(category === 'evidence' ? 404 : 400)
    expect(mocks.mkdir).not.toHaveBeenCalled(); expect(mocks.writeFile).not.toHaveBeenCalled(); expect(mocks.fileCreate).not.toHaveBeenCalled()
  })
  it('rejects foreign proposal evidence without updating the section', async () => {
    mocks.proposalFind.mockResolvedValue({ id: 'proposal-a', status: 'draft', pursuit: { companyId: 'company-a', stage: 'bidding' } })
    mocks.sectionFind.mockResolvedValue({ id: 'section-a', revision: 0, hasGaps: true })
    mocks.evidenceList.mockResolvedValue([])
    const response = await section(request('/api/proposals/p/sections/s', { expectedRevision: 0, evidenceIds: ['foreign'] }, 'PATCH'), { params: Promise.resolve({ id: 'proposal-a', sectionId: 'section-a' }) })
    expect(response.status).toBe(404)
    expect(mocks.sectionUpdate).not.toHaveBeenCalled()
  })
  it('stores reviewed requirements privately and idempotently', async () => {
    mocks.extractionFind.mockResolvedValue({ id: 'extract-a', tenantId: 'tenant-a', tenderId: 'tender-a', reviewStatus: 'pending', status: 'completed', taskType: 'requirement_extraction', extractedItemsJson: JSON.stringify([
      { category: 'financial', criterion: 'Turnover', operator: '>=', threshold: '100', isMandatory: true, sourceSnippet: 'Clause 1', confidence: 0.9 },
    ]) })
    expect((await review(request('/api/extractions/e', { decision: 'approved' }, 'PATCH'), { params: Promise.resolve({ id: 'extract-a' }) })).status).toBe(200)
    expect(mocks.canonical).not.toHaveBeenCalled()
    expect(mocks.reviewCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ extractionId: 'extract-a', tenantId: 'tenant-a', tenderId: 'tender-a' }) })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
  it('rejects unsigned inbound events before any writes', async () => {
    expect((await ingest(request('/api/v1/webhooks/ingest', { title: 'Injected', url: 'https://example.com' }))).status).toBe(401)
    expect(mocks.inboundCreate).not.toHaveBeenCalled(); expect(mocks.tenderCreate).not.toHaveBeenCalled()
  })
  it('denies read-only API keys before embedding or export writes', async () => {
    mocks.keys.mockResolvedValue({ valid: true, tenantId: 'tenant-a', scopes: ['api:read'] })
    expect((await embed(request('/api/v1/embeddings', { texts: ['test'] }))).status).toBe(403)
    expect(mocks.embeddingUpsert).not.toHaveBeenCalled()
    expect(mocks.rate).not.toHaveBeenCalled()
  })
  it('rejects invalid reviewed items before changing review status', async () => {
    mocks.extractionFind.mockResolvedValue({ id: 'extract-a', tenantId: 'tenant-a', tenderId: 'tender-a', reviewStatus: 'pending', status: 'completed', taskType: 'requirement_extraction', extractedItemsJson: '[]' })
    expect((await review(request('/api/extractions/e', { decision: 'edited', editedItems: [{ criterion: 'bad' }] }, 'PATCH'), { params: Promise.resolve({ id: 'extract-a' }) })).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.extractionUpdate).not.toHaveBeenCalled()
  })
  it('deletes private annotations when a review is rejected', async () => {
    mocks.extractionFind.mockResolvedValue({ id: 'extract-a', tenantId: 'tenant-a', reviewStatus: 'pending', status: 'completed' })
    expect((await review(request('/api/extractions/e', { decision: 'rejected' }, 'PATCH'), { params: Promise.resolve({ id: 'extract-a' }) })).status).toBe(200)
    expect(mocks.reviewDelete).toHaveBeenCalledWith({ where: { extractionId: 'extract-a', tenantId: 'tenant-a' } })
    expect(mocks.canonical).not.toHaveBeenCalled()
  })
  it('rejects oversized chunked webhook bodies before writing', async () => {
    const response = await ingest(new NextRequest('http://localhost/api/v1/webhooks/ingest', { method: 'POST', body: 'x'.repeat(1024 * 1024 + 1) }))
    expect(response.status).toBe(413)
    expect(mocks.inboundCreate).not.toHaveBeenCalled()
  })
  it('records only authenticated events and rejects duplicate IDs before processing', async () => {
    vi.stubEnv('INBOUND_WEBHOOK_SECRETS', JSON.stringify({ custom: 'source-secret' }))
    vi.stubEnv('INBOUND_WEBHOOK_TENANTS', JSON.stringify({ custom: 'tenant-a' }))
    mocks.tenantFind.mockResolvedValue({ id: 'tenant-a' })
    mocks.jobCreate.mockResolvedValue({ id: 'job-1' })
    const body = '{}', timestamp = String(Math.floor(Date.now() / 1000))
    const signature = 'sha256=' + crypto.createHmac('sha256', 'source-secret').update(`custom.test.event-1.${timestamp}.${body}`).digest('hex')
    const signed = () => new NextRequest('http://localhost/api/v1/webhooks/ingest', { method: 'POST', body, headers: {
      'x-webhook-source': 'custom', 'x-webhook-event': 'test', 'x-webhook-id': 'event-1',
      'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature,
    } })
    mocks.inboundCreate.mockResolvedValueOnce({ id: 'inbound-1' })
    expect((await ingest(signed())).status).toBe(202)
    expect(mocks.inboundCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: 'event-1', signatureValid: true, tenantId: 'tenant-a' }) })
    expect(mocks.jobCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'inbound.process', tenantId: 'tenant-a', payloadJson: '{"webhookId":"inbound-1"}' }) })
    mocks.inboundCreate.mockRejectedValueOnce({ code: 'P2002' })
    expect((await ingest(signed())).status).toBe(409)
    expect(mocks.inboundUpdate).not.toHaveBeenCalled()
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1)
    expect(mocks.tenderCreate).not.toHaveBeenCalled()
  })
})

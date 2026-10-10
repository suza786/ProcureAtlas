import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ find: vi.fn(), claim: vi.fn(), create: vi.fn(), remove: vi.fn(), log: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: async () => ({ ctx: { tenantId: 'tenant-a', userId: 'reviewer' } }) }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction, llmExtraction: { findFirst: mocks.find } } }))
import { PATCH } from '@/app/api/extractions/[id]/route'

const item = { category: 'financial', criterion: 'Turnover', operator: '>=', threshold: '100', isMandatory: true, sourceSnippet: 'Clause 1', confidence: 0.9 }
let extraction: Record<string, unknown>
const review = (decision = 'approved', extra = {}) => PATCH(new NextRequest('http://localhost/api/extractions/extract-a', {
  method: 'PATCH', body: JSON.stringify({ decision, ...extra }), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ id: 'extract-a' }) })

beforeEach(() => {
  vi.resetAllMocks()
  extraction = { id: 'extract-a', tenantId: 'tenant-a', tenderId: 'tender-a', status: 'completed', taskType: 'requirement_extraction', reviewStatus: 'pending', extractedItemsJson: JSON.stringify([item]) }
  mocks.find.mockImplementation(() => Promise.resolve({ ...extraction }))
  mocks.claim.mockImplementation(({ where, data }) => {
    if (extraction.reviewStatus !== where.reviewStatus) return Promise.resolve({ count: 0 })
    Object.assign(extraction, data)
    return Promise.resolve({ count: 1 })
  })
  mocks.transaction.mockImplementation(callback => callback({ llmExtraction: { findFirst: mocks.find, updateMany: mocks.claim }, tenantRequirementReview: { create: mocks.create, deleteMany: mocks.remove } }))
})

describe('atomic extraction reviews', () => {
  it('claims a pending tenant review before creating private annotations', async () => {
    expect((await review()).status).toBe(200)
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'extract-a', tenantId: 'tenant-a', reviewStatus: 'pending', status: { in: ['completed', 'needs_review'] } }) }))
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'tenant-a', extractionId: 'extract-a', tenderId: 'tender-a' }) })
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0])
  })
  it('replays approval without another annotation or audit event', async () => {
    expect((await review()).status).toBe(200)
    expect((await review()).status).toBe(200)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.claim).toHaveBeenCalledTimes(1)
    expect(mocks.log).toHaveBeenCalledTimes(1)
  })
  it('marks legacy text thresholds unreviewed without inferring amounts', async () => {
    await review()
    const saved = JSON.parse(mocks.create.mock.calls[0][0].data.itemsJson)
    expect(saved[0].thresholdStatus).toBe('unreviewed')
    expect(saved[0].thresholdAmount).toBeUndefined()
  })
  it('preserves reviewed structured thresholds supplied by the reviewer', async () => {
    const structured = { ...item, evaluationMetric: 'annual_turnover', thresholdAmount: 100, thresholdCurrency: 'USD', thresholdUnit: 'money' }
    expect((await review('edited', { editedItems: [structured] })).status).toBe(200)
    expect(JSON.parse(mocks.create.mock.calls[0][0].data.itemsJson)).toEqual([{ ...structured, thresholdStatus: 'reviewed' }])
  })
  it.each([{ thresholdUnit: 'money' }, { thresholdUnit: 'money', thresholdCurrency: 'USD', operator: 'approximately' }])('leaves incomplete or unsupported thresholds unreviewed (%j)', async overrides => {
    const structured = { ...item, evaluationMetric: 'annual_turnover', thresholdAmount: 100, ...overrides }
    expect((await review('edited', { editedItems: [structured] })).status).toBe(200)
    expect(JSON.parse(mocks.create.mock.calls[0][0].data.itemsJson)[0].thresholdStatus).toBe('unreviewed')
  })
  it('does not overwrite a prior approval with rejection or editing', async () => {
    await review()
    expect((await review('rejected')).status).toBe(409)
    expect((await review('edited', { editedItems: [item] })).status).toBe(409)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })
  it('allows only one of simultaneous approve and reject requests to write', async () => {
    const responses = await Promise.all([review(), review('rejected')])
    expect(responses.map(response => response.status).sort()).toEqual([200, 409])
    expect(mocks.create.mock.calls.length + mocks.remove.mock.calls.length).toBe(1)
    expect(mocks.log).toHaveBeenCalledTimes(1)
  })
  it('makes concurrent duplicate approvals idempotent after one conditional claim wins', async () => {
    const responses = await Promise.all([review(), review()])
    expect(responses.map(response => response.status)).toEqual([200, 200])
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.log).toHaveBeenCalledTimes(1)
  })
  it('cannot approve a rejected extraction or repeat rejection', async () => {
    expect((await review('rejected')).status).toBe(200)
    expect((await review()).status).toBe(409)
    expect((await review('rejected')).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledTimes(1)
  })
  it('rejects unfinished extractions even when rejecting the review', async () => {
    extraction.status = 'pending'
    expect((await review('rejected')).status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('requires a tender for approval', async () => {
    extraction.tenderId = null
    expect((await review()).status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
  })
  it.each(['pending', 'failed', 'approved', 'rejected'])('rejects unreviewable processing status %s', async status => {
    extraction.status = status
    expect((await review()).status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(['tender_summary', 'translation'])('rejects approval of %s tasks', async taskType => {
    extraction.taskType = taskType
    expect((await review()).status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
  })
  it('rejects malformed stored items before claiming a review', async () => {
    extraction.extractedItemsJson = '{'
    expect((await review()).status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
  })
  it('does not write when another reviewer wins the conditional claim', async () => {
    mocks.claim.mockResolvedValue({ count: 0 })
    expect((await review()).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('scopes lookup to the authenticated tenant and denies foreign extractions', async () => {
    mocks.find.mockResolvedValue(null)
    expect((await review()).status).toBe(404)
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'extract-a', tenantId: 'tenant-a' } }))
    expect(mocks.claim).not.toHaveBeenCalled()
  })
})

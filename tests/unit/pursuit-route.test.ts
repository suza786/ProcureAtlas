import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), proposal: vi.fn(), bid: vi.fn(), transaction: vi.fn(), role: vi.fn(), log: vi.fn(), scoring: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { pursuit: { findFirst: mocks.find }, $transaction: mocks.transaction } }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: async () => ({ tenantId: 'tenant' }), requireTenantWithRole: mocks.role }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/scoring', () => ({ computeEligibilityScore: mocks.scoring, computeOpportunityFitScore: mocks.scoring, computeSubmissionReadinessScore: mocks.scoring }))
import { GET, PATCH } from '@/app/api/pursuits/[id]/route'
const params = { params: Promise.resolve({ id: 'pursuit' }) }
const patch = (body: unknown) => PATCH(new NextRequest('http://localhost/api/pursuits/pursuit', { method: 'PATCH', body: JSON.stringify(body) }), params)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role.mockResolvedValue({ ctx: { tenantId: 'tenant', userId: 'manager' } })
  mocks.find.mockResolvedValue({ id: 'pursuit', stage: 'qualifying' })
  mocks.update.mockResolvedValue({ count: 1 })
  mocks.transaction.mockImplementation(fn => fn({ outboxJob: { create: vi.fn().mockResolvedValue({ id: 'event' }) }, pursuit: { findFirst: mocks.find, updateMany: mocks.update }, proposal: { updateMany: mocks.proposal }, bid: { updateMany: mocks.bid } }))
})
describe('individual pursuit route', () => {
  it('hides foreign tenant records without scoring them', async () => {
    mocks.find.mockResolvedValue(null)
    const response = await GET(new Request('http://localhost/api/pursuits/pursuit'), params)
    expect(response.status).toBe(404)
    expect(mocks.find.mock.calls[0][0].where).toEqual({ id: 'pursuit', tenantId: 'tenant' })
    expect(mocks.scoring).not.toHaveBeenCalled()
  })
  it('requires manager authorization before reading or writing progression', async () => {
    mocks.role.mockRejectedValue(new Response('Forbidden', { status: 403 }))
    expect((await patch({ expectedStage: 'qualifying', stage: 'bidding' })).status).toBe(403)
    expect(mocks.role).toHaveBeenCalledWith('manager')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('rejects stale progression requests without writes', async () => {
    expect((await patch({ expectedStage: 'discovering', stage: 'qualifying' })).status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('progresses using the tenant and expected stage together', async () => {
    expect((await patch({ expectedStage: 'qualifying', stage: 'bidding' })).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pursuit', tenantId: 'tenant', stage: 'qualifying' },
      data: expect.objectContaining({ stage: 'bidding', bidDecision: 'bid', decisionBy: 'manager' }) }))
  })
  it('detects a concurrent update and does not audit success', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    expect((await patch({ expectedStage: 'qualifying', stage: 'bidding' })).status).toBe(409)
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('rejects direct submission at the request boundary', async () => {
    expect((await patch({ expectedStage: 'qualifying', stage: 'submitted' })).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('withdraws editable proposals and bid with a no-bid decision in one transaction', async () => {
    expect((await patch({ expectedStage: 'qualifying', stage: 'no_bid' })).status).toBe(200)
    expect(mocks.proposal).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'withdrawn' }) }))
    expect(mocks.bid).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'withdrawn', submissionReady: false } }))
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
  it('does not withdraw records if the pursuit claim loses a race', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    expect((await patch({ expectedStage: 'qualifying', stage: 'no_bid' })).status).toBe(409)
    expect(mocks.proposal).not.toHaveBeenCalled(); expect(mocks.bid).not.toHaveBeenCalled()
  })
})

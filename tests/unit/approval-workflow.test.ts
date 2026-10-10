import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), list: vi.fn(), update: vi.fn(), chain: vi.fn(), chains: vi.fn(), user: vi.fn(), pursuit: vi.fn(), pursuitFind: vi.fn(), proposalFind: vi.fn(), proposalUpdate: vi.fn(), create: vi.fn(), actor: { tenantId: 'a', userId: 'approver', role: 'manager' } }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction, proposal: { findFirst: mocks.proposalFind } } }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: async () => ({ ctx: mocks.actor }) }))
import { decideApproval } from '@/lib/approval-workflow'
import { createSubmissionApprovals, submissionApproved } from '@/lib/approval-workflow'
import { PATCH as updateProposal } from '@/app/api/proposals/[id]/route'
import { NextRequest } from 'next/server'
const actor = mocks.actor
let rows: Array<{ id: string; tenantId: string; pursuitId: string; proposalId: null; chainId: string; triggerType: string; stepOrder: number; approverId: string | null; approverRole: string; decision: string }>
const chain = { id: 'chain', tenantId: 'a', isActive: true, triggerType: 'submission', stepsJson: JSON.stringify([{ order: 1, role: 'manager' }, { order: 2, role: 'owner' }]), stepCount: 2, slaHours: 48 }
beforeEach(() => {
  vi.clearAllMocks(); actor.role = 'manager'
  rows = [1, 2].map(step => ({ id: 'step-' + step, tenantId: 'a', pursuitId: 'p', proposalId: null, chainId: 'chain', triggerType: 'submission', stepOrder: step, approverId: step === 1 ? 'approver' : null, approverRole: step === 1 ? 'manager' : 'owner', decision: 'pending' }))
  mocks.find.mockImplementation(({ where }) => Promise.resolve(rows.find(row => row.id === where.id) ?? null))
  mocks.list.mockImplementation(() => Promise.resolve(rows))
  mocks.chain.mockResolvedValue(chain); mocks.chains.mockResolvedValue([chain])
  mocks.user.mockImplementation(() => Promise.resolve({ id: 'approver', role: actor.role, email: 'a@example.com' }))
  mocks.proposalFind.mockResolvedValue({ id: 'proposal', pursuitId: 'p', revision: 0, status: 'in_review', pursuit: { stage: 'bidding' }, sections: [] })
  mocks.pursuitFind.mockResolvedValue({ id: 'p', stage: 'bidding' })
  mocks.update.mockImplementation(({ where, data }) => {
    const row = rows.find(row => row.id === where.id && row.decision === where.decision)
    if (!row) return Promise.resolve({ count: 0 }); Object.assign(row, data); return Promise.resolve({ count: 1 })
  })
  mocks.transaction.mockImplementation(fn => fn({ outboxJob: { create: vi.fn().mockResolvedValue({ id: 'event' }) }, approval: { findFirst: mocks.find, findMany: mocks.list, updateMany: mocks.update, create: mocks.create }, approvalChain: { findFirst: mocks.chain, findMany: mocks.chains }, user: { findFirst: mocks.user }, pursuit: { findFirst: mocks.pursuitFind, updateMany: mocks.pursuit }, proposal: { findFirst: mocks.proposalFind, update: mocks.proposalUpdate } }))
})
describe('approval workflows', () => {
  it('cannot reverse an already submitted pursuit through a pending no-bid approval', async () => {
    rows[0].triggerType = 'bid_decision'
    mocks.pursuitFind.mockResolvedValue({ id: 'p', stage: 'submitted' })
    await expect(decideApproval(actor, 'step-1', { decision: 'rejected' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.pursuit).not.toHaveBeenCalled()
  })
  it('does not submit after only the first approval', async () => {
    await decideApproval(actor, 'step-1', { decision: 'approved' })
    expect(mocks.pursuit).not.toHaveBeenCalled()
  })
  it('rejects out-of-order approvals', async () => {
    actor.role = 'owner'
    await expect(decideApproval(actor, 'step-2', { decision: 'approved' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects the wrong assigned approver', async () => {
    rows[0].approverId = 'someone-else'
    await expect(decideApproval(actor, 'step-1', { decision: 'approved' })).rejects.toMatchObject({ status: 403 })
  })
  it('rejects repeat decisions', async () => {
    rows[0].decision = 'approved'
    await expect(decideApproval(actor, 'step-1', { decision: 'approved' })).rejects.toMatchObject({ status: 409 })
  })
  it('requires the owner role on the owner step', async () => {
    rows[0].decision = 'approved'
    await expect(decideApproval(actor, 'step-2', { decision: 'approved' })).rejects.toMatchObject({ status: 403 })
  })
  it('does not submit implicitly after the last approval', async () => {
    rows[0].decision = 'approved'; actor.role = 'owner'
    await decideApproval(actor, 'step-2', { decision: 'approved' })
    expect(mocks.pursuit).not.toHaveBeenCalled()
  })
  it('uses a conditional update so simultaneous decisions cannot both succeed', async () => {
    const outcomes = await Promise.allSettled([decideApproval(actor, 'step-1', { decision: 'approved' }), decideApproval(actor, 'step-1', { decision: 'rejected' })])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  })
  it.each(['approved', 'submitted'])('blocks direct proposal status %s while approvals are pending', async status => {
    const response = await updateProposal(new NextRequest('http://localhost/api/proposals/proposal', { method: 'PATCH', body: JSON.stringify({ status, expectedRevision: 0 }) }), { params: Promise.resolve({ id: 'proposal' }) })
    expect(response.status).toBe(409)
    expect(mocks.proposalUpdate).not.toHaveBeenCalled()
  })
  it('requires every configured step to exist as well as be approved', async () => {
    rows = [rows[0]]; rows[0].decision = 'approved'
    const result = await mocks.transaction(tx => submissionApproved(tx, 'a', 'p', null))
    expect(result).toBe(false)
  })
  it('creates all configured steps for a new proposal', async () => {
    await mocks.transaction(tx => createSubmissionApprovals(tx, 'a', 'p', 'proposal', 'creator'))
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ stepOrder: 2, approverRole: 'owner', proposalId: 'proposal', tenantId: 'a' }) })
  })
})

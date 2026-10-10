import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), proposalUpdate: vi.fn(), proposalClaim: vi.fn(),
  sectionFind: vi.fn(), sectionClaim: vi.fn(), sections: vi.fn(), company: vi.fn(), user: vi.fn(),
  approvals: vi.fn(), approved: vi.fn(), bidInvalidate: vi.fn(), bid: vi.fn(), pursuit: vi.fn(),
  rates: vi.fn(), latest: vi.fn(), version: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }))
vi.mock('@/lib/auth', () => ({ roleAtLeast: (role: string) => ['manager', 'admin', 'owner'].includes(role) }))
vi.mock('@/lib/approval-workflow', () => ({ submissionApproved: mocks.approved }))
import { createProposalVersion, saveProposalSection, transitionProposal } from '@/lib/proposal-workflow'

const actor = { tenantId: 'tenant-a', userId: 'reviewer', role: 'manager' }
const fact = { id: 'evidence-a', companyId: 'company-a', title: 'Audited accounts', verified: true,
  factMetric: 'annual_turnover', factAmount: 200, factUnit: 'money', factCurrency: 'USD' }
const mandatory = { id: 'requirement-a', isMandatory: true, evaluationMetric: 'annual_turnover', thresholdStatus: 'reviewed',
  thresholdAmount: 100, thresholdCurrency: 'USD', thresholdUnit: 'money', operator: '>=' }
let section: ReturnType<typeof freshSection>
let proposal: ReturnType<typeof freshProposal>
function freshSection() {
  return { id: 'section-a', proposalId: 'proposal-a', revision: 2, content: 'Reviewed response', status: 'approved',
    evidenceIds: '["evidence-a"]', evidenceCount: 1, hasGaps: false, wordCount: 2, order: 1 }
}
function freshProposal() {
  return { id: 'proposal-a', tenantId: 'tenant-a', pursuitId: 'pursuit-a', revision: 4, currentVersion: 2,
    status: 'approved', sections: [freshSection()], pursuit: { tenderId: 'tender-a', stage: 'bidding', companyId: 'company-a',
      company: { tenantId: 'tenant-a', evidence: [{ ...fact }], certifications: [] as typeof fact[], projectRefs: [] as typeof fact[] },
      tender: { requirements: [{ ...mandatory }] }, complianceItems: [{ requirementId: 'requirement-a', status: 'compliant', evidence: { ...fact } }],
      tasks: [{ status: 'done' }] } }
}
const tx = { outboxJob: { create: vi.fn().mockResolvedValue({ id: 'event' }) },
  proposal: { findFirst: mocks.find, update: mocks.proposalUpdate, updateMany: mocks.proposalClaim, findUniqueOrThrow: mocks.find },
  proposalSection: { findUnique: mocks.sectionFind, findUniqueOrThrow: mocks.sectionFind, updateMany: mocks.sectionClaim, findMany: mocks.sections },
  company: { findFirst: mocks.company }, user: { findFirst: mocks.user }, approval: { updateMany: mocks.approvals },
  bid: { updateMany: mocks.bidInvalidate, upsert: mocks.bid }, pursuit: { update: mocks.pursuit }, currencyRate: { findMany: mocks.rates },
  tenantRequirementReview: { findFirst: async () => null },
  proposalVersion: { aggregate: mocks.latest, create: mocks.version },
}
beforeEach(() => {
  vi.resetAllMocks()
  section = freshSection(); proposal = freshProposal(); proposal.sections = [section]
  mocks.transaction.mockImplementation(callback => callback(tx))
  mocks.find.mockImplementation(() => Promise.resolve(structuredClone(proposal)))
  mocks.sectionFind.mockImplementation(() => Promise.resolve(structuredClone(section)))
  mocks.sections.mockImplementation(() => Promise.resolve([structuredClone(section)]))
  mocks.company.mockImplementation(() => Promise.resolve(proposal.pursuit.company))
  mocks.approved.mockResolvedValue(true); mocks.rates.mockResolvedValue([]); mocks.user.mockResolvedValue({ id: 'reviewer' })
  mocks.proposalClaim.mockImplementation(({ where, data }) => {
    if (where.revision !== proposal.revision) return Promise.resolve({ count: 0 })
    Object.assign(proposal, { ...data, revision: proposal.revision + 1 })
    return Promise.resolve({ count: 1 })
  })
  mocks.sectionClaim.mockImplementation(({ where, data }) => {
    if (where.revision !== section.revision) return Promise.resolve({ count: 0 })
    Object.assign(section, { ...data, revision: section.revision + 1 })
    return Promise.resolve({ count: 1 })
  })
  mocks.proposalUpdate.mockImplementation(({ data }) => {
    Object.assign(proposal, { ...data, revision: proposal.revision + 1 })
    return Promise.resolve(structuredClone(proposal))
  })
  mocks.latest.mockResolvedValue({ _max: { versionNumber: 5 } })
  mocks.version.mockImplementation(({ data }) => Promise.resolve({ id: 'version-a', ...data }))
})

describe('proposal section transactions', () => {
  it('rejects a stale save before any content or aggregate writes', async () => {
    await expect(saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 1, content: 'Stale text' })).rejects.toMatchObject({ status: 409 })
    expect(section.content).toBe('Reviewed response')
    expect(mocks.sectionClaim).not.toHaveBeenCalled(); expect(mocks.proposalUpdate).not.toHaveBeenCalled()
  })
  it('allows one concurrent save and rejects the other via the section revision claim', async () => {
    const results = await Promise.allSettled(['First text', 'Second text'].map(content => saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 2, content })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(result => result.status === 'rejected')
    expect(failure?.status === 'rejected' && failure.reason.status).toBe(409)
    expect(mocks.proposalUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.approvals).toHaveBeenCalledTimes(1)
  })
  it('updates aggregates and invalidates approvals and bid readiness in the same transaction', async () => {
    const result = await saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 2, content: 'A new response with evidence' })
    expect(result.revision).toBe(3); expect(result.proposalRevision).toBe(5)
    expect(section.status).toBe('drafting')
    expect(section.wordCount).toBe(5)
    expect(mocks.company).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'company-a', tenantId: 'tenant-a' } }))
    expect(mocks.proposalUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'draft', wordCount: 5, completedSections: 0, evidenceCoverage: 1 }) }))
    expect(mocks.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', pursuitId: 'pursuit-a', OR: [{ proposalId: 'proposal-a' }, { proposalId: null }] }), data: expect.objectContaining({ decision: 'pending' }) }))
    expect(mocks.bidInvalidate).toHaveBeenCalledWith({ where: { pursuitId: 'pursuit-a' }, data: { status: 'draft', submissionReady: false, submittedAt: null } })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
  it('rejects unverified evidence before saving content', async () => {
    proposal.pursuit.company.evidence[0].verified = false
    await expect(saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 2, content: 'Unsupported response' })).rejects.toMatchObject({ status: 404 })
    expect(mocks.sectionClaim).not.toHaveBeenCalled()
  })
  it('locks section edits after submission', async () => {
    proposal.status = 'submitted'
    await expect(saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 2, content: 'Replacement' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.sectionClaim).not.toHaveBeenCalled()
  })
  it('does not clear persisted AI or mandatory gap markers with status-only approval', async () => {
    section.content += '\n\n[gap: Required certification is unavailable]'
    section.status = 'in_review'; section.hasGaps = true
    await expect(saveProposalSection(actor, proposal.id, section.id, { expectedRevision: 2, status: 'approved' })).rejects.toMatchObject({ status: 409 })
    expect(section.status).toBe('in_review'); expect(section.hasGaps).toBe(true)
    expect(mocks.sectionClaim).not.toHaveBeenCalled(); expect(mocks.proposalUpdate).not.toHaveBeenCalled()
  })
})

describe('proposal submission transactions', () => {
  it('updates proposal, bid and pursuit together after readiness verification', async () => {
    await transitionProposal(actor, proposal.id, { expectedRevision: 4, status: 'submitted' })
    expect(proposal.status).toBe('submitted')
    expect(mocks.approved).toHaveBeenCalledWith(tx, 'tenant-a', 'pursuit-a', 'proposal-a')
    expect(mocks.proposalClaim).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'proposal-a', tenantId: 'tenant-a', revision: 4 } }))
    expect(mocks.bid).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'submitted', submissionReady: true, submittedAt: expect.any(Date) }) }))
    expect(mocks.pursuit).toHaveBeenCalledWith({ where: { id: 'pursuit-a' }, data: { stage: 'submitted' } })
    expect(mocks.proposalClaim.mock.invocationCallOrder[0]).toBeLessThan(mocks.bid.mock.invocationCallOrder[0])
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
  it.each(['sections', 'tasks', 'approvals', 'compliance', 'structured threshold'])('rejects unresolved %s without updating submission state', async problem => {
    if (problem === 'sections') section.status = 'drafting'
    if (problem === 'tasks') proposal.pursuit.tasks[0].status = 'pending'
    if (problem === 'approvals') mocks.approved.mockResolvedValue(false)
    if (problem === 'compliance') proposal.pursuit.complianceItems[0].evidence.verified = false
    if (problem === 'structured threshold') proposal.pursuit.tender.requirements[0].thresholdStatus = 'unreviewed'
    await expect(transitionProposal(actor, proposal.id, { expectedRevision: 4, status: 'submitted' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.proposalClaim).not.toHaveBeenCalled(); expect(mocks.bid).not.toHaveBeenCalled(); expect(mocks.pursuit).not.toHaveBeenCalled()
  })
  it('never updates bid or pursuit when another writer wins the proposal claim', async () => {
    mocks.proposalClaim.mockResolvedValue({ count: 0 })
    await expect(transitionProposal(actor, proposal.id, { expectedRevision: 4, status: 'submitted' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.bid).not.toHaveBeenCalled(); expect(mocks.pursuit).not.toHaveBeenCalled()
  })
  it('propagates a downstream bid failure through the transaction to rollback all changes', async () => {
    mocks.transaction.mockImplementation(async callback => {
      const snapshot = structuredClone(proposal)
      try { return await callback(tx) } catch (error) { proposal = snapshot; throw error }
    })
    mocks.bid.mockRejectedValue(new Error('Bid write failed'))
    await expect(transitionProposal(actor, proposal.id, { expectedRevision: 4, status: 'submitted' })).rejects.toThrow('Bid write failed')
    expect(proposal.status).toBe('approved'); expect(proposal.revision).toBe(4)
    expect(mocks.pursuit).not.toHaveBeenCalled()
  })
})

describe('proposal version allocation and snapshots', () => {
  it('allocates after the persisted maximum and freezes content and evidence references', async () => {
    const result = await createProposalVersion(actor, proposal.id, { expectedRevision: 4 })
    expect(result.versionNumber).toBe(6)
    const snapshot = JSON.parse(result.snapshotJson)
    expect(snapshot.proposalRevision).toBe(4)
    expect(snapshot.sections[0].evidenceIds).toEqual(['evidence-a'])
    expect(snapshot.sections[0].evidenceReferences[0]).toMatchObject({ id: 'evidence-a', title: 'Audited accounts', validAtSnapshot: true })
    section.content = 'Later edit'; proposal.pursuit.company.evidence[0].title = 'Renamed evidence'
    expect(JSON.parse(result.snapshotJson).sections[0].content).toBe('Reviewed response')
    expect(JSON.parse(result.snapshotJson).sections[0].evidenceReferences[0].title).toBe('Audited accounts')
  })
  it('allocates exactly one version for concurrent requests using the same revision', async () => {
    const results = await Promise.allSettled([createProposalVersion(actor, proposal.id, { expectedRevision: 4 }), createProposalVersion(actor, proposal.id, { expectedRevision: 4 })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(mocks.version).toHaveBeenCalledTimes(1)
    expect(proposal.currentVersion).toBe(6)
  })
  it('records missing and unverified references explicitly in the snapshot', async () => {
    section.evidenceIds = '["evidence-a","missing"]'
    proposal.pursuit.company.evidence[0].verified = false
    const result = await createProposalVersion(actor, proposal.id, { expectedRevision: 4 })
    expect(JSON.parse(result.snapshotJson).sections[0].evidenceReferences).toEqual([
      expect.objectContaining({ id: 'evidence-a', validAtSnapshot: false }), { id: 'missing', missing: true, validAtSnapshot: false },
    ])
  })
  it('rejects stale version requests without allocating a number', async () => {
    await expect(createProposalVersion(actor, proposal.id, { expectedRevision: 3 })).rejects.toMatchObject({ status: 409 })
    expect(mocks.latest).not.toHaveBeenCalled(); expect(mocks.version).not.toHaveBeenCalled(); expect(mocks.proposalClaim).not.toHaveBeenCalled()
  })
})

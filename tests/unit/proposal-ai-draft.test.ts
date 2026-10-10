vi.mock('@/lib/usage-meter', () => ({ reserveProviderCall: async () => ({ maxOutputTokens: 1500 }), settleProviderCall: async (_reservation: unknown, _usage: unknown, input: string, output: string) => ({ inputTokens: Math.ceil(input.length / 4), outputTokens: Math.ceil(output.length / 4) }) }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ find: vi.fn(), editable: vi.fn(), recompute: vi.fn(), transaction: vi.fn(),
  company: vi.fn(), claim: vi.fn(), completion: vi.fn(), log: vi.fn(), review: vi.fn(), rates: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: async () => ({ ctx: { tenantId: 'tenant-a', userId: 'writer', role: 'contributor' } }) }))
vi.mock('@/lib/auth', () => ({ logAction: mocks.log }))
vi.mock('@/lib/db', () => ({ db: { proposal: { findFirst: mocks.find }, $transaction: mocks.transaction,
  tenantRequirementReview: { findFirst: mocks.review }, currencyRate: { findMany: mocks.rates } } }))
vi.mock('@/lib/proposal-workflow', () => ({ requireEditableProposal: mocks.editable, recomputeProposal: mocks.recompute }))
vi.mock('z-ai-web-dev-sdk', () => ({ default: { create: async () => ({ chat: { completions: { create: mocks.completion } } }) } }))
import { POST } from '@/app/api/proposals/[id]/draft-section/route'

const evidence = { id: 'evidence-a', title: 'Audited accounts', category: 'financial', description: 'Verified turnover', verified: true }
const proposal = { id: 'proposal-a', revision: 4, status: 'draft', sections: [{ id: 'section-a', revision: 2, title: 'Capabilities', sectionType: 'technical' }],
  pursuit: { companyId: 'company-a', tenderId: 'tender-a', stage: 'bidding', company: { tenantId: 'tenant-a', name: 'Company', country: 'US', evidence: [evidence], certifications: [], projectRefs: [] },
    tender: { title: 'Tender', sector: 'IT', market: 'US', requirements: [] } } }
let generated: { content: string; evidenceUsed: Array<{ evidenceId: string; title: string; snippet: string }>; gaps: string[]; hasGaps: boolean; wordCount: number }
const draft = () => POST(new NextRequest('http://localhost/api/proposals/proposal-a/draft-section', {
  method: 'POST', body: JSON.stringify({ sectionId: 'section-a', expectedRevision: 2 }), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ id: 'proposal-a' }) })
beforeEach(() => {
  vi.resetAllMocks()
  generated = { content: 'Our audited turnover is substantiated by the supplied financial accounts [evidence:evidence-a].',
    evidenceUsed: [{ evidenceId: 'evidence-a', title: 'LLM title', snippet: 'Accounts support turnover' }], gaps: [], hasGaps: false, wordCount: 999 }
  mocks.find.mockResolvedValue(structuredClone(proposal)); mocks.editable.mockResolvedValue(structuredClone(proposal))
  mocks.review.mockResolvedValue(null); mocks.rates.mockResolvedValue([])
  mocks.company.mockResolvedValue(proposal.pursuit.company); mocks.claim.mockResolvedValue({ count: 1 })
  mocks.completion.mockImplementation(async () => ({ choices: [{ message: { content: JSON.stringify(generated) } }] }))
  mocks.transaction.mockImplementation(callback => callback({ company: { findFirst: mocks.company }, proposalSection: { updateMany: mocks.claim } }))
})

describe('AI proposal draft persistence', () => {
  it('requires human review and computes word count from text', async () => {
    const response = await draft()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true); expect(body.wordCount).not.toBe(999)
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'section-a', proposalId: 'proposal-a', revision: 2 }, data: expect.objectContaining({ status: 'in_review', aiAssisted: true, evidenceIds: '["evidence-a"]' }) }))
    expect(mocks.recompute).toHaveBeenCalledTimes(1)
  })
  it('preserves explicitly reported evidence gaps even when existing citations are valid', async () => {
    generated.hasGaps = true; generated.gaps = ['Required ISO certification is unavailable.']
    const response = await draft()
    const body = await response.json()
    expect(body.hasGaps).toBe(true)
    expect(body.gaps).toContain('AI review warning: Required ISO certification is unavailable.')
    expect(body.content).toContain('[gap: AI review warning: Required ISO certification is unavailable.]')
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hasGaps: true, status: 'in_review' }) }))
  })
  it('rejects invented evidence IDs without saving generated content', async () => {
    generated.content = generated.content.replaceAll('evidence-a', 'invented')
    generated.evidenceUsed[0].evidenceId = 'invented'
    const response = await draft()
    expect((await response.json()).success).toBe(false)
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.recompute).not.toHaveBeenCalled()
  })
  it('excludes unverified evidence records from the prompt and rejects attempts to cite them', async () => {
    const company = { ...proposal.pursuit.company, evidence: [{ ...evidence, id: 'unverified-evidence', title: 'UNVERIFIED PRIVATE CLAIM', verified: false }] }
    mocks.find.mockResolvedValue({ ...proposal, pursuit: { ...proposal.pursuit, company } })
    generated.content = generated.content.replaceAll('evidence-a', 'unverified-evidence')
    generated.evidenceUsed[0].evidenceId = 'unverified-evidence'
    expect((await (await draft()).json()).success).toBe(false)
    const prompt = mocks.completion.mock.calls[0][0].messages[1].content
    expect(prompt).not.toContain('UNVERIFIED PRIVATE CLAIM')
    expect(prompt).not.toContain('unverified-evidence')
    expect(mocks.claim).not.toHaveBeenCalled()
  })
  it('adds server detected mandatory requirement gaps even if the model reports none', async () => {
    const requirement = { criterion: 'Minimum annual turnover', category: 'financial', isMandatory: true, thresholdStatus: 'unreviewed', operator: '>=', thresholdAmount: 100, thresholdUnit: 'money', thresholdCurrency: 'USD', evaluationMetric: 'annual_turnover' }
    mocks.find.mockResolvedValue({ ...proposal, pursuit: { ...proposal.pursuit, tender: { ...proposal.pursuit.tender, requirements: [requirement] } } })
    const body = await (await draft()).json()
    expect(body.hasGaps).toBe(true)
    expect(body.gaps).toContain('Unresolved mandatory requirement: Minimum annual turnover')
    expect(body.content).toContain('[gap: Unresolved mandatory requirement: Minimum annual turnover]')
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hasGaps: true }) }))
    expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', tenderId: 'tender-a' }) }))
  })
  it('does not persist an AI response when the proposal changed during generation', async () => {
    mocks.editable.mockResolvedValue({ ...proposal, revision: 5 })
    expect((await draft()).status).toBe(409)
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.recompute).not.toHaveBeenCalled()
  })
  it('does not recompute or audit success after losing the section revision claim', async () => {
    mocks.claim.mockResolvedValue({ count: 0 })
    expect((await draft()).status).toBe(409)
    expect(mocks.recompute).not.toHaveBeenCalled(); expect(mocks.log).not.toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requirements: vi.fn(), company: vi.fn(), rates: vi.fn(), review: vi.fn(), pursuit: vi.fn(), approved: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {
  requirement: { findMany: mocks.requirements }, company: { findUnique: mocks.company },
  currencyRate: { findMany: mocks.rates },
  tenantRequirementReview: { findFirst: mocks.review },
  pursuit: { findUnique: mocks.pursuit },
  $transaction: (callback: (client: object) => Promise<unknown>) => callback({
    requirement: { findMany: mocks.requirements }, company: { findUnique: mocks.company }, currencyRate: { findMany: mocks.rates },
    tenantRequirementReview: { findFirst: mocks.review }, pursuit: { findUnique: mocks.pursuit },
  }),
} }))
vi.mock('@/lib/approval-workflow', () => ({ submissionApproved: mocks.approved }))
import { computeEligibilityScore, computeSubmissionReadinessScore } from '@/lib/scoring'
const now = new Date('2026-10-09T12:00:00Z')
const requirement = { category: 'financial', criterion: 'Minimum annual turnover', isMandatory: true, threshold: '1.5 million USD', thresholdStatus: 'reviewed', evaluationMetric: 'annual_turnover:2025', thresholdAmount: 1500000, thresholdCurrency: 'USD', thresholdUnit: 'money', operator: '>=' }
const fact = { title: 'Audited turnover', verified: true, factMetric: requirement.evaluationMetric, factAmount: 2000000, factCurrency: 'USD', factUnit: 'money', issuedAt: new Date('2026-01-01'), expiresAt: null }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  mocks.requirements.mockResolvedValue([requirement])
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', annualTurnoverUSD: 99999999, evidence: [fact], certifications: [], projectRefs: [], employees: [] })
  mocks.rates.mockResolvedValue([])
  mocks.review.mockResolvedValue(null)
  mocks.approved.mockResolvedValue(false)
})
afterEach(() => vi.useRealTimers())
it('passes only a reviewed structured threshold with verified current evidence', async () => {
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryPassed).toBe(1); expect(score.components[0].status).toBe('pass')
})
it.each([{ verified: false }, { expiresAt: new Date('2026-10-01') }, { issuedAt: new Date('2027-01-01') }, { factMetric: 'annual_turnover:2024' }])('does not promote invalid or unrelated evidence %j', async change => {
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', annualTurnoverUSD: 99999999, evidence: [{ ...fact, ...change }], certifications: [], projectRefs: [], employees: [] })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryPassed).toBe(0); expect(score.components[0].status).toBe('unknown')
})
it('rejects ambiguous legacy million/comma monetary text', async () => {
  mocks.requirements.mockResolvedValue([{ ...requirement, thresholdAmount: null, threshold: '1,5 million USD (~170 million BDT)' }])
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.components[0].status).toBe('unknown'); expect(score.total).toBe(0)
})
it('blocks a verified mandatory threshold failure including zero facts', async () => {
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', evidence: [{ ...fact, factAmount: 0 }] })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.blocked).toBe(true); expect(score.components[0].status).toBe('fail')
})
it('uses the latest applicable tenant rate, ignoring future and other tenant rates', async () => {
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', evidence: [{ ...fact, factAmount: 180000000, factCurrency: 'BDT' }] })
  mocks.rates.mockResolvedValue([
    { tenantId: 'tenant-a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 100, rateDate: new Date('2026-01-01') },
    { tenantId: 'tenant-a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 150, rateDate: new Date('2026-09-01') },
    { tenantId: 'tenant-a', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 1, rateDate: new Date('2027-01-01') },
    { tenantId: 'tenant-b', baseCurrency: 'USD', quoteCurrency: 'BDT', rate: 1, rateDate: new Date('2026-10-01') },
  ])
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.blocked).toBe(true); expect(score.components[0].reason).toContain('2026-09-01')
})
it('exposes missing FX as unknown without a hardcoded fallback', async () => {
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', evidence: [{ ...fact, factCurrency: 'BDT' }] })
  expect((await computeEligibilityScore('tender', 'company')).components[0].status).toBe('unknown')
})
it('does not promise operational compliance or treat generic OEM evidence as a pass', async () => {
  mocks.requirements.mockResolvedValue([{ criterion: 'Bid validity', isMandatory: true }, { criterion: 'OEM authorization for Cisco', isMandatory: true }])
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', evidence: [{ title: 'OEM letter', category: 'oem', verified: true }] })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryPassed).toBe(0); expect(score.components.map(c => c.status)).toEqual(['unknown', 'unknown'])
})
it('evaluates a private reviewed threshold without modifying canonical requirements', async () => {
  mocks.requirements.mockResolvedValue([{ criterion: requirement.criterion, category: 'financial', isMandatory: true }])
  mocks.review.mockResolvedValue({ itemsJson: JSON.stringify([{ ...requirement, category: 'financial' }]) })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryPassed).toBe(1)
  expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({ where: {
    tenantId: 'tenant-a', tenderId: 'tender', extraction: { reviewStatus: { in: ['approved', 'edited'] } },
  } }))
})
it('keeps canonical mandatory checks and adds extra private checks', async () => {
  mocks.review.mockResolvedValue({ itemsJson: JSON.stringify([{ ...requirement, criterion: 'Other requirement', thresholdAmount: 3000000 }]) })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryTotal).toBe(2); expect(score.mandatoryPassed).toBe(1); expect(score.blocked).toBe(true)
})
it('does not demote canonical mandatory checks through a tenant review', async () => {
  mocks.review.mockResolvedValue({ itemsJson: JSON.stringify([{ ...requirement, isMandatory: false, thresholdAmount: 3000000 }]) })
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryTotal).toBe(1); expect(score.blocked).toBe(true)
})
it.each([{ thresholdStatus: 'unreviewed' }, { thresholdCurrency: null }, { thresholdUnit: 'years' }, { operator: 'contains' }])('requires explicit reviewed and compatible thresholds %j', async change => {
  mocks.requirements.mockResolvedValue([{ ...requirement, ...change }])
  const score = await computeEligibilityScore('tender', 'company')
  expect(score.mandatoryUnknown).toBe(1); expect(score.mandatoryPassed).toBe(0)
})
it('does not cherry-pick passing evidence when verified facts conflict', async () => {
  mocks.company.mockResolvedValue({ tenantId: 'tenant-a', evidence: [fact, { ...fact, factAmount: 1000000 }] })
  expect((await computeEligibilityScore('tender', 'company')).components[0].status).toBe('unknown')
})
const pursuitFixture = () => ({ id: 'pursuit', tenantId: 'tenant-a', tenderId: 'tender', companyId: 'company',
  tender: { requirements: [{ ...requirement, id: 'req' }] }, company: { evidence: [{ ...fact, id: 'fact', companyId: 'company' }], certifications: [], projectRefs: [] },
  complianceItems: [{ requirementId: 'req', status: 'compliant', evidence: { ...fact, id: 'fact', companyId: 'company' } }],
  tasks: [{ id: 'task', status: 'done' }], bid: { tasks: [] }, approvals: [{ decision: 'approved', triggerType: 'bid_decision' }],
  proposals: [{ id: 'proposal', sections: [{ status: 'approved', hasGaps: false, content: 'Approved text', evidenceIds: '["fact"]' }] }],
})
it('readiness requires the complete submission approval gate, not any approved decision', async () => {
  mocks.pursuit.mockResolvedValue(pursuitFixture())
  const score = await computeSubmissionReadinessScore('pursuit')
  expect(score.components.find(c => c.criterion === 'Approval state')?.status).toBe('fail')
  expect(score.band).toBe('blocked')
  expect(mocks.approved).toHaveBeenCalledWith(expect.anything(), 'tenant-a', 'pursuit', 'proposal')
})
it('readiness includes pursuit tasks even when bid tasks are empty', async () => {
  mocks.pursuit.mockResolvedValue({ ...pursuitFixture(), tasks: [{ id: 'task', status: 'todo' }] })
  mocks.approved.mockResolvedValue(true)
  const score = await computeSubmissionReadinessScore('pursuit')
  expect(score.components.find(c => c.criterion === 'Task completion')?.score).toBe(0)
  expect(score.band).toBe('blocked')
})
it('readiness exposes missing mandatory documents and unknown eligibility', async () => {
  mocks.requirements.mockResolvedValue([{ ...requirement, id: 'document', category: 'document', thresholdAmount: null }])
  mocks.pursuit.mockResolvedValue({ ...pursuitFixture(), tender: { requirements: [{ ...requirement, id: 'document', category: 'document', thresholdAmount: null }] }, complianceItems: [] })
  mocks.approved.mockResolvedValue(true)
  const score = await computeSubmissionReadinessScore('pursuit')
  expect(score.components.find(c => c.criterion === 'Mandatory documents')?.status).toBe('fail')
  expect(score.band).toBe('blocked')
})
it('readiness reaches 100 only when eligibility, evidence, tasks, sections and approvals are satisfied', async () => {
  mocks.pursuit.mockResolvedValue(pursuitFixture())
  mocks.approved.mockResolvedValue(true)
  const score = await computeSubmissionReadinessScore('pursuit')
  expect(score.total).toBe(100); expect(score.band).toBe('high')
  expect(score.components.every(component => component.status === 'pass')).toBe(true)
})

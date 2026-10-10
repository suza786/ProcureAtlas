vi.mock('@/lib/usage-meter', () => ({ assertPursuitQuota: async () => {} }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { canAdvancePursuit, complianceSummary, initializePursuit, updateCompliance } from '@/lib/pursuit-workflow'

const company = vi.fn(), tender = vi.fn(), pursuit = vi.fn(), create = vi.fn(), requirement = vi.fn(), current = vi.fn(), evidence = vi.fn(), upsert = vi.fn()
const approvals = vi.fn(), proposals = vi.fn(), bid = vi.fn()
const tx = { outboxJob: { create: vi.fn().mockResolvedValue({ id: 'event' }) }, company: { findMany: company }, tender: { findUnique: tender }, pursuit: { findFirst: pursuit, create },
  requirement: { findFirst: requirement }, complianceItem: { findFirst: current, upsert }, evidence: { findFirst: evidence },
  approval: { updateMany: approvals }, proposal: { updateMany: proposals }, bid: { updateMany: bid } } as unknown as Prisma.TransactionClient

beforeEach(() => {
  vi.resetAllMocks()
  company.mockResolvedValue([{ id: 'company' }])
  tender.mockResolvedValue({ id: 'tender', valueUSD: 250000, requirements: [{ id: 'r1' }, { id: 'r2' }] })
  pursuit.mockResolvedValue(null)
  create.mockResolvedValue({ id: 'pursuit' })
  requirement.mockResolvedValue({ id: 'r1' })
  current.mockResolvedValue({ evidenceId: 'ev' })
  evidence.mockResolvedValue({ id: 'ev', companyId: 'company', verified: true, issuedAt: null, expiresAt: null, confidence: 0.9 })
  upsert.mockResolvedValue({ id: 'item' })
})

describe('pursuit creation', () => {
  it('initializes a draft bid and gaps atomically without assuming evidence or compliance', async () => {
    expect(await initializePursuit(tx, 'tenant', 'tender')).toEqual({ pursuit: { id: 'pursuit' }, created: true })
    expect(company).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant' }, take: 2 }))
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ estimatedValueUSD: 250000, companyId: 'company',
      bid: { create: { status: 'draft', submissionReady: false } },
      complianceItems: { create: [{ requirementId: 'r1', status: 'gap', confidence: 0 }, { requirementId: 'r2', status: 'gap', confidence: 0 }] },
    }) })
  })
  it('returns an existing pursuit without another write', async () => {
    pursuit.mockResolvedValue({ id: 'existing' })
    expect(await initializePursuit(tx, 'tenant', 'tender')).toEqual({ pursuit: { id: 'existing' }, created: false })
    expect(create).not.toHaveBeenCalled()
  })
  it('requires company selection when a tenant owns multiple companies', async () => {
    company.mockResolvedValue([{ id: 'first' }, { id: 'second' }])
    await expect(initializePursuit(tx, 'tenant', 'tender')).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })
  it('cannot choose a company outside the session tenant', async () => {
    company.mockResolvedValue([])
    await expect(initializePursuit(tx, 'tenant', 'tender', 'foreign')).rejects.toMatchObject({ status: 404 })
    expect(company).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', id: 'foreign' } }))
  })
  it('rejects nonexistent tenders before creating related records', async () => {
    tender.mockResolvedValue(null)
    await expect(initializePursuit(tx, 'tenant', 'missing')).rejects.toMatchObject({ status: 404 })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('pursuit progression', () => {
  it('requires qualification before bidding and submission before award outcomes', () => {
    expect(canAdvancePursuit('discovering', 'qualifying')).toBe(true)
    expect(canAdvancePursuit('qualifying', 'bidding')).toBe(true)
    expect(canAdvancePursuit('discovering', 'bidding')).toBe(false)
    expect(canAdvancePursuit('bidding', 'won')).toBe(false)
    expect(canAdvancePursuit('submitted', 'won')).toBe(true)
    expect(canAdvancePursuit('submitted', 'lost')).toBe(true)
    expect(canAdvancePursuit('won', 'bidding')).toBe(false)
  })
  it('blocks direct submission so proposal approvals cannot be bypassed', () => {
    for (const stage of ['discovering', 'qualifying', 'bidding', 'no_bid']) expect(canAdvancePursuit(stage, 'submitted')).toBe(false)
  })
})

describe('persisted compliance', () => {
  beforeEach(() => pursuit.mockResolvedValue({ companyId: 'company', tenderId: 'tender', stage: 'bidding' }))
  it('only accepts current verified evidence from the pursuit company', async () => {
    await updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'compliant' })
    expect(evidence).toHaveBeenCalledWith({ where: { id: 'ev', companyId: 'company', company: { tenantId: 'tenant' } } })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { pursuitId_requirementId: { pursuitId: 'pursuit', requirementId: 'r1' } } }))
  })
  it.each([
    { verified: false, issuedAt: null, expiresAt: null },
    { verified: true, issuedAt: null, expiresAt: new Date('2000-01-01') },
    { verified: true, issuedAt: new Date('2099-01-01'), expiresAt: null },
  ])('rejects invalid evidence for compliant status: %j', async record => {
    evidence.mockResolvedValue({ ...record, confidence: 0.9 })
    await expect(updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'compliant' })).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })
  it('cannot attach foreign company evidence even to a gap', async () => {
    evidence.mockResolvedValue(null)
    await expect(updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'gap', evidenceId: 'foreign' })).rejects.toMatchObject({ status: 404 })
    expect(upsert).not.toHaveBeenCalled()
  })
  it('rejects requirements from another tender', async () => {
    requirement.mockResolvedValue(null)
    await expect(updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'foreign', status: 'gap' })).rejects.toMatchObject({ status: 404 })
    expect(requirement).toHaveBeenCalledWith({ where: { id: 'foreign', tenderId: 'tender' } })
  })
  it('rejects foreign tenant pursuits before querying evidence', async () => {
    pursuit.mockResolvedValue(null)
    await expect(updateCompliance(tx, 'tenant', 'foreign', { requirementId: 'r1', status: 'gap' })).rejects.toMatchObject({ status: 404 })
    expect(evidence).not.toHaveBeenCalled()
  })
  it('does not permit clearing evidence while retaining a compliant claim', async () => {
    await expect(updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'compliant', evidenceId: null })).rejects.toMatchObject({ status: 400 })
  })
  it.each(['submitted', 'won', 'lost'])('locks compliance when pursuit is %s', async stage => {
    pursuit.mockResolvedValue({ companyId: 'company', tenderId: 'tender', stage })
    await expect(updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'gap' })).rejects.toMatchObject({ status: 409 })
    expect(upsert).not.toHaveBeenCalled()
  })
  it('revokes proposal approval and bid readiness after changing compliance', async () => {
    await updateCompliance(tx, 'tenant', 'pursuit', { requirementId: 'r1', status: 'gap', evidenceId: null })
    expect(approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', pursuitId: 'pursuit', triggerType: { in: ['submission', 'pricing', 'legal'] } }, data: { decision: 'pending', decidedAt: null, reason: null } }))
    expect(proposals).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'draft', revision: { increment: 1 } } }))
    expect(bid).toHaveBeenCalledWith({ where: { pursuitId: 'pursuit' }, data: { status: 'draft', submissionReady: false, submittedAt: null } })
  })
  it('summarizes saved statuses and excludes not-applicable rows from coverage', () => {
    expect(complianceSummary([{ status: 'compliant' }, { status: 'partial' }, { status: 'gap' }, { status: 'not_applicable' }])).toEqual({ total: 4, compliant: 1, partial: 1, gap: 1, not_applicable: 1, coveragePct: 50 })
  })
})

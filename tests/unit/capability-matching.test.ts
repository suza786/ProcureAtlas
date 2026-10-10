import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ facts: vi.fn(), evidence: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { capabilityFact: { findMany: mocks.facts }, evidence: { findMany: mocks.evidence } } }))
import { capabilitySummary, currentCapabilityFacts, evidenceSupportsCapability } from '@/lib/capability-facts'
import { computePartnerMatch, computeTenderCompanyMatch } from '@/lib/matching'
const company = { companyId: 'company-a', name: 'Cyber Tech', country: 'BD', annualTurnoverUSD: null, description: 'IT security consulting', certifications: [], projectReferences: [], sectors: [] }
const fact = { id: 'fact-a', tenantId: 'tenant-a', companyId: 'company-a', organizationId: null, kind: 'sector', value: 'Cyber', evidenceId: 'evidence-a', amount: null, currency: null }
beforeEach(() => { vi.clearAllMocks(); mocks.facts.mockResolvedValue([fact]); mocks.evidence.mockResolvedValue([{ id: 'evidence-a', companyId: 'company-a', category: 'catalogue', verified: true, issuedAt: new Date('2025-01-01'), expiresAt: null }]) })
describe('evidence-backed capabilities', () => {
  it('scopes facts and evidence to tenant/company and separates supplier facts', async () => {
    expect(await currentCapabilityFacts('tenant-a', 'company-a', 'supplier-a')).toHaveLength(1)
    expect(mocks.facts).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a', companyId: 'company-a', OR: [{ organizationId: 'supplier-a' }] }, take: 501 }))
    expect(mocks.evidence).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a', company: { tenantId: 'tenant-a' } }) }))
  })
  it.each([{ verified: false }, { expiresAt: new Date(0) }, { issuedAt: new Date('2040-01-01') }])('excludes unsupported evidence %j', async changes => {
    mocks.evidence.mockResolvedValue([{ id: 'evidence-a', verified: true, ...changes }])
    expect(await currentCapabilityFacts('tenant-a', 'company-a')).toEqual([])
  })
  it('does not invent sectors, certifications, turnover or JV history', () => {
    expect(capabilitySummary([])).toEqual({ sectors: [], certifications: [], projectSectors: [], jvHistory: [], annualTurnoverUSD: null })
    const match = computePartnerMatch(company, { id: 'supplier-a', name: 'Cyber Security Network Consultants', country: null, sectors: [], certifications: [], description: 'IT Construction' })
    expect(match.total).toBe(0)
    expect(match.dimensions.every(item => item.status === 'unknown')).toBe(true)
    expect(match.complementaryCapabilities).toEqual([])
  })
  it('marks missing tender capability dimensions unknown and gives no default credit', () => {
    const score = computeTenderCompanyMatch({ tenderId: 'tender', title: 'Cyber project', description: null, sector: 'Cyber', country: 'BD', market: 'BD', valueUSD: 10, requirements: [] }, company)
    expect(score.dimensions.filter(item => item.name !== 'Geography').every(item => item.status === 'unknown' && item.score === 0)).toBe(true)
  })
  it('uses only explicitly recorded USD turnover and paired JV facts', () => {
    expect(capabilitySummary([{ ...fact, kind: 'turnover', amount: 1000, currency: 'BDT' }]).annualTurnoverUSD).toBeNull()
    const match = computePartnerMatch({ ...company, annualTurnoverUSD: 100, jvHistory: ['supplier-a'] }, { id: 'supplier-a', name: 'Supplier', country: null, sectors: [], certifications: [], description: null, annualTurnoverUSD: 50 })
    expect(match.dimensions.find(item => item.name === 'Combined capacity')).toMatchObject({ status: 'known', score: 0.5 })
    expect(match.dimensions.find(item => item.name === 'Prior JV history')).toMatchObject({ status: 'known', score: 1 })
  })
  it('requires compatible evidence categories and exact reviewed turnover facts', () => {
    expect(evidenceSupportsCapability({ kind: 'certification', amount: null, currency: null }, { category: 'financial' })).toBe(false)
    expect(evidenceSupportsCapability({ kind: 'project_sector', amount: null, currency: null }, { category: 'certification' })).toBe(false)
    const turnover = { kind: 'turnover', amount: 100, currency: 'USD' }
    expect(evidenceSupportsCapability(turnover, { category: 'financial', factMetric: 'annual_turnover:2025', factAmount: 100, factCurrency: 'USD' })).toBe(true)
    expect(evidenceSupportsCapability(turnover, { category: 'financial', factMetric: 'annual_turnover:2025', factAmount: 101, factCurrency: 'USD' })).toBe(false)
  })
  it('fails explicitly instead of silently truncating excessive fact sets', async () => {
    mocks.facts.mockResolvedValue(Array.from({ length: 501 }, () => fact))
    await expect(currentCapabilityFacts('tenant-a', 'company-a')).rejects.toMatchObject({ status: 422 })
    expect(mocks.evidence).not.toHaveBeenCalled()
  })
})

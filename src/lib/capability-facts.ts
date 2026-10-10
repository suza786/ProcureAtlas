import { db } from './db'
import { isCurrentVerifiedEvidence } from './requirement-evaluation'

export type CapabilityKind = 'sector' | 'certification' | 'turnover' | 'jv_history' | 'project_sector'
export interface SupportedCapability { id: string; tenantId: string; companyId: string; organizationId: string | null; kind: string; value: string; amount: number | null; currency: string | null; evidenceId: string }

export const capabilityEvidenceCategories: Record<string, string[]> = { sector: ['catalogue', 'project', 'reference', 'past_win', 'proposal_library', 'facility', 'equipment'], certification: ['certification'], turnover: ['financial'], jv_history: ['partnership', 'project', 'reference'], project_sector: ['project', 'reference', 'past_win'] }
export function evidenceSupportsCapability(fact: Pick<SupportedCapability, 'kind' | 'amount' | 'currency'>, evidence: { category: string; factAmount?: number | null; factCurrency?: string | null; factMetric?: string | null }) {
  if (!capabilityEvidenceCategories[fact.kind]?.includes(evidence.category)) return false
  if (fact.kind === 'turnover') return evidence.factMetric?.startsWith('annual_turnover') === true && evidence.factAmount === fact.amount && evidence.factCurrency === fact.currency
  return true
}

/** Only explicitly recorded facts with current verified evidence belonging to this tenant/company are scored. */
export async function currentCapabilityFacts(tenantId: string, companyId: string, organizationId: string | null = null): Promise<SupportedCapability[]> {
  return currentCapabilityFactsForOrganizations(tenantId, companyId, [organizationId])
}

/** One bounded fact read and one bounded evidence read for all selected suppliers. */
export async function currentCapabilityFactsForOrganizations(tenantId: string, companyId: string, organizationIds: Array<string | null>): Promise<SupportedCapability[]> {
  const facts = await db.capabilityFact.findMany({ where: { tenantId, companyId, OR: organizationIds.map(organizationId => ({ organizationId })) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 501 })
  if (facts.length > 500) throw new Response('Matching supports at most 500 capability facts per selected company/supplier set; narrow the selected facts', { status: 422 })
  if (!facts.length) return []
  const evidence = await db.evidence.findMany({ where: { id: { in: [...new Set(facts.map(fact => fact.evidenceId))] }, companyId, company: { tenantId } } })
  return facts.filter(fact => evidence.some(item => item.id === fact.evidenceId && item.companyId === companyId && isCurrentVerifiedEvidence(item) && evidenceSupportsCapability(fact, item)))
}

export function capabilitySummary(facts: SupportedCapability[]) {
  const values = (kind: string) => [...new Set(facts.filter(fact => fact.kind === kind).map(fact => fact.value))]
  const turnover = facts.find(fact => fact.kind === 'turnover' && fact.currency === 'USD' && fact.amount != null && Number.isFinite(fact.amount) && fact.amount > 0)
  return { sectors: values('sector'), certifications: values('certification'), projectSectors: values('project_sector'), jvHistory: values('jv_history'), annualTurnoverUSD: turnover?.amount ?? null }
}

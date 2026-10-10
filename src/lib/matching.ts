import { db } from './db'
import { capabilitySummary, currentCapabilityFacts } from './capability-facts'

export interface MatchDimension { name: string; weight: number; score: number; status: 'known' | 'unknown'; reason: string }
export interface MatchScore { total: number; band: 'high' | 'medium' | 'low'; dimensions: MatchDimension[] }
export interface TenderMatchInput { tenderId: string; title: string; description: string | null; sector: string; country: string; market: string; valueUSD: number | null; requirements: Array<{ category: string; criterion: string; threshold: string | null }> }
export interface CompanyMatchInput { companyId: string; name: string; country: string; annualTurnoverUSD: number | null; description: string | null; certifications: string[]; projectReferences: Array<{ title: string; clientType: string | null; sector: string }>; sectors: string[]; jvHistory?: string[] }
export interface PartnerMatchScore extends MatchScore { complementaryCapabilities: string[]; geographicOverlap: string[] }

function dimension(name: string, weight: number, known: boolean, score: number, reason: string): MatchDimension {
  return { name, weight, score: known ? score : 0, status: known ? 'known' : 'unknown', reason: known ? reason : `Unknown: ${reason}` }
}
function result(dimensions: MatchDimension[]): MatchScore {
  const total = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight * 100, 0))
  return { total, band: total >= 70 ? 'high' : total >= 45 ? 'medium' : 'low', dimensions }
}

/** Inputs contain explicitly recorded, current evidence-backed capability facts. Missing facts earn no credit. */
export function computeTenderCompanyMatch(tender: TenderMatchInput, company: CompanyMatchInput): MatchScore {
  const sectorMatch = company.sectors.includes(tender.sector)
  const relevantProjects = company.projectReferences.filter(project => project.sector === tender.sector)
  const sizeKnown = (tender.valueUSD ?? 0) > 0 && (company.annualTurnoverUSD ?? 0) > 0
  const ratio = sizeKnown ? tender.valueUSD! / company.annualTurnoverUSD! : 0
  const geoKnown = !!tender.country && !!company.country
  return result([
    dimension('Sector match', 0.3, company.sectors.length > 0, sectorMatch ? 1 : 0, company.sectors.length ? `Recorded sectors: ${company.sectors.join(', ')}; tender sector: ${tender.sector}.` : 'no current evidence-backed sector facts.'),
    dimension('Capability depth', 0.2, company.certifications.length > 0, Math.min(company.certifications.length / 5, 1), company.certifications.length ? `Current evidence-backed certifications: ${company.certifications.join(', ')}. Individual tender requirements still need evaluation.` : 'no current evidence-backed certifications.'),
    dimension('Geography', 0.15, geoKnown, company.country === tender.country ? 1 : 0, geoKnown ? `Recorded countries: ${company.country} and ${tender.country}; country alignment does not establish legal eligibility.` : 'company or tender country is missing.'),
    dimension('Contract size fit', 0.2, sizeKnown, ratio <= 0.3 ? 1 : ratio <= 0.7 ? 0.8 : ratio <= 1 ? 0.5 : 0.2, sizeKnown ? `Tender value is ${Math.round(ratio * 100)}% of evidence-backed USD turnover.` : 'tender value or evidence-backed USD turnover is missing.'),
    dimension('Relevant project experience', 0.15, company.projectReferences.length > 0, Math.min(relevantProjects.length / 3, 1), company.projectReferences.length ? `${relevantProjects.length} evidence-backed project sector fact(s) match ${tender.sector}.` : 'no current evidence-backed project sector facts.'),
  ])
}

export function computePartnerMatch(tenantCompany: CompanyMatchInput, partner: { id: string; name: string; country: string | null; sectors: string[]; certifications: string[]; description: string | null; annualTurnoverUSD?: number | null; jvHistory?: string[] }): PartnerMatchScore {
  const sectorsKnown = tenantCompany.sectors.length > 0 && partner.sectors.length > 0
  const complementary = sectorsKnown ? partner.sectors.filter(sector => !tenantCompany.sectors.includes(sector)) : []
  const certificatesKnown = tenantCompany.certifications.length > 0 && partner.certifications.length > 0
  const certificates = certificatesKnown ? partner.certifications.filter(cert => !tenantCompany.certifications.some(own => own.toLowerCase() === cert.toLowerCase())) : []
  const countriesKnown = !!tenantCompany.country && !!partner.country
  const geography = countriesKnown && tenantCompany.country === partner.country ? [partner.country!] : []
  const capacityKnown = (tenantCompany.annualTurnoverUSD ?? 0) > 0 && (partner.annualTurnoverUSD ?? 0) > 0
  const priorJv = !!(tenantCompany.jvHistory?.includes(partner.id) || partner.jvHistory?.includes(tenantCompany.companyId))
  const dimensions = [
    dimension('Complementary capabilities', 0.3, sectorsKnown, Math.min(complementary.length / 3, 1), sectorsKnown ? `Evidence-backed complementary sectors: ${complementary.join(', ') || 'none'}.` : 'current evidence-backed sector facts are missing.'),
    dimension('Geographic alignment', 0.2, countriesKnown, geography.length ? 0.8 : 0, countriesKnown ? `Recorded countries: ${tenantCompany.country} and ${partner.country}.` : 'supplier country is missing.'),
    dimension('Certification complementarity', 0.2, certificatesKnown, Math.min(certificates.length / 3, 1), certificatesKnown ? `Evidence-backed additional certifications: ${certificates.join(', ') || 'none'}.` : 'current evidence-backed certification facts are missing.'),
    dimension('Combined capacity', 0.15, capacityKnown, capacityKnown ? Math.min(partner.annualTurnoverUSD! / tenantCompany.annualTurnoverUSD!, 1) : 0, capacityKnown ? `Recorded combined annual turnover: USD ${(tenantCompany.annualTurnoverUSD! + partner.annualTurnoverUSD!).toLocaleString()}. This does not guarantee bid capacity.` : 'current evidence-backed USD turnover is missing.'),
    dimension('Prior JV history', 0.15, priorJv, priorJv ? 1 : 0, priorJv ? 'Current evidence-backed JV history is recorded for this pairing.' : 'no current evidence-backed JV record for this pairing.'),
  ]
  return { ...result(dimensions), complementaryCapabilities: complementary, geographicOverlap: geography }
}

export async function computeTenderMatchForTenant(tenderId: string, tenantId: string): Promise<MatchScore | null> {
  const [tender, company] = await Promise.all([
    db.tender.findUnique({ where: { id: tenderId }, include: { requirements: { select: { category: true, criterion: true, threshold: true } } } }),
    db.company.findFirst({ where: { tenantId } }),
  ])
  if (!tender || !company) return null
  const facts = capabilitySummary(await currentCapabilityFacts(tenantId, company.id))
  return computeTenderCompanyMatch({ tenderId: tender.id, title: tender.title, description: tender.description, sector: tender.sector, country: tender.country, market: tender.market, valueUSD: tender.valueUSD, requirements: tender.requirements }, { companyId: company.id, name: company.name, country: company.country, description: company.description, annualTurnoverUSD: facts.annualTurnoverUSD, sectors: facts.sectors, certifications: facts.certifications, jvHistory: facts.jvHistory, projectReferences: facts.projectSectors.map(sector => ({ title: sector, clientType: null, sector })) })
}

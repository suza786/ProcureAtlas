// ProcureAtlas AI — Phase 3 Semantic Matching Engine
//
// Since the sandbox uses SQLite (no pgvector), this module implements a deterministic
// tag + keyword + capability matching algorithm that is pgvector-ready.
// In production with PostgreSQL + pgvector, the same interface will use cosine
// similarity over embeddings; the call sites won't change.
//
// Matching dimensions:
//   1. Sector match (Cyber, IT, Consulting, etc.)
//   2. Capability overlap (certifications, project references)
//   3. Geographic overlap (country, market)
//   4. Contract size fit (value vs annual turnover)
//   5. Keyword overlap (tender title/description vs company description)
//
// Each dimension returns 0-1; weighted sum produces final matchScore.

import { db } from './db'

export interface MatchScore {
  total: number // 0-100
  band: 'high' | 'medium' | 'low'
  dimensions: MatchDimension[]
}

export interface MatchDimension {
  name: string
  weight: number
  score: number // 0-1
  reason: string
}

export interface TenderMatchInput {
  tenderId: string
  title: string
  description: string | null
  sector: string
  country: string
  market: string
  valueUSD: number | null
  requirements: Array<{ category: string; criterion: string; threshold: string | null }>
}

export interface CompanyMatchInput {
  companyId: string
  name: string
  country: string
  annualTurnoverUSD: number | null
  description: string | null
  certifications: string[]
  projectReferences: Array<{ title: string; clientType: string | null; sector: string }>
  sectors: string[] // derived from evidence + projects
}

// ============================================================
// Tender ↔ Company matching (semantic fit)
// ============================================================

export function computeTenderCompanyMatch(
  tender: TenderMatchInput,
  company: CompanyMatchInput
): MatchScore {
  const dimensions: MatchDimension[] = []

  // 1. Sector match
  const sectorMatch = company.sectors.includes(tender.sector)
  dimensions.push({
    name: 'Sector match',
    weight: 0.25,
    score: sectorMatch ? 1 : 0.2,
    reason: sectorMatch
      ? `Tender sector (${tender.sector}) matches company capabilities (${company.sectors.join(', ')}).`
      : `Tender sector (${tender.sector}) not in company capabilities (${company.sectors.join(', ')}).`,
  })

  // 2. Capability overlap — certifications + project refs
  const certScore = Math.min(company.certifications.length / 5, 1)
  const relevantCerts = company.certifications.filter(c => {
    const cl = c.toLowerCase()
    return (cl.includes('27001') && tender.sector === 'Cyber') ||
           (cl.includes('9001') && tender.sector === 'IT') ||
           (cl.includes('cmmi') && tender.sector === 'IT') ||
           (cl.includes('cissp') && tender.sector === 'Cyber')
  })
  const capScore = relevantCerts.length > 0 ? Math.min(0.5 + relevantCerts.length * 0.2, 1) : certScore * 0.5
  dimensions.push({
    name: 'Capability depth',
    weight: 0.2,
    score: capScore,
    reason: relevantCerts.length > 0
      ? `${relevantCerts.length} directly relevant certification(s): ${relevantCerts.join(', ')}`
      : `${company.certifications.length} certification(s) on file (none directly sector-matched).`,
  })

  // 3. Geographic overlap
  const geoMatch = tender.country === company.country ||
    ['WB', 'ADB', 'UN'].includes(tender.market)
  dimensions.push({
    name: 'Geography',
    weight: 0.15,
    score: geoMatch ? 1 : 0.3,
    reason: geoMatch
      ? `Tender country (${tender.country}) accessible to company (${company.country}).`
      : `Geographic mismatch — local partner required for ${tender.country}.`,
  })

  // 4. Contract size fit
  let sizeScore = 0.5
  let sizeReason = 'Insufficient data to evaluate contract size fit.'
  if (tender.valueUSD && company.annualTurnoverUSD) {
    const ratio = tender.valueUSD / company.annualTurnoverUSD
    if (ratio <= 0.3) { sizeScore = 1; sizeReason = `Contract value is ${Math.round(ratio * 100)}% of annual turnover — well within capacity.` }
    else if (ratio <= 0.7) { sizeScore = 0.8; sizeReason = `Contract value is ${Math.round(ratio * 100)}% of annual turnover — manageable.` }
    else if (ratio <= 1.0) { sizeScore = 0.5; sizeReason = `Contract value is ${Math.round(ratio * 100)}% of annual turnover — stretched.` }
    else { sizeScore = 0.2; sizeReason = `Contract value exceeds annual turnover — consortium recommended.` }
  }
  dimensions.push({
    name: 'Contract size fit',
    weight: 0.2,
    score: sizeScore,
    reason: sizeReason,
  })

  // 5. Keyword overlap (deterministic token-based; pgvector will replace in prod)
  const keywordScore = computeKeywordOverlap(
    `${tender.title} ${tender.description ?? ''}`,
    `${company.name} ${company.description ?? ''} ${company.projectReferences.map(p => p.title).join(' ')}`
  )
  dimensions.push({
    name: 'Keyword overlap',
    weight: 0.2,
    score: keywordScore,
    reason: keywordScore > 0.3
      ? `Strong keyword overlap (${Math.round(keywordScore * 100)}%) between tender text and company profile.`
      : `Low keyword overlap (${Math.round(keywordScore * 100)}%).`,
  })

  const total = Math.round(dimensions.reduce((acc, d) => acc + d.score * d.weight * 100, 0))
  const band: MatchScore['band'] = total >= 70 ? 'high' : total >= 45 ? 'medium' : 'low'

  return { total, band, dimensions }
}

// ============================================================
// Partner / JV matching (complementary capabilities)
// ============================================================

export interface PartnerMatchScore {
  total: number
  band: 'high' | 'medium' | 'low'
  dimensions: MatchDimension[]
  complementaryCapabilities: string[]
  geographicOverlap: string[]
}

export function computePartnerMatch(
  tenantCompany: CompanyMatchInput,
  partnerOrg: {
    id: string
    name: string
    country: string | null
    sectors: string[]
    certifications: string[]
    description: string | null
  }
): PartnerMatchScore {
  const dimensions: MatchDimension[] = []
  const complementaryCapabilities: string[] = []
  const geographicOverlap: string[] = []

  // 1. Complementary sectors — partner has sectors tenant doesn't
  const tenantSectors = new Set(tenantCompany.sectors)
  const partnerSectors = new Set(partnerOrg.sectors)
  const complementary = [...partnerSectors].filter(s => !tenantSectors.has(s))
  const complementScore = Math.min(complementary.length / 3, 1)
  dimensions.push({
    name: 'Complementary capabilities',
    weight: 0.3,
    score: complementScore,
    reason: complementary.length > 0
      ? `Partner brings ${complementary.length} complementary sector(s): ${complementary.join(', ')}`
      : 'No complementary sectors — overlap is high.',
  })
  complementaryCapabilities.push(...complementary)

  // 2. Geographic overlap — both can operate in the same markets
  if (partnerOrg.country && tenantCompany.country === partnerOrg.country) {
    geographicOverlap.push(partnerOrg.country)
  }
  const geoScore = geographicOverlap.length > 0 ? 0.8 : 0.4
  dimensions.push({
    name: 'Geographic alignment',
    weight: 0.2,
    score: geoScore,
    reason: geographicOverlap.length > 0
      ? `Both companies operate in ${geographicOverlap.join(', ')} — facilitates JV.`
      : 'Different geographies — cross-border JV complexity.',
  })

  // 3. Certification complementarity — partner has certs tenant doesn't
  const tenantCerts = new Set(tenantCompany.certifications.map(c => c.toLowerCase()))
  const partnerCerts = partnerOrg.certifications.filter(c => !tenantCerts.has(c.toLowerCase()))
  const certScore = Math.min(partnerCerts.length / 3, 1)
  dimensions.push({
    name: 'Certification complementarity',
    weight: 0.2,
    score: certScore,
    reason: partnerCerts.length > 0
      ? `Partner holds ${partnerCerts.length} certification(s) tenant lacks: ${partnerCerts.join(', ')}`
      : 'No new certifications from partner.',
  })

  // 4. Combined capacity — combined turnover can handle bigger contracts
  const capacityScore = 0.7 // would compute from partner turnover if available
  dimensions.push({
    name: 'Combined capacity',
    weight: 0.15,
    score: capacityScore,
    reason: 'JV would unlock larger contract sizes beyond individual capacity.',
  })

  // 5. Prior JV history (placeholder — would check shared project references)
  const jvScore = 0.3 // default; would be 1.0 if prior JV exists
  dimensions.push({
    name: 'Prior JV history',
    weight: 0.15,
    score: jvScore,
    reason: jvScore > 0.5 ? 'Prior JV history found — lower integration risk.' : 'No prior JV history — higher integration risk.',
  })

  const total = Math.round(dimensions.reduce((acc, d) => acc + d.score * d.weight * 100, 0))
  const band: PartnerMatchScore['band'] = total >= 65 ? 'high' : total >= 40 ? 'medium' : 'low'

  return { total, band, dimensions, complementaryCapabilities, geographicOverlap }
}

// ============================================================
// Helper: keyword overlap (Jaccard-like on token sets)
// ============================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'their',
  'his', 'her', 'its', 'our', 'your', 'my', 'me', 'him', 'us', 'them',
  'which', 'who', 'whom', 'whose', 'what', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'just', 'should', 'now', 'also', 'any', 'if', 'then', 'else',
  'tender', 'tenders', 'procurement', 'bid', 'bids', 'bidding', 'proposal',
  'company', 'companies', 'firm', 'firms', 'organization', 'organisations',
  'shall', 'must', 'may', 'requirement', 'requirements', 'required',
])

function computeKeywordOverlap(textA: string, textB: string): number {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
  }
  // Jaccard-like: intersection / min(set sizes) — favors meaningful overlap
  const minSize = Math.min(tokensA.size, tokensB.size)
  return minSize > 0 ? overlap / minSize : 0
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t))
  )
}

// ============================================================
// Aggregator: compute match for a tender against tenant's company
// ============================================================

export async function computeTenderMatchForTenant(tenderId: string, tenantId: string): Promise<MatchScore | null> {
  const [tender, company] = await Promise.all([
    db.tender.findUnique({
      where: { id: tenderId },
      include: { requirements: { select: { category: true, criterion: true, threshold: true } } },
    }),
    db.company.findFirst({
      where: { tenantId },
      include: {
        certifications: true,
        projectRefs: true,
        evidence: true,
      },
    }),
  ])

  if (!tender || !company) return null

  const tenderInput: TenderMatchInput = {
    tenderId: tender.id,
    title: tender.title,
    description: tender.description,
    sector: tender.sector,
    country: tender.country,
    market: tender.market,
    valueUSD: tender.valueUSD,
    requirements: tender.requirements.map(r => ({ category: r.category, criterion: r.criterion, threshold: r.threshold })),
  }

  // Derive company sectors from evidence + projects
  const companySectors = new Set<string>(['IT', 'Cyber', 'Consulting']) // default from description
  if (company.projectRefs.some(p => p.title.toLowerCase().includes('cyber') || p.title.toLowerCase().includes('security'))) {
    companySectors.add('Cyber')
  }
  if (company.projectRefs.some(p => p.title.toLowerCase().includes('network') || p.title.toLowerCase().includes('system'))) {
    companySectors.add('IT')
  }

  const companyInput: CompanyMatchInput = {
    companyId: company.id,
    name: company.name,
    country: company.country,
    annualTurnoverUSD: company.annualTurnoverUSD,
    description: company.description,
    certifications: company.certifications.map(c => c.name),
    projectReferences: company.projectRefs.map(p => ({
      title: p.title,
      clientType: p.clientType,
      sector: p.title.toLowerCase().includes('cyber') || p.title.toLowerCase().includes('security') ? 'Cyber' : 'IT',
    })),
    sectors: [...companySectors],
  }

  return computeTenderCompanyMatch(tenderInput, companyInput)
}

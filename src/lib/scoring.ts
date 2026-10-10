// ProcureAtlas AI — Deterministic Scoring Engine
// Principle: "AI is not the source of truth" — scores are deterministic, explainable, evidence-grounded.
// No LLM calls. Every score returns its component breakdown for auditability.

import { db } from './db'
import type { Prisma } from '@prisma/client'
import { submissionApproved } from './approval-workflow'
import { evidenceIdsFromJson } from './proposal-integrity'
import { evaluateRequirement, isCurrentVerifiedEvidence } from './requirement-evaluation'
import { loadTenantEvaluationRequirements } from './tenant-requirement-evaluation'
import { capabilitySummary, currentCapabilityFacts } from './capability-facts'

export type ScoreBand = 'high' | 'medium' | 'low' | 'blocked'

export interface ScoreComponent {
  criterion: string
  weight: number
  score: number // 0-1
  status: 'pass' | 'partial' | 'fail' | 'unknown'
  reason: string
}

export interface EligibilityScore {
  total: number // 0-100
  band: ScoreBand
  mandatoryPassed: number
  mandatoryTotal: number
  mandatoryUnknown?: number
  components: ScoreComponent[]
  blocked: boolean
  blockedReason?: string
}

export interface OpportunityFitScore {
  total: number // 0-100
  band: ScoreBand
  components: ScoreComponent[]
}

export interface SubmissionReadinessScore {
  total: number // 0-100
  band: ScoreBand
  components: ScoreComponent[]
}

export interface ScoringResult {
  tenderId: string
  tenderTitle: string
  eligibility: EligibilityScore
  opportunityFit: OpportunityFitScore
  submissionReadiness: SubmissionReadinessScore | null
  pursuitId: string | null
  generatedAt: string
  engine: 'deterministic-v1'
}

const band = (total: number, blocked = false): ScoreBand => {
  if (blocked) return 'blocked'
  if (total >= 75) return 'high'
  if (total >= 50) return 'medium'
  return 'low'
}

// Eligibility scoring: hard gates. Any mandatory failure = blocked.
export async function computeEligibilityScore(
  tenderId: string,
  companyId: string,
  client: Pick<Prisma.TransactionClient, 'requirement' | 'company' | 'currencyRate' | 'tenantRequirementReview'> = db
): Promise<EligibilityScore> {
  const requirements = await client.requirement.findMany({ where: { tenderId } })
  const company = await client.company.findUnique({
    where: { id: companyId },
    include: {
      certifications: true,
      projectRefs: true,
      evidence: true,
      employees: true,
    },
  })

  if (!company) {
    return {
      total: 0,
      band: 'blocked',
      mandatoryPassed: 0,
      mandatoryTotal: 0,
      components: [],
      blocked: true,
      blockedReason: 'Company profile not found.',
    }
  }

  const asOf = new Date()
  const evaluatedRequirements = await loadTenantEvaluationRequirements(company.tenantId, tenderId, requirements, client)
  const rates = await client.currencyRate.findMany({
    where: { tenantId: company.tenantId, rateDate: { lte: asOf } },
    orderBy: { rateDate: 'desc' },
  })
  const components: ScoreComponent[] = []
  let mandatoryTotal = 0
  let mandatoryPassed = 0
  const failures: string[] = []
  for (const requirement of evaluatedRequirements) {
    if (!requirement.isMandatory) continue
    mandatoryTotal++
    const evaluation = evaluateRequirement(requirement, company.evidence, rates, company.tenantId, asOf)
    if (evaluation.status === 'pass') mandatoryPassed++
    if (evaluation.status === 'fail') failures.push(requirement.criterion)
    components.push({ criterion: requirement.criterion, weight: 1, ...evaluation })
  }
  const blocked = failures.length > 0
  const total = mandatoryTotal === 0 ? 0 : Math.round(mandatoryPassed / mandatoryTotal * 100)
  return {
    total, band: band(total, blocked), mandatoryPassed, mandatoryTotal,
    mandatoryUnknown: components.filter(component => component.status === 'unknown').length,
    components, blocked,
    blockedReason: blocked ? 'Mandatory requirements not satisfied: ' + failures.join('; ') + '.' : undefined,
  }
}

// Opportunity Fit: strategic relevance scoring
export async function computeOpportunityFitScore(
  tenderId: string,
  companyId: string
): Promise<OpportunityFitScore> {
  const [tender, company] = await Promise.all([
    db.tender.findUnique({ where: { id: tenderId } }),
    db.company.findUnique({ where: { id: companyId }, include: { projectRefs: true, certifications: true } }),
  ])

  const components: ScoreComponent[] = []

  if (!tender || !company) {
    return { total: 0, band: 'low', components }
  }

  // Sector match
  const facts = capabilitySummary(await currentCapabilityFacts(company.tenantId, company.id))
  const companySectors = facts.sectors
  const sectorMatch = companySectors.includes(tender.sector)
  components.push({
    criterion: 'Sector match',
    weight: 0.25,
    score: sectorMatch ? 1 : 0,
    status: companySectors.length ? sectorMatch ? 'pass' : 'fail' : 'unknown',
    reason: companySectors.length ? `Tender sector (${tender.sector}); current evidence-backed sectors: ${companySectors.join(', ')}.` : 'No current evidence-backed sector facts.',
  })

  // Geography
  const geoMatch = tender.country === company.country
  components.push({
    criterion: 'Geography',
    weight: 0.15,
    score: geoMatch ? 1 : 0.3,
    status: geoMatch ? 'pass' : 'partial',
    reason: geoMatch ? `Tender country (${tender.country}) accessible to company (${company.country}).` : `Geographic mismatch; local partner required.`,
  })

  // Contract size
  const valueUSD = tender.valueUSD ?? 0
  const turnover = facts.annualTurnoverUSD ?? 0
  let sizeScore = 0
  let sizeStatus: ScoreComponent['status'] = 'unknown'
  let sizeReason = ''
  if (turnover > 0 && valueUSD > 0) {
    const ratio = valueUSD / turnover
    if (ratio <= 0.5) { sizeScore = 1; sizeStatus = 'pass'; sizeReason = `Contract value USD ${valueUSD.toLocaleString()} is comfortably within capacity (turnover USD ${turnover.toLocaleString()}).` }
    else if (ratio <= 1) { sizeScore = 0.7; sizeStatus = 'pass'; sizeReason = `Contract value ~${(ratio * 100).toFixed(0)}% of annual turnover; manageable.` }
    else { sizeScore = 0.3; sizeStatus = 'fail'; sizeReason = `Contract value exceeds annual turnover; consortium recommended.` }
  } else {
    sizeReason = 'Insufficient data to evaluate contract size fit.'
  }
  components.push({ criterion: 'Contract size', weight: 0.2, score: sizeScore, status: sizeStatus, reason: sizeReason })

  // Capability match (certifications overlap with sector)
  const certCount = facts.certifications.length
  const certScore = Math.min(certCount / 5, 1)
  components.push({
    criterion: 'Capability depth',
    weight: 0.15,
    score: certScore,
    status: certCount === 0 ? 'unknown' : certScore >= 0.8 ? 'pass' : certScore >= 0.4 ? 'partial' : 'fail',
    reason: `${certCount} current evidence-backed certification fact(s).`,
  })

  // Historical experience
  const govRefs = facts.projectSectors.filter(sector => sector === tender.sector).length
  const expScore = Math.min(govRefs / 3, 1)
  components.push({
    criterion: 'Relevant project experience',
    weight: 0.15,
    score: expScore,
    status: facts.projectSectors.length === 0 ? 'unknown' : expScore >= 0.66 ? 'pass' : expScore >= 0.33 ? 'partial' : 'fail',
    reason: `${govRefs} current evidence-backed project sector fact(s) match the tender sector.`,
  })

  // Strategic priority (heuristic: Cyber sector + BD/SG market = strategic)
  components.push({
    criterion: 'Strategic priority',
    weight: 0.1,
    score: 0,
    status: 'unknown',
    reason: 'No explicit tenant strategic priority has been recorded.',
  })

  const total = Math.round(components.reduce((acc, c) => acc + c.score * c.weight * 100, 0))
  return { total, band: band(total), components }
}

// Readiness uses the same verified eligibility and submission approval gates as submission.
export async function computeSubmissionReadinessScore(pursuitId: string): Promise<SubmissionReadinessScore> {
  return db.$transaction(async tx => {
    const pursuit = await tx.pursuit.findUnique({ where: { id: pursuitId }, include: {
      tender: { include: { requirements: true } },
      company: { include: { evidence: true, certifications: true, projectRefs: true } },
      complianceItems: { include: { evidence: true } }, tasks: true,
      proposals: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 1, include: { sections: true } },
    } })
    if (!pursuit) return { total: 0, band: 'blocked', components: [] }
    const now = new Date()
    const requirements = await loadTenantEvaluationRequirements(pursuit.tenantId, pursuit.tenderId, pursuit.tender.requirements, tx)
    const eligibility = await computeEligibilityScore(pursuit.tenderId, pursuit.companyId, tx)
    const rates = await tx.currencyRate.findMany({ where: { tenantId: pursuit.tenantId, rateDate: { lte: now } } })
    const evidence = pursuit.company.evidence
    const covered = (requirement: typeof requirements[number]) => {
      if (requirement.id?.startsWith('tenant-review:')) {
        return evaluateRequirement(requirement, evidence, rates, pursuit.tenantId, now).status === 'pass'
      }
      const item = pursuit.complianceItems.find(item => item.requirementId === requirement.id)
      return item?.status === 'compliant' && item.evidence?.companyId === pursuit.companyId && isCurrentVerifiedEvidence(item.evidence, now)
    }
    const compliant = requirements.filter(covered).length
    const withEvidence = requirements.filter(requirement => {
      if (requirement.id?.startsWith('tenant-review:')) return covered(requirement)
      const item = pursuit.complianceItems.find(item => item.requirementId === requirement.id)
      return item?.evidence?.companyId === pursuit.companyId && isCurrentVerifiedEvidence(item.evidence, now)
    }).length
    const documents = requirements.filter(requirement => requirement.isMandatory && requirement.category === 'document')
    const documentsCovered = documents.filter(covered).length
    const tasks = pursuit.tasks
    const done = tasks.filter(task => task.status === 'done').length
    const proposal = pursuit.proposals[0]
    const approved = await submissionApproved(tx, pursuit.tenantId, pursuitId, proposal?.id ?? null)
    const validIds = new Set([...evidence, ...pursuit.company.certifications, ...pursuit.company.projectRefs]
      .filter(record => isCurrentVerifiedEvidence(record, now)).map(record => record.id))
    const sectionsReady = Boolean(proposal?.sections.length) && proposal.sections.every(section => {
      if (section.status !== 'approved' || section.hasGaps || !section.content?.trim()) return false
      try { const ids = evidenceIdsFromJson(section.evidenceIds); return ids.length > 0 && ids.every(id => validIds.has(id)) }
      catch { return false }
    })
    const components: ScoreComponent[] = [
      { criterion: 'Requirement coverage', weight: 0.25, score: requirements.length ? compliant / requirements.length : 0,
        status: requirements.length ? compliant === requirements.length ? 'pass' : 'fail' : 'unknown',
        reason: compliant + '/' + requirements.length + ' requirements fully compliant with verified current evidence.' },
      { criterion: 'Evidence coverage', weight: 0.2, score: requirements.length ? withEvidence / requirements.length : 0,
        status: requirements.length ? withEvidence === requirements.length ? 'pass' : 'fail' : 'unknown',
        reason: withEvidence + '/' + requirements.length + ' requirements supported by verified current evidence.' },
      { criterion: 'Task completion', weight: 0.2, score: tasks.length ? done / tasks.length : 1,
        status: done === tasks.length ? 'pass' : 'fail', reason: done + '/' + tasks.length + ' pursuit tasks complete.' },
      { criterion: 'Approval state', weight: 0.15, score: approved ? 1 : 0, status: approved ? 'pass' : 'fail',
        reason: approved ? 'All required submission, pricing and legal approvals complete.' : 'Required submission approvals are incomplete.' },
      { criterion: 'Mandatory documents', weight: 0.1, score: documents.length ? documentsCovered / documents.length : 1,
        status: documentsCovered === documents.length ? 'pass' : 'fail',
        reason: documentsCovered + '/' + documents.length + ' mandatory document checks supported by verified current compliant evidence.' },
      { criterion: 'Proposal sections', weight: 0.1, score: sectionsReady ? 1 : 0, status: sectionsReady ? 'pass' : 'fail',
        reason: sectionsReady ? 'Proposal sections approved with current evidence and resolved gaps.' : 'A proposal with approved sections and current evidence is required.' },
      { criterion: 'Mandatory eligibility', weight: 0, score: eligibility.mandatoryTotal ? eligibility.mandatoryPassed / eligibility.mandatoryTotal : 0,
        status: eligibility.blocked ? 'fail' : eligibility.mandatoryPassed < eligibility.mandatoryTotal ? 'unknown' : 'pass',
        reason: eligibility.mandatoryPassed + '/' + eligibility.mandatoryTotal + ' mandatory eligibility checks fully satisfied.' },
    ]
    const blocked = eligibility.blocked || eligibility.mandatoryPassed < eligibility.mandatoryTotal ||
      requirements.some(requirement => requirement.isMandatory && !covered(requirement)) ||
      done < tasks.length || !approved || !sectionsReady
    const total = Math.round(components.reduce((sum, component) => sum + component.score * component.weight * 100, 0))
    return { total, band: band(total, blocked), components }
  })
}

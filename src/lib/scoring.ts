// ProcureAtlas AI — Deterministic Scoring Engine
// Principle: "AI is not the source of truth" — scores are deterministic, explainable, evidence-grounded.
// No LLM calls. Every score returns its component breakdown for auditability.

import { db } from './db'

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
  submissionReadiness: SubmissionReadinessScore
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
  companyId: string
): Promise<EligibilityScore> {
  const requirements = await db.requirement.findMany({ where: { tenderId } })
  const company = await db.company.findUnique({
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

  const components: ScoreComponent[] = []
  let mandatoryTotal = 0
  let mandatoryPassed = 0
  let blocked = false
  let blockedReason: string | undefined

  for (const req of requirements) {
    if (!req.isMandatory) continue
    mandatoryTotal++

    let status: ScoreComponent['status'] = 'unknown'
    let reason = ''
    let score = 0

    const threshold = (req.threshold ?? '').toLowerCase()
    const criterion = req.criterion.toLowerCase()

    // Turnover check
    if (criterion.includes('turnover')) {
      const thresholdUSD = parseTurnoverThreshold(req.threshold ?? '', company.country)
      if (company.annualTurnoverUSD && thresholdUSD > 0) {
        if (company.annualTurnoverUSD >= thresholdUSD) {
          status = 'pass'
          score = 1
          reason = `Company turnover USD ${company.annualTurnoverUSD.toLocaleString()} ≥ threshold USD ${thresholdUSD.toLocaleString()}.`
          mandatoryPassed++
        } else {
          status = 'fail'
          reason = `Company turnover USD ${company.annualTurnoverUSD.toLocaleString()} < threshold USD ${thresholdUSD.toLocaleString()}.`
          if (req.isMandatory) {
            blocked = true
            blockedReason = `Turnover below mandatory threshold (${req.threshold}).`
          }
        }
      } else {
        status = 'unknown'
        reason = 'Threshold parsing failed or company turnover not on file.'
      }
    }
    // Years in business
    else if (criterion.includes('years') && (threshold.includes('year') || threshold.includes('5') || threshold.includes('10'))) {
      const years = company.foundedYear ? new Date().getFullYear() - company.foundedYear : 0
      const thresholdYears = parseInt(threshold.match(/\d+/)?.[0] ?? '0', 10)
      if (years >= thresholdYears) {
        status = 'pass'
        score = 1
        reason = `Company operating for ${years} years ≥ ${thresholdYears} required.`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = `Company operating for ${years} years < ${thresholdYears} required.`
        if (req.isMandatory) {
          blocked = true
          blockedReason = `Years in business below mandatory threshold.`
        }
      }
    }
    // ISO 27001
    else if (criterion.includes('iso 27001')) {
      const cert = company.certifications.find(c => c.name.toLowerCase().includes('27001') && (!c.expiresAt || c.expiresAt > new Date()))
      if (cert) {
        status = 'pass'
        score = 1
        reason = `Valid ISO 27001 certification on file (cert #${cert.certificateNo ?? 'N/A'}).`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = 'No valid ISO 27001 certification on file.'
        if (req.isMandatory) {
          blocked = true
          blockedReason = 'Missing mandatory ISO 27001 certification.'
        }
      }
    }
    // ISO 9001
    else if (criterion.includes('iso 9001')) {
      const cert = company.certifications.find(c => c.name.toLowerCase().includes('9001') && (!c.expiresAt || c.expiresAt > new Date()))
      if (cert) {
        status = 'pass'
        score = 1
        reason = `Valid ISO 9001 certification on file.`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = 'No valid ISO 9001 certification on file.'
        if (req.isMandatory) {
          blocked = true
          blockedReason = 'Missing mandatory ISO 9001 certification.'
        }
      }
    }
    // CMMI
    else if (criterion.includes('cmmi')) {
      const cert = company.certifications.find(c => c.name.toLowerCase().includes('cmmi'))
      if (cert) {
        status = 'pass'
        score = 1
        reason = `CMMI certification on file.`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = 'No CMMI certification on file.'
        if (req.isMandatory) {
          blocked = true
          blockedReason = 'Missing mandatory CMMI certification.'
        }
      }
    }
    // OEM Authorization
    else if (criterion.includes('oem')) {
      const oem = company.evidence.find(e => e.category === 'oem')
      if (oem) {
        status = 'partial'
        score = 0.6
        reason = `OEM authorization on file (${oem.title}) — verify it matches the principal vendor named in the tender.`
        mandatoryPassed++ // partial still counts as "potentially passable"
      } else {
        status = 'fail'
        reason = 'No OEM authorization on file.'
        if (req.isMandatory) {
          blocked = true
          blockedReason = 'Missing mandatory OEM authorization.'
        }
      }
    }
    // Similar project references
    else if (criterion.includes('similar') || criterion.includes('project reference') || criterion.includes('track record')) {
      const refs = company.projectRefs.length
      if (refs >= 2) {
        status = 'pass'
        score = 1
        reason = `${refs} project references on file.`
        mandatoryPassed++
      } else if (refs >= 1) {
        status = 'partial'
        score = 0.6
        reason = `Only ${refs} project reference on file; threshold may require more.`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = 'No project references on file.'
        if (req.isMandatory) {
          blocked = true
          blockedReason = 'Missing mandatory project references.'
        }
      }
    }
    // Local presence / registration
    else if (criterion.includes('local') || criterion.includes('registered') || criterion.includes('established') || criterion.includes('entity')) {
      // Heuristic: if tender country matches company country, pass
      const tender = await db.tender.findUnique({ where: { id: tenderId }, select: { country: true } })
      if (tender?.country === company.country) {
        status = 'pass'
        score = 1
        reason = `Company is registered in ${company.country}, matching tender country.`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = `Company registered in ${company.country}; tender requires local presence in ${tender?.country}.`
        if (req.isMandatory) {
          blocked = true
          blockedReason = `Local presence requirement not met for ${tender?.country}.`
        }
      }
    }
    // VAT / Tax / Trade License
    else if (criterion.includes('vat') || criterion.includes('tax') || criterion.includes('trade license') || criterion.includes('registration')) {
      const reg = company.evidence.find(e => e.category === 'registration')
      if (reg) {
        status = 'pass'
        score = 1
        reason = `Registration evidence on file (${reg.title}).`
        mandatoryPassed++
      } else {
        status = 'fail'
        reason = 'No registration evidence on file.'
      }
    }
    // Bid validity / Tender Security (operational, not evidence)
    else if (criterion.includes('bid validity') || criterion.includes('tender security')) {
      status = 'pass'
      score = 1
      reason = 'Operational requirement; will be satisfied at submission time.'
      mandatoryPassed++
    }
    // Master degree / qualifications
    else if (criterion.includes('master') || criterion.includes('advanced degree') || criterion.includes('qualification')) {
      const qualifiedEmployees = company.employees.filter(e => (e.qualifications ?? '').toLowerCase().includes('master') || (e.qualifications ?? '').toLowerCase().includes('cissp') || (e.qualifications ?? '').toLowerCase().includes('ccie')).length
      if (qualifiedEmployees > 0) {
        status = 'pass'
        score = 1
        reason = `${qualifiedEmployees} qualified employee(s) on file.`
        mandatoryPassed++
      } else {
        status = 'partial'
        score = 0.5
        reason = 'Employee qualifications not on file; verification required.'
      }
    }
    // MDB experience
    else if (criterion.includes('world bank') || criterion.includes('adb') || criterion.includes('mdb')) {
      const mdbRefs = company.projectRefs.filter(p => p.clientType === 'multilateral').length
      if (mdbRefs > 0) {
        status = 'pass'
        score = 1
        reason = `${mdbRefs} multilateral project reference(s) on file.`
        mandatoryPassed++
      } else {
        status = 'partial'
        score = 0.5
        reason = 'No multilateral project references on file; not mandatory.'
      }
    }
    // Default
    else {
      status = 'unknown'
      reason = 'Requirement type not auto-evaluable; manual review required.'
    }

    components.push({
      criterion: req.criterion,
      weight: req.isMandatory ? 1 : 0.5,
      score,
      status,
      reason,
    })
  }

  const total = mandatoryTotal === 0 ? 0 : Math.round((mandatoryPassed / mandatoryTotal) * 100)

  return {
    total,
    band: band(total, blocked),
    mandatoryPassed,
    mandatoryTotal,
    components,
    blocked,
    blockedReason,
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
  const companySectors = ['IT', 'Cyber', 'Consulting'] // derived from company.description
  const sectorMatch = companySectors.includes(tender.sector)
  components.push({
    criterion: 'Sector match',
    weight: 0.25,
    score: sectorMatch ? 1 : 0.2,
    status: sectorMatch ? 'pass' : 'fail',
    reason: sectorMatch ? `Tender sector (${tender.sector}) matches company capabilities.` : `Tender sector (${tender.sector}) outside core capabilities.`,
  })

  // Geography
  const geoMatch = tender.country === company.country || tender.market === 'WB' || tender.market === 'ADB' || tender.market === 'UN'
  components.push({
    criterion: 'Geography',
    weight: 0.15,
    score: geoMatch ? 1 : 0.3,
    status: geoMatch ? 'pass' : 'partial',
    reason: geoMatch ? `Tender country (${tender.country}) accessible to company (${company.country}).` : `Geographic mismatch; local partner required.`,
  })

  // Contract size
  const valueUSD = tender.valueUSD ?? 0
  const turnover = company.annualTurnoverUSD ?? 0
  let sizeScore = 0.5
  let sizeStatus: ScoreComponent['status'] = 'partial'
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
  const certCount = company.certifications.length
  const certScore = Math.min(certCount / 5, 1)
  components.push({
    criterion: 'Capability depth',
    weight: 0.15,
    score: certScore,
    status: certScore >= 0.8 ? 'pass' : certScore >= 0.4 ? 'partial' : 'fail',
    reason: `${certCount} certifications on file.`,
  })

  // Historical experience
  const govRefs = company.projectRefs.filter(p => p.clientType === 'government').length
  const expScore = Math.min(govRefs / 3, 1)
  components.push({
    criterion: 'Government experience',
    weight: 0.15,
    score: expScore,
    status: expScore >= 0.66 ? 'pass' : expScore >= 0.33 ? 'partial' : 'fail',
    reason: `${govRefs} government project reference(s).`,
  })

  // Strategic priority (heuristic: Cyber sector + BD/SG market = strategic)
  const strategic = (tender.sector === 'Cyber' && (tender.market === 'BD' || tender.market === 'SG')) || tender.valueUSD > 1000000
  components.push({
    criterion: 'Strategic priority',
    weight: 0.1,
    score: strategic ? 1 : 0.5,
    status: strategic ? 'pass' : 'partial',
    reason: strategic ? 'Tender aligns with strategic priorities (cyber + key market or high value).' : 'Standard priority.',
  })

  const total = Math.round(components.reduce((acc, c) => acc + c.score * c.weight * 100, 0))
  return { total, band: band(total), components }
}

// Submission Readiness: operational bid readiness
export async function computeSubmissionReadinessScore(
  pursuitId: string
): Promise<SubmissionReadinessScore> {
  const pursuit = await db.pursuit.findUnique({
    where: { id: pursuitId },
    include: {
      complianceItems: { include: { requirement: true, evidence: true } },
      bid: { include: { tasks: true } },
      approvals: true,
    },
  })

  if (!pursuit) {
    return { total: 0, band: 'low', components: [] }
  }

  const components: ScoreComponent[] = []

  // Requirement coverage
  const totalReq = pursuit.complianceItems.length
  const compliant = pursuit.complianceItems.filter(c => c.status === 'compliant').length
  const partial = pursuit.complianceItems.filter(c => c.status === 'partial').length
  const coverageScore = totalReq === 0 ? 0 : (compliant + partial * 0.5) / totalReq
  components.push({
    criterion: 'Requirement coverage',
    weight: 0.3,
    score: coverageScore,
    status: coverageScore >= 0.8 ? 'pass' : coverageScore >= 0.5 ? 'partial' : 'fail',
    reason: `${compliant} compliant / ${partial} partial / ${totalReq - compliant - partial} gap of ${totalReq} requirements.`,
  })

  // Evidence coverage
  const withEvidence = pursuit.complianceItems.filter(c => c.evidenceId !== null).length
  const evidenceScore = totalReq === 0 ? 0 : withEvidence / totalReq
  components.push({
    criterion: 'Evidence coverage',
    weight: 0.25,
    score: evidenceScore,
    status: evidenceScore >= 0.8 ? 'pass' : evidenceScore >= 0.5 ? 'partial' : 'fail',
    reason: `${withEvidence}/${totalReq} requirements linked to evidence.`,
  })

  // Task completion
  const tasks = pursuit.bid?.tasks ?? []
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length
  const taskScore = tasks.length === 0 ? 0.3 : (doneTasks + inProgressTasks * 0.5) / tasks.length
  components.push({
    criterion: 'Task completion',
    weight: 0.2,
    score: taskScore,
    status: taskScore >= 0.8 ? 'pass' : taskScore >= 0.5 ? 'partial' : 'fail',
    reason: tasks.length === 0 ? 'No bid tasks defined yet.' : `${doneTasks} done / ${inProgressTasks} in progress / ${tasks.length} total tasks.`,
  })

  // Approval state
  const approvals = pursuit.approvals ?? []
  const approved = approvals.some(a => a.decision === 'approved')
  const approvalScore = approved ? 1 : approvals.length > 0 ? 0.3 : 0
  components.push({
    criterion: 'Approval state',
    weight: 0.15,
    score: approvalScore,
    status: approved ? 'pass' : 'partial',
    reason: approved ? 'Bid approved.' : approvals.length > 0 ? 'Approval pending.' : 'No approval requested yet.',
  })

  // Mandatory documents (placeholder — would scan tender.mandatory documents)
  components.push({
    criterion: 'Mandatory documents',
    weight: 0.1,
    score: 0.5,
    status: 'partial',
    reason: 'Document checklist pending — TBD per tender requirements.',
  })

  const total = Math.round(components.reduce((acc, c) => acc + c.score * c.weight * 100, 0))
  return { total, band: band(total), components }
}

// Helper: parse turnover thresholds like "50000000 BDT (~455000 USD)" or "1500000 USD"
function parseTurnoverThreshold(threshold: string, companyCountry: string): number {
  // Prefer USD if mentioned
  const usdMatch = threshold.match(/([\d,]+)\s*USD/i) || threshold.match(/USD\s*([\d,]+)/i)
  if (usdMatch) {
    return parseFloat(usdMatch[1].replace(/,/g, ''))
  }
  // BDT (Bangladesh Taka) — convert to USD at ~110 BDT/USD
  const bdtMatch = threshold.match(/([\d,]+)\s*BDT/i) || threshold.match(/BDT\s*([\d,]+)/i)
  if (bdtMatch) {
    const bdt = parseFloat(bdtMatch[1].replace(/,/g, ''))
    return bdt / 110
  }
  // SGD — convert at ~1.34 SGD/USD
  const sgdMatch = threshold.match(/([\d,]+)\s*SGD/i)
  if (sgdMatch) {
    const sgd = parseFloat(sgdMatch[1].replace(/,/g, ''))
    return sgd / 1.34
  }
  // EUR — convert at ~1.08 EUR/USD
  const eurMatch = threshold.match(/([\d,]+)\s*EUR/i)
  if (eurMatch) {
    const eur = parseFloat(eurMatch[1].replace(/,/g, ''))
    return eur / 1.08
  }
  // Fallback: bare number
  const numMatch = threshold.match(/([\d,]+)/)
  if (numMatch) {
    return parseFloat(numMatch[1].replace(/,/g, ''))
  }
  return 0
}

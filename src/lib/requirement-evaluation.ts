/** Conservative deterministic comparisons. Free text never supplies numeric facts. */
import { isCurrentVerified } from './evidence-validity'

export interface ThresholdRequirement {
  evaluationMetric?: string | null
  thresholdStatus?: string | null
  thresholdAmount?: number | null
  thresholdCurrency?: string | null
  thresholdUnit?: string | null
  operator?: string | null
}

export interface FactEvidence {
  title: string
  verified: boolean
  issuedAt?: Date | null
  expiresAt?: Date | null
  verifiedAt?: Date | null
  factMetric?: string | null
  factAmount?: number | null
  factCurrency?: string | null
  factUnit?: string | null
}

export interface DatedCurrencyRate {
  tenantId: string
  baseCurrency: string
  quoteCurrency: string
  rate: number
  rateDate: Date
}

export function isCurrentVerifiedEvidence(evidence: {
  verified: boolean; issuedAt?: Date | null; expiresAt?: Date | null; verifiedAt?: Date | null
}, asOf = new Date()): boolean {
  return isCurrentVerified(evidence, asOf) &&
    (!evidence.verifiedAt || (Number.isFinite(evidence.verifiedAt.getTime()) && evidence.verifiedAt <= asOf))
}

export function convertWithDatedRate(amount: number, from: string, to: string,
  rates: DatedCurrencyRate[], tenantId: string, asOf: Date): { amount: number; explanation: string } | null {
  if (from === to) return { amount, explanation: `No FX conversion (${to}).` }
  const applicable = rates.filter(rate => rate.tenantId === tenantId &&
    Number.isFinite(rate.rate) && rate.rate > 0 && rate.rateDate <= asOf &&
    ((rate.baseCurrency === from && rate.quoteCurrency === to) ||
      (rate.baseCurrency === to && rate.quoteCurrency === from)))
    .sort((a, b) => b.rateDate.getTime() - a.rateDate.getTime() ||
      Number(b.baseCurrency === from) - Number(a.baseCurrency === from))
  const rate = applicable[0]
  if (!rate) return null
  const converted = rate.baseCurrency === from ? amount * rate.rate : amount / rate.rate
  if (!Number.isFinite(converted)) return null
  return { amount: converted, explanation: `FX ${rate.baseCurrency}/${rate.quoteCurrency} ${rate.rate}, dated ${rate.rateDate.toISOString().slice(0, 10)}.` }
}

const comparisons: Record<string, (fact: number, threshold: number) => boolean> = {
  '>=': (a, b) => a >= b, '<=': (a, b) => a <= b,
  '==': (a, b) => a === b, '>': (a, b) => a > b, '<': (a, b) => a < b,
}

export function evaluateRequirement(requirement: ThresholdRequirement, evidence: FactEvidence[],
  rates: DatedCurrencyRate[], tenantId: string, asOf = new Date()): { status: 'pass' | 'fail' | 'unknown'; score: number; reason: string } {
  const unknown = (reason: string) => ({ status: 'unknown' as const, score: 0, reason })
  if (requirement.thresholdStatus !== 'reviewed' || !requirement.evaluationMetric ||
    requirement.thresholdAmount == null || !Number.isFinite(requirement.thresholdAmount) ||
    !requirement.thresholdUnit || !requirement.operator || !Object.hasOwn(comparisons, requirement.operator)) {
    return unknown('A reviewed structured metric, amount, unit and comparison operator are required; legacy threshold text needs review.')
  }
  const candidates = evidence.filter(item => item.factMetric === requirement.evaluationMetric &&
    isCurrentVerifiedEvidence(item, asOf) && item.factAmount != null &&
    Number.isFinite(item.factAmount) && item.factUnit === requirement.thresholdUnit)
  if (!candidates.length) return unknown('No verified, current evidence with the exact metric and unit is on file.')
  const values: { amount: number; explanation: string; title: string }[] = []
  for (const fact of candidates) {
    const from = fact.factCurrency ?? null
    const to = requirement.thresholdCurrency ?? null
    if (Boolean(from) !== Boolean(to)) return unknown('Fact and threshold currency must both be specified for monetary comparisons.')
    if (requirement.thresholdUnit === 'money' && (!from || !to)) return unknown('Monetary facts and thresholds require explicit currencies.')
    const converted = from && to ? convertWithDatedRate(fact.factAmount!, from, to, rates, tenantId, asOf)
      : { amount: fact.factAmount!, explanation: '' }
    if (!converted) return unknown(`No applicable dated tenant FX rate for ${from}/${to} as of ${asOf.toISOString().slice(0, 10)}.`)
    values.push({ ...converted, title: fact.title })
  }
  if (values.some(value => value.amount !== values[0].amount)) return unknown('Conflicting verified facts for this metric require review.')
  const value = values[0]
  const passed = comparisons[requirement.operator](value.amount, requirement.thresholdAmount)
  return { status: passed ? 'pass' : 'fail', score: passed ? 1 : 0,
    reason: `${value.title}: verified ${requirement.evaluationMetric} ${value.amount} ${requirement.thresholdCurrency ?? requirement.thresholdUnit} ${passed ? 'satisfies' : 'does not satisfy'} ${requirement.operator} ${requirement.thresholdAmount}. ${value.explanation}`.trim() }
}

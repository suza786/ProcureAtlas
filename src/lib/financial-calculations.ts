import { convertWithDatedRate, type DatedCurrencyRate } from './requirement-evaluation'

export function calculateBidPrice(costs: number[], contingencyPct: number, marginPct: number) {
  if (costs.some(cost => !Number.isFinite(cost) || cost < 0) || !Number.isFinite(contingencyPct) || contingencyPct < 0 || contingencyPct > 100 || !Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) {
    throw new Error('Costs must be nonnegative; contingency must be 0–100%; margin must be 0–less than 100%.')
  }
  const subtotal = costs.reduce((sum, cost) => sum + cost, 0)
  const contingency = subtotal * contingencyPct / 100
  const totalCost = subtotal + contingency
  const proposedPrice = totalCost / (1 - marginPct / 100)
  const profitAmount = proposedPrice - totalCost
  if (![subtotal, totalCost, proposedPrice, profitAmount].every(Number.isFinite)) throw new Error('Bid totals exceed the supported numeric range.')
  return { subtotal, contingency, totalCost, proposedPrice, profitAmount, markupPct: totalCost > 0 ? profitAmount / totalCost * 100 : 0 }
}

type AwardValue = {
  contractValue: number | null; currency: string; awardedAt: Date; valueUSD?: number | null
  normalizationRate?: number | null; normalizationDate?: Date | null; normalizationSource?: string | null
}
type Rate = DatedCurrencyRate & { source?: string }

/** Read-time normalization never changes original amounts or writes catalog data. */
export function normalizeAward<T extends AwardValue>(award: T, rates: Rate[], tenantId: string) {
  if (award.valueUSD != null && Number.isFinite(award.valueUSD) && award.valueUSD >= 0) return { ...award, valueUSD: award.valueUSD }
  const unknown = { ...award, valueUSD: null, normalizationRate: null, normalizationDate: null, normalizationSource: null }
  if (award.contractValue == null || !Number.isFinite(award.contractValue) || award.contractValue < 0 || !award.currency || !Number.isFinite(award.awardedAt.getTime())) return unknown
  const converted = convertWithDatedRate(award.contractValue, award.currency, 'USD', rates, tenantId, award.awardedAt)
  if (!converted) return unknown
  if (award.currency === 'USD') return { ...award, valueUSD: converted.amount, normalizationRate: 1, normalizationDate: award.awardedAt, normalizationSource: 'original USD amount' }
  const rate = rates.filter(r => r.tenantId === tenantId && Number.isFinite(r.rate) && r.rate > 0 && r.rateDate <= award.awardedAt &&
    ((r.baseCurrency === award.currency && r.quoteCurrency === 'USD') || (r.baseCurrency === 'USD' && r.quoteCurrency === award.currency)))
    .sort((a, b) => b.rateDate.getTime() - a.rateDate.getTime() || Number(b.baseCurrency === award.currency) - Number(a.baseCurrency === award.currency))[0]
  return { ...award, valueUSD: converted.amount, normalizationRate: rate.baseCurrency === award.currency ? rate.rate : 1 / rate.rate, normalizationDate: rate.rateDate, normalizationSource: rate.source ?? converted.explanation }
}

export function summarizeAwardValues(awards: Array<{ valueUSD?: number | null }>) {
  const known = awards.filter(a => a.valueUSD != null && Number.isFinite(a.valueUSD) && a.valueUSD >= 0)
  const totalValueUSD = known.reduce((sum, a) => sum + a.valueUSD!, 0)
  return { totalValueUSD, averageValueUSD: known.length ? totalValueUSD / known.length : null, normalizedCount: known.length, unnormalizedCount: awards.length - known.length }
}

export function compareBidToTenderUSD(price: number, currency: string, tenderValueUSD: number | null, rates: DatedCurrencyRate[], tenantId: string, asOf: Date) {
  const converted = Number.isFinite(price) && price >= 0 && currency ? convertWithDatedRate(price, currency, 'USD', rates, tenantId, asOf) : null
  return { proposedPriceUSD: converted?.amount ?? null, percentage: converted && tenderValueUSD != null && Number.isFinite(tenderValueUSD) && tenderValueUSD > 0 ? converted.amount / tenderValueUSD * 100 : null, explanation: converted?.explanation ?? 'No applicable dated tenant FX rate.' }
}

export function formatCurrencyAmount(amount: number | null, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return 'Unknown'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount) }
  catch { return `${currency || 'Unknown currency'} ${amount.toLocaleString('en-US')}` }
}

import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { getSubscription } from '@/lib/subscription'
import { demoBillingEnabled } from '@/lib/billing-security'
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  const subscription = await getSubscription(ctx.tenantId)
  const [metrics, tracked, pursuits, seats, invoices, providers, tokenSources] = await Promise.all([
    db.usageMetric.findMany({ where: { subscriptionId: subscription.id, periodStart: subscription.currentPeriodStart! } }),
    db.pursuit.groupBy({ by: ['tenderId'], where: { tenantId: ctx.tenantId } }),
    db.pursuit.count({ where: { tenantId: ctx.tenantId } }), db.user.count({ where: { tenantId: ctx.tenantId } }),
    db.invoice.findMany({ where: { subscriptionId: subscription.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.usageEvent.count({ where: { tenantId: ctx.tenantId, kind: 'provider_call', createdAt: { gte: subscription.currentPeriodStart!, lt: subscription.currentPeriodEnd! } } }),
    db.usageEvent.groupBy({ by: ['tokenSource'], where: { tenantId: ctx.tenantId, kind: 'provider_call', createdAt: { gte: subscription.currentPeriodStart!, lt: subscription.currentPeriodEnd! } }, _count: true }),
  ])
  const used = (metric: string) => metrics.find(row => row.metricType === metric)?.count ?? 0
  const usage = [['api_calls', used('api_calls'), subscription.apiCallsLimit], ['llm_tokens', used('llm_tokens'), subscription.llmTokensLimit], ['tenders_tracked', tracked.length, subscription.tendersTrackedLimit], ['pursuits', pursuits, subscription.pursuitsLimit], ['seats', seats, subscription.seatsIncluded]].map(([metricType,count,limit]) => ({ metricType, used: count, limit, percentage: Number(limit) ? Math.round(Number(count) / Number(limit) * 100) : 0 }))
  const reservedTokens = metrics.find(row => row.metricType === 'llm_tokens')?.reservedCount ?? 0
  const countSource = (source: string) => tokenSources.find(row => row.tokenSource === source)?._count ?? 0
  const tokenAccounting = { reportedCalls: countSource('provider_reported'), estimatedCalls: countSource('estimated'), unsettledCalls: countSource('reserved_upper_bound') }
  return NextResponse.json({ reservedTokens, tokenAccounting, subscription: { ...subscription, directSwitchEnabled: demoBillingEnabled() }, usage, invoices, providerCalls: providers })
})

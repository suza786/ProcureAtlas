import type { Prisma } from '@prisma/client'
import { db } from './db'
import { ensureSubscription } from './subscription'
import { apiContext } from './request-context'

const quotaError = () => Response.json({ error: 'Plan quota exceeded', code: 'QUOTA_EXCEEDED' }, { status: 429 })
async function increment(tx: Prisma.TransactionClient, subscription: Awaited<ReturnType<typeof ensureSubscription>>, metricType: string, amount: number, limit: number) {
  return tx.usageMetric.upsert({ where: { subscriptionId_metricType_periodStart: { subscriptionId: subscription.id, metricType, periodStart: subscription.currentPeriodStart! } },
    create: { tenantId: subscription.tenantId, subscriptionId: subscription.id, metricType, periodStart: subscription.currentPeriodStart!, periodEnd: subscription.currentPeriodEnd!, count: amount, limit },
    update: { count: { increment: amount }, limit, periodEnd: subscription.currentPeriodEnd! } })
}

/** The request wrapper owns this context; repeated tenant lookups count once. */
export async function meterApiRequest(tenantId: string, actor: { userId?: string | null; apiKeyId?: string } = {}) {
  const context = apiContext.getStore()
  if (!context) return
  if (context.metering) return context.metering
  context.metered = true; context.tenantId = tenantId; Object.assign(context, actor)
  context.metering = (async () => {
  const outcome = await db.$transaction(async tx => {
    const subscription = await ensureSubscription(tenantId, tx)
    const used = await increment(tx, subscription, 'api_calls', 1, subscription.apiCallsLimit)
    await tx.usageEvent.create({ data: { tenantId, kind: 'api_call', endpoint: context.path, ...actor } })
    return used.count <= subscription.apiCallsLimit
  })
  // Billing and logout remain accessible to recover from exhausted API quotas.
  if (!outcome && !context.path?.startsWith('/api/billing/') && !context.path?.startsWith('/api/auth/')) throw quotaError()
  })()
  return context.metering
}

export async function reserveProviderCall(tenantId: string, input: string, maxOutputTokens = 1000) {
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32000) throw new Response('Invalid provider token bound', { status: 400 })
  const reserved = Buffer.byteLength(input, 'utf8') + maxOutputTokens
  return db.$transaction(async tx => {
    const subscription = await ensureSubscription(tenantId, tx)
    const used = await tx.usageMetric.upsert({ where: { subscriptionId_metricType_periodStart: { subscriptionId: subscription.id, metricType: 'llm_tokens', periodStart: subscription.currentPeriodStart! } },
      create: { tenantId, subscriptionId: subscription.id, metricType: 'llm_tokens', periodStart: subscription.currentPeriodStart!, periodEnd: subscription.currentPeriodEnd!, count: 0, reservedCount: reserved, limit: subscription.llmTokensLimit },
      update: { reservedCount: { increment: reserved }, limit: subscription.llmTokensLimit } })
    if (used.count + used.reservedCount > subscription.llmTokensLimit) throw quotaError()
    const event = await tx.usageEvent.create({ data: { tenantId, kind: 'provider_call', endpoint: apiContext.getStore()?.path, inputTokens: 0, reservedTokens: reserved, tokenSource: 'reserved_upper_bound' } })
    return { eventId: event.id, tenantId, subscriptionId: subscription.id, periodStart: subscription.currentPeriodStart!, reserved, maxOutputTokens }
  })
}

export async function settleProviderCall(reservation: Awaited<ReturnType<typeof reserveProviderCall>>, usage: unknown, input: string, output: string) {
  const raw = usage as { prompt_tokens?: number; completion_tokens?: number } | null
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  const reported = valid(raw?.prompt_tokens) && valid(raw?.completion_tokens)
  const inputTokens = reported ? raw!.prompt_tokens! : Math.ceil(Buffer.byteLength(input, 'utf8') / 4)
  const outputTokens = reported ? raw!.completion_tokens! : Math.ceil(Buffer.byteLength(output, 'utf8') / 4)
  await db.$transaction(async tx => {
    const claimed = await tx.usageEvent.updateMany({ where: { id: reservation.eventId, tenantId: reservation.tenantId, tokenSource: 'reserved_upper_bound' }, data: { inputTokens, outputTokens, reservedTokens: 0, tokenSource: reported ? 'provider_reported' : 'estimated' } })
    if (claimed.count !== 1) return
    await tx.usageMetric.update({ where: { tenantId: reservation.tenantId, subscriptionId_metricType_periodStart: { subscriptionId: reservation.subscriptionId, metricType: 'llm_tokens', periodStart: reservation.periodStart } }, data: { count: { increment: inputTokens + outputTokens }, reservedCount: { decrement: reservation.reserved } } })
  })
  return { inputTokens, outputTokens }
}

export async function assertPursuitQuota(tx: Prisma.TransactionClient, tenantId: string, tenderId: string) {
  const subscription = await ensureSubscription(tenantId, tx)
  const count = await tx.pursuit.count({ where: { tenantId } })
  if (count >= subscription.pursuitsLimit) throw quotaError()
  const tracked = await tx.pursuit.groupBy({ by: ['tenderId'], where: { tenantId } })
  if (!tracked.some(row => row.tenderId === tenderId) && tracked.length >= subscription.tendersTrackedLimit) throw quotaError()
}

export async function assertSeatQuota(tx: Prisma.TransactionClient, tenantId: string) {
  const subscription = await ensureSubscription(tenantId, tx)
  if (await tx.user.count({ where: { tenantId } }) >= subscription.seatsIncluded) throw quotaError()
}

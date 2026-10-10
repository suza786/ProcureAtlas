import type { Prisma } from '@prisma/client'
import { db } from './db'
import { getPlan } from './plans'
import { demoBillingEnabled } from './billing-security'
export async function ensureSubscription(tenantId: string, client: Prisma.TransactionClient = db) {
  const tenant = await client.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Response('Tenant not found', { status: 404 })
  const existing = await client.subscription.findUnique({ where: { tenantId } })
  const demo = demoBillingEnabled()
  const verified = existing?.billingVerifiedAt && existing.billingVerifiedAt <= new Date() && existing.currentPeriodEnd && existing.currentPeriodEnd > new Date() && ['active','trialing'].includes(existing.status)
  const plan = getPlan(demo ? existing?.plan ?? tenant.plan : verified ? existing!.plan : 'free')
  const now = new Date()
  const start = existing?.currentPeriodStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = existing?.currentPeriodEnd ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const expired = end <= now
  const periodStart = expired && !verified ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : start
  const periodEnd = expired && !verified ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) : end
  const subscription = await client.subscription.upsert({ where: { tenantId }, create: { tenantId, plan: plan.id, ...plan.limits, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd }, update: { plan: plan.id, ...plan.limits, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd } })
  if (tenant.plan !== plan.id) await client.tenant.update({ where: { id: tenantId }, data: { plan: plan.id } })
  return subscription
}
export const getSubscription = (tenantId: string) => db.$transaction(tx => ensureSubscription(tenantId, tx))

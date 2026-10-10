import crypto from 'node:crypto'
import { z } from 'zod'
import { db } from './db'
import { getPlan, PLANS } from './plans'

const epoch = z.number().int().positive().max(253402300799)
const identifier = z.string().min(1).max(255)
const eventSchema = z.object({
  id: identifier, type: z.string().min(1).max(255), created: epoch.max(2147483647), livemode: z.boolean(),
  data: z.object({ object: z.unknown() }),
})
const subscriptionSchema = z.object({
  id: identifier,
  customer: z.union([identifier, z.object({ id: identifier })]),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']),
  cancel_at_period_end: z.boolean().optional(),
  current_period_start: epoch.optional(), current_period_end: epoch.optional(),
  items: z.unknown().optional(),
})
const itemsSchema = z.object({ data: z.array(z.object({
  current_period_start: epoch.optional(), current_period_end: epoch.optional(),
  price: z.object({ id: identifier, recurring: z.object({
    interval: z.enum(['month', 'year']), interval_count: z.literal(1).optional(),
  }).nullable().optional() }),
})).length(1) })
const supportedTypes = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])

function configuredPlan(priceId: string) {
  let mapping: unknown
  try { mapping = JSON.parse(process.env.STRIPE_PRICE_PLANS ?? '') }
  catch { throw new Response('Stripe price mapping is not configured', { status: 503 }) }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Response('Invalid Stripe price mapping', { status: 503 })
  const planId = Object.hasOwn(mapping, priceId) ? (mapping as Record<string, unknown>)[priceId] : undefined
  if (typeof planId !== 'string' || !Object.hasOwn(PLANS, planId)) throw new Response('Unrecognized Stripe subscription price', { status: 422 })
  return getPlan(planId)
}

/** Process a verified Stripe snapshot. The caller must authenticate the untouched raw body first. */
export async function applyStripeBillingEvent(rawBody: string) {
  const event = eventSchema.parse(JSON.parse(rawBody))
  if (process.env.DEMO_MODE !== 'true' && !event.livemode) throw new Response('Test billing events are disabled', { status: 400 })
  if (!supportedTypes.has(event.type)) return { received: true, ignored: 'unsupported' }
  const snapshot = subscriptionSchema.parse(event.data.object)
  const customerId = typeof snapshot.customer === 'string' ? snapshot.customer : snapshot.customer.id
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex')
  const eventKey = { provider_eventId: { provider: 'stripe', eventId: event.id } }

  // Retry unique-event races and serialization conflicts; each failed attempt rolls back completely.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const existingEvent = await tx.billingEvent.findUnique({ where: eventKey })
        if (existingEvent) {
          if (existingEvent.payloadHash !== payloadHash) throw new Response('Billing event payload changed', { status: 409 })
          return { received: true, duplicate: true }
        }
        // Only an existing server-managed customer binding establishes tenant ownership.
        const bindings = await tx.subscription.findMany({ where: { stripeCustomerId: customerId }, take: 2 })
        if (bindings.length !== 1) throw new Response('Stripe customer must have one trusted subscription binding', { status: 409 })
        const binding = bindings[0]
        const revoking = event.type === 'customer.subscription.deleted' || !['active','trialing'].includes(snapshot.status)
        // Stripe timestamps have second precision: revocation wins equal-time races.
        if (event.created < binding.billingEventCreatedAt || (event.created === binding.billingEventCreatedAt && !revoking)) {
          await tx.billingEvent.create({ data: { provider: 'stripe', eventId: event.id, tenantId: binding.tenantId, payloadHash } })
          return { received: true, ignored: 'stale' }
        }
        if (binding.stripeSubscriptionId && binding.stripeSubscriptionId !== snapshot.id) throw new Response('Stripe subscription does not match its trusted binding', { status: 409 })

        const deleted = event.type === 'customer.subscription.deleted'
        const item = deleted ? undefined : itemsSchema.parse(snapshot.items).data[0]
        const requestedPlan = deleted ? getPlan('free') : configuredPlan(item!.price.id)
        const startEpoch = item?.current_period_start ?? snapshot.current_period_start
        const endEpoch = item?.current_period_end ?? snapshot.current_period_end
        const start = startEpoch ? new Date(startEpoch * 1000) : binding.currentPeriodStart
        const end = endEpoch ? new Date(endEpoch * 1000) : binding.currentPeriodEnd
        if (!deleted && (!startEpoch || !endEpoch || startEpoch >= endEpoch)) throw new Response('Subscription billing period is invalid', { status: 422 })
        const status = deleted ? 'canceled' : snapshot.status
        const verifiedAt = new Date()
        // Signed trials may grant the configured plan only within the verified billing period.
        const entitled = ['active', 'trialing'].includes(status) && start && start <= verifiedAt && end && end > verifiedAt
        const plan = entitled ? requestedPlan : getPlan('free')
        const interval = item?.price.recurring?.interval
        await tx.billingEvent.create({ data: { provider: 'stripe', eventId: event.id, tenantId: binding.tenantId, payloadHash } })
        const updated = await tx.subscription.updateMany({
          where: { id: binding.id, stripeCustomerId: customerId, billingEventCreatedAt: { lte: event.created } },
          data: { plan: plan.id, ...plan.limits, status, billingCycle: interval ? interval === 'year' ? 'yearly' : 'monthly' : binding.billingCycle,
            stripeSubscriptionId: snapshot.id, billingVerifiedAt: verifiedAt, billingEventCreatedAt: event.created,
            currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: snapshot.cancel_at_period_end ?? false },
        })
        if (updated.count === 0) return { received: true, ignored: 'stale' }
        await tx.tenant.update({ where: { id: binding.tenantId }, data: { plan: plan.id } })
        return { received: true, applied: true }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (attempt < 2 && (code === 'P2002' || code === 'P2034')) continue
      throw error
    }
  }
}

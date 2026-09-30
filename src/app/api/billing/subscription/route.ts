import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/billing/subscription — current subscription details
export async function GET() {
  const ctx = await getCurrentTenant()

  let subscription = await db.subscription.findUnique({
    where: { tenantId: ctx.tenantId },
  })

  if (!subscription) {
    const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId } })
    const plan = tenant?.plan ?? 'free'
    subscription = await db.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        plan,
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  return NextResponse.json(subscription)
}

// PATCH /api/billing/subscription — update plan (owner only)
export async function PATCH(req: NextRequest) {
  const { ctx, user } = await requireTenantWithRole('owner')
  const body = await req.json()
  const { plan, billingCycle, cancelAtPeriodEnd } = body as {
    plan?: string
    billingCycle?: string
    cancelAtPeriodEnd?: boolean
  }

  let subscription = await db.subscription.findUnique({
    where: { tenantId: ctx.tenantId },
  })

  if (!subscription) {
    subscription = await db.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        plan: plan ?? 'free',
        status: 'active',
        billingCycle: billingCycle ?? 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  const updates: Record<string, unknown> = {}
  if (plan && ['free', 'solo', 'professional', 'bid_team', 'enterprise', 'intelligence', 'pursuit_pro', 'team'].includes(plan)) {
    updates.plan = plan
    // Update limits based on plan
    const limits = getPlanLimits(plan)
    Object.assign(updates, limits)
  }
  if (billingCycle) updates.billingCycle = billingCycle
  if (cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = cancelAtPeriodEnd

  const updated = await db.subscription.update({
    where: { id: subscription.id },
    data: updates,
  })

  // Also update tenant plan
  await db.tenant.update({
    where: { id: ctx.tenantId },
    data: { plan: updated.plan },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'subscription_updated',
    entityType: 'subscription',
    entityId: updated.id,
    afterJson: { plan: updated.plan, billingCycle: updated.billingCycle, cancelAtPeriodEnd: updated.cancelAtPeriodEnd },
    request: req,
  })

  return NextResponse.json(updated)
}

function getPlanLimits(plan: string) {
  const limits: Record<string, { seatsIncluded: number; tendersTrackedLimit: number; pursuitsLimit: number; apiCallsLimit: number; llmTokensLimit: number }> = {
    free: { seatsIncluded: 1, tendersTrackedLimit: 10, pursuitsLimit: 1, apiCallsLimit: 100, llmTokensLimit: 5000 },
    solo: { seatsIncluded: 1, tendersTrackedLimit: 50, pursuitsLimit: 5, apiCallsLimit: 1000, llmTokensLimit: 50000 },
    professional: { seatsIncluded: 3, tendersTrackedLimit: 200, pursuitsLimit: 20, apiCallsLimit: 5000, llmTokensLimit: 200000 },
    bid_team: { seatsIncluded: 10, tendersTrackedLimit: 1000, pursuitsLimit: 100, apiCallsLimit: 25000, llmTokensLimit: 1000000 },
    intelligence: { seatsIncluded: 1, tendersTrackedLimit: 100, pursuitsLimit: 10, apiCallsLimit: 5000, llmTokensLimit: 200000 },
    pursuit_pro: { seatsIncluded: 3, tendersTrackedLimit: 200, pursuitsLimit: 20, apiCallsLimit: 10000, llmTokensLimit: 300000 },
    team: { seatsIncluded: 10, tendersTrackedLimit: 500, pursuitsLimit: 50, apiCallsLimit: 25000, llmTokensLimit: 1000000 },
    enterprise: { seatsIncluded: 50, tendersTrackedLimit: 10000, pursuitsLimit: 1000, apiCallsLimit: 100000, llmTokensLimit: 5000000 },
  }
  return limits[plan] ?? limits.free
}

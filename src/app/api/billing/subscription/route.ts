import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import { ensureSubscription, getSubscription } from '@/lib/subscription'
import { demoBillingEnabled } from '@/lib/billing-security'
import { getPlan } from '@/lib/plans'
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  return NextResponse.json({ ...await getSubscription(ctx.tenantId), directSwitchEnabled: demoBillingEnabled() })
})
export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('owner')
  const input = await readJson(req, 'subscription')
  if (!demoBillingEnabled()) throw Response.json({ error: 'Production subscription changes require verified billing events', code: 'BILLING_VERIFICATION_REQUIRED' }, { status: 403 })
  const updated = await db.$transaction(async tx => {
    const subscription = await ensureSubscription(ctx.tenantId, tx)
    const plan = getPlan(input.plan ?? subscription.plan)
    const updated = await tx.subscription.update({ where: { id: subscription.id }, data: { plan: plan.id, ...plan.limits, billingCycle: input.billingCycle, cancelAtPeriodEnd: input.cancelAtPeriodEnd } })
    await tx.tenant.update({ where: { id: ctx.tenantId }, data: { plan: plan.id } })
    return updated
  })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'demo_subscription_updated', entityType: 'subscription', entityId: updated.id, afterJson: input, request: req })
  return NextResponse.json(updated)
})

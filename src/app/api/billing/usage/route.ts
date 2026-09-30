import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/billing/usage — current period usage metrics for the tenant
export async function GET() {
  const ctx = await getCurrentTenant()

  // Get or create subscription for tenant
  let subscription = await db.subscription.findUnique({
    where: { tenantId: ctx.tenantId },
    include: { usageMetrics: true, invoices: { orderBy: { createdAt: 'desc' }, take: 5 } },
  })

  if (!subscription) {
    // Create default subscription based on tenant plan
    const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId } })
    const plan = tenant?.plan ?? 'free'
    const limits = getPlanLimits(plan)
    subscription = await db.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        plan,
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...limits,
      },
      include: { usageMetrics: true, invoices: { orderBy: { createdAt: 'desc' }, take: 5 } },
    })
  }

  // Compute current period usage
  const periodStart = subscription.currentPeriodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const periodEnd = subscription.currentPeriodEnd ?? new Date()

  const [apiCallCount, llmTokenSum, tenderCount, pursuitCount, uploadCount] = await Promise.all([
    db.auditLog.count({
      where: {
        tenantId: ctx.tenantId,
        action: { contains: 'api_' },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
    db.auditLog.aggregate({
      where: {
        tenantId: ctx.tenantId,
        action: 'llm_call_success',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { llmInputTokens: true, llmOutputTokens: true },
    }),
    db.tender.count(),
    db.pursuit.count({ where: { tenantId: ctx.tenantId } }),
    db.fileUpload.count({ where: { tenantId: ctx.tenantId, createdAt: { gte: periodStart, lte: periodEnd } } }),
  ])

  const llmTokensUsed = (llmTokenSum._sum.llmInputTokens ?? 0) + (llmTokenSum._sum.llmOutputTokens ?? 0)

  const usage = [
    {
      metricType: 'api_calls',
      used: apiCallCount,
      limit: subscription.apiCallsLimit,
      percentage: subscription.apiCallsLimit ? Math.round((apiCallCount / subscription.apiCallsLimit) * 100) : 0,
    },
    {
      metricType: 'llm_tokens',
      used: llmTokensUsed,
      limit: subscription.llmTokensLimit,
      percentage: subscription.llmTokensLimit ? Math.round((llmTokensUsed / subscription.llmTokensLimit) * 100) : 0,
    },
    {
      metricType: 'tenders_tracked',
      used: tenderCount,
      limit: subscription.tendersTrackedLimit,
      percentage: subscription.tendersTrackedLimit ? Math.round((tenderCount / subscription.tendersTrackedLimit) * 100) : 0,
    },
    {
      metricType: 'pursuits',
      used: pursuitCount,
      limit: subscription.pursuitsLimit,
      percentage: subscription.pursuitsLimit ? Math.round((pursuitCount / subscription.pursuitsLimit) * 100) : 0,
    },
    {
      metricType: 'file_uploads',
      used: uploadCount,
      limit: 100, // default file upload limit
      percentage: Math.round((uploadCount / 100) * 100),
    },
  ]

  return NextResponse.json({
    subscription: {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      seatsIncluded: subscription.seatsIncluded,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    usage,
    invoices: subscription.invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
    })),
  })
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

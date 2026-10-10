import { calculateBidPrice, compareBidToTenderUSD } from '@/lib/financial-calculations'
import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/bid-cost-estimates — list bid cost estimates
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const pursuitId = searchParams.get('pursuitId')

  const where: Prisma.BidCostEstimateWhereInput = { tenantId: ctx.tenantId }
  if (pursuitId) where.pursuitId = pursuitId

  const estimates = await db.bidCostEstimate.findMany({
    where,
    include: {
      pursuit: {
        include: { tender: { select: { title: true, market: true, valueUSD: true, currency: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const rates = await db.currencyRate.findMany({ where: { tenantId: ctx.tenantId } })
  return NextResponse.json({ items: estimates.map(e => {
    const comparison = compareBidToTenderUSD(e.proposedPrice, e.currency, e.pursuit.tender.valueUSD, rates, ctx.tenantId, e.createdAt)
    return { ...e, proposedPriceUSD: comparison.proposedPriceUSD, tenderValuePct: comparison.percentage, fxExplanation: comparison.explanation, actualMarginPct: e.proposedPrice > 0 ? e.profitAmount / e.proposedPrice * 100 : null, markupPct: e.totalCost > 0 ? e.profitAmount / e.totalCost * 100 : null }
  }) })
})

// POST /api/bid-cost-estimates — create a bid cost estimate
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'cost')
  const {
    pursuitId, label, currency,
    laborCost, materialsCost, subcontractorCost, overheadCost, travelCost,
    contingencyPct, marginPct, notes, hedgingNotes,
  } = body

  if (!pursuitId || !label) {
    return NextResponse.json({ error: 'pursuitId and label required' }, { status: 400 })
  }

  const pursuit = await db.pursuit.findFirst({
    where: { id: pursuitId, tenantId: ctx.tenantId },
  })
  if (!pursuit) {
    return NextResponse.json({ error: 'Pursuit not found' }, { status: 404 })
  }

  // Compute totals
  const labor = laborCost ?? 0
  const materials = materialsCost ?? 0
  const subcontractor = subcontractorCost ?? 0
  const overhead = overheadCost ?? 0
  const travel = travelCost ?? 0
  const { totalCost, proposedPrice, profitAmount } = calculateBidPrice([labor, materials, subcontractor, overhead, travel], contingencyPct ?? 10, marginPct ?? 20)

  const estimate = await db.bidCostEstimate.create({
    data: {
      tenantId: ctx.tenantId,
      pursuitId,
      label,
      currency: currency ?? 'USD',
      laborCost: labor,
      materialsCost: materials,
      subcontractorCost: subcontractor,
      overheadCost: overhead,
      travelCost: travel,
      contingencyPct: contingencyPct ?? 10,
      totalCost,
      marginPct: marginPct ?? 20,
      proposedPrice,
      profitAmount,
      notes,
      hedgingNotes,
      createdBy: ctx.userId,
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'bid_cost_estimate_created',
    entityType: 'bid_cost_estimate',
    entityId: estimate.id,
    afterJson: { pursuitId, label, totalCost, proposedPrice, profitAmount },
    request: req,
  })

  return NextResponse.json(estimate, { status: 201 })
})

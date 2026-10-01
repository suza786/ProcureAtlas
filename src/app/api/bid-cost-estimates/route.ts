import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/bid-cost-estimates — list bid cost estimates
export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const pursuitId = searchParams.get('pursuitId')

  const where: Record<string, unknown> = { tenantId: ctx.tenantId }
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

  return NextResponse.json({ items: estimates })
}

// POST /api/bid-cost-estimates — create a bid cost estimate
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const {
    pursuitId, label, currency,
    laborCost, materialsCost, subcontractorCost, overheadCost, travelCost,
    contingencyPct, marginPct, notes, hedgingNotes,
  } = body as {
    pursuitId: string
    label: string
    currency?: string
    laborCost?: number
    materialsCost?: number
    subcontractorCost?: number
    overheadCost?: number
    travelCost?: number
    contingencyPct?: number
    marginPct?: number
    notes?: string
    hedgingNotes?: string
  }

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
  const contPct = (contingencyPct ?? 10) / 100
  const margPct = (marginPct ?? 20) / 100

  const subtotal = labor + materials + subcontractor + overhead + travel
  const contingency = subtotal * contPct
  const totalCost = subtotal + contingency
  const profitAmount = totalCost * margPct
  const proposedPrice = totalCost + profitAmount

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
}

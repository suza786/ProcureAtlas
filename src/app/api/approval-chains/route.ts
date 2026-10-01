import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// GET /api/approval-chains — list approval chains
export async function GET() {
  const ctx = await getCurrentTenant()
  const chains = await db.approvalChain.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    items: chains.map(c => ({
      ...c,
      steps: c.stepsJson ? JSON.parse(c.stepsJson) : [],
    })),
  })
}

// POST /api/approval-chains — create an approval chain
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { name, triggerType, slaHours, steps } = body as {
    name: string
    triggerType: string
    slaHours?: number
    steps: Array<{ order: number; role: string; approverEmail?: string; autoApprove?: boolean }>
  }

  if (!name || !triggerType || !steps || steps.length === 0) {
    return NextResponse.json({ error: 'name, triggerType, and steps[] required' }, { status: 400 })
  }

  const chain = await db.approvalChain.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      triggerType,
      slaHours: slaHours ?? 48,
      stepsJson: JSON.stringify(steps),
      stepCount: steps.length,
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'approval_chain_created',
    entityType: 'approval_chain',
    entityId: chain.id,
    afterJson: { name, triggerType, stepCount: steps.length },
    request: req,
  })

  return NextResponse.json(chain, { status: 201 })
}

// PATCH /api/approval-chains — update a chain
export async function PATCH(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { id, name, isActive, slaHours, steps } = body as {
    id: string
    name?: string
    isActive?: boolean
    slaHours?: number
    steps?: Array<{ order: number; role: string; approverEmail?: string; autoApprove?: boolean }>
  }

  const chain = await db.approvalChain.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!chain) {
    return NextResponse.json({ error: 'Chain not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (name) updates.name = name
  if (isActive !== undefined) updates.isActive = isActive
  if (slaHours) updates.slaHours = slaHours
  if (steps) {
    updates.stepsJson = JSON.stringify(steps)
    updates.stepCount = steps.length
  }

  const updated = await db.approvalChain.update({
    where: { id },
    data: updates,
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'approval_chain_updated',
    entityType: 'approval_chain',
    entityId: id,
    afterJson: updates,
    request: req,
  })

  return NextResponse.json(updated)
}

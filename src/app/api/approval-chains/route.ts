import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/auth'
import { validateChainApprovers } from '@/lib/approval-workflow'

// GET /api/approval-chains — list approval chains
export const GET = withApiErrors(async function GET() {
  const { ctx } = await requireTenantWithRole('viewer')
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
})

// POST /api/approval-chains — create an approval chain
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('admin')
  const body = await readJson(req, 'chainCreate')
  const { name, triggerType, slaHours, steps } = body

  if (!name || !triggerType || !steps || steps.length === 0) {
    return NextResponse.json({ error: 'name, triggerType, and steps[] required' }, { status: 400 })
  }

  await validateChainApprovers(db, ctx.tenantId, steps)
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
})

// PATCH /api/approval-chains — update a chain
export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('admin')
  const body = await readJson(req, 'chainUpdate')
  const { id, name, isActive, slaHours, steps } = body

  const chain = await db.approvalChain.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!chain) {
    return NextResponse.json({ error: 'Chain not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (steps) await validateChainApprovers(db, ctx.tenantId, steps)
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
})

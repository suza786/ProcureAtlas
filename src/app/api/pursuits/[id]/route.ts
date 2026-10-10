import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { parseIds, readJson } from '@/lib/api-validation'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import { canAdvancePursuit, complianceSummary } from '@/lib/pursuit-workflow'
import { computeEligibilityScore, computeOpportunityFitScore, computeSubmissionReadinessScore } from '@/lib/scoring'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withApiErrors(async function GET(_req: Request, { params }: RouteContext) {
  const { id } = parseIds(await params)
  const ctx = await getCurrentTenant()
  const p = await db.pursuit.findFirst({ where: { id, tenantId: ctx.tenantId }, include: {
    tender: { include: { buyer: { include: { organization: true } } } }, company: true,
    bid: { include: { tasks: true } }, tasks: true, approvals: { where: { tenantId: ctx.tenantId }, orderBy: { createdAt: 'asc' } },
    complianceItems: { include: { requirement: true, evidence: true } },
  } })
  if (!p) return NextResponse.json({ error: 'Pursuit not found' }, { status: 404 })
  const [eligibility, opportunityFit, submissionReadiness] = await Promise.all([
    computeEligibilityScore(p.tenderId, p.companyId), computeOpportunityFitScore(p.tenderId, p.companyId), computeSubmissionReadinessScore(p.id),
  ])
  const items = p.complianceItems.map(item => ({ ...item, evidence: item.evidence?.companyId === p.companyId ? item.evidence : null }))
  const { complianceItems: _complianceItems, ...pursuit } = p
  return NextResponse.json({
    pursuit: { ...pursuit, tender: { ...p.tender, buyer: p.tender.buyer?.organization?.name ?? null } },
    bid: p.bid ? { ...p.bid, taskCount: p.bid.tasks.length } : null,
    tasks: p.tasks, approvals: p.approvals, compliance: { ...complianceSummary(items), items },
    scoring: { eligibility, opportunityFit, submissionReadiness },
  })
})

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { ctx } = await requireTenantWithRole('manager')
  const { id } = parseIds(await params)
  const input = await readJson(req, 'pursuitUpdate')
  const result = await db.$transaction(async tx => {
    const p = await tx.pursuit.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!p) throw new Response('Pursuit not found', { status: 404 })
    if (p.stage !== input.expectedStage) throw new Response('Pursuit changed; refresh before progressing', { status: 409 })
    if (!canAdvancePursuit(p.stage, input.stage)) throw new Response('Invalid pursuit transition; submission requires the proposal approval workflow', { status: 409 })
    const updated = await tx.pursuit.updateMany({ where: { id, tenantId: ctx.tenantId, stage: input.expectedStage }, data: {
      stage: input.stage, priority: input.priority,
      ...(input.stage !== p.stage && ['bidding', 'no_bid'].includes(input.stage) ? {
        bidDecision: input.stage === 'bidding' ? 'bid' : 'no_bid', decisionBy: ctx.userId, decidedAt: new Date(),
      } : {}),
    } })
    if (updated.count !== 1) throw new Response('Concurrent pursuit update; retry', { status: 409 })
    if (input.stage === 'no_bid') {
      await tx.proposal.updateMany({ where: { pursuitId: id, tenantId: ctx.tenantId, status: { notIn: ['submitted','withdrawn'] } }, data: { status: 'withdrawn', revision: { increment: 1 } } })
      await tx.bid.updateMany({ where: { pursuitId: id, status: { not: 'submitted' } }, data: { status: 'withdrawn', submissionReady: false } })
    } else if (p.stage === 'no_bid' && input.stage === 'qualifying') {
      await tx.bid.updateMany({ where: { pursuitId: id }, data: { status: 'draft', submissionReady: false } })
    }
    const { enqueueOutbox } = await import('@/lib/outbox')
    if (p.stage !== input.stage) await enqueueOutbox(tx, ctx.tenantId, 'webhook.event', { eventType: 'pursuit.stage_changed', data: { id, from: p.stage, to: input.stage } })
    return { before: p, pursuit: await tx.pursuit.findFirst({ where: { id, tenantId: ctx.tenantId } }) }
  }, { isolationLevel: 'Serializable' })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'pursuit_updated', entityType: 'pursuit', entityId: id,
    beforeJson: { stage: result.before.stage }, afterJson: input, request: req })
  return NextResponse.json(result.pursuit)
})

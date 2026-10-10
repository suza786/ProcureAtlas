import { assertProposalReady } from './proposal-workflow'
import type { Prisma } from '@prisma/client'
import { enqueueOutbox } from './outbox'
import { db } from './db'
import { roleAtLeast } from './auth'
import { approvalStepsSchema } from './api-validation'

export async function validateChainApprovers(tx: Pick<Prisma.TransactionClient, 'user'>, tenantId: string, steps: Array<{ role: string; approverEmail?: string }>) {
  for (const step of steps) {
    if (!step.approverEmail) continue
    const user = await tx.user.findFirst({ where: { tenantId, email: step.approverEmail } })
    if (!user || !roleAtLeast(user.role, step.role)) throw new Response('Assigned approver must belong to the tenant and have the required role', { status: 400 })
  }
}

export async function submissionApproved(tx: Prisma.TransactionClient, tenantId: string, pursuitId: string, proposalId: string | null) {
  const approvals = await tx.approval.findMany({ where: { tenantId, pursuitId, triggerType: { in: ['submission', 'pricing', 'legal'] },
    OR: [{ proposalId: null }, ...(proposalId ? [{ proposalId }] : [])] } })
  const chains = await tx.approvalChain.findMany({ where: { tenantId, triggerType: { in: ['submission', 'pricing', 'legal'] }, isActive: true } })
  if (!approvals.some(row => row.triggerType === 'submission') || approvals.some(row => row.decision !== 'approved')) return false
  for (const chain of chains) {
    const steps = approvalStepsSchema.parse(JSON.parse(chain.stepsJson ?? '[]'))
    if (steps.length !== chain.stepCount) return false
    if (!steps.every(step => approvals.some(row => row.chainId === chain.id && row.stepOrder === step.order && row.decision === 'approved'))) return false
  }
  return true
}

export async function createSubmissionApprovals(tx: Prisma.TransactionClient, tenantId: string, pursuitId: string, proposalId: string, requestedBy: string) {
  const chains = await tx.approvalChain.findMany({ where: { tenantId, triggerType: { in: ['submission', 'pricing', 'legal'] }, isActive: true } })
  if (!chains.some(chain => chain.triggerType === 'submission')) {
    await tx.approval.create({ data: { tenantId, pursuitId, proposalId, requestedBy, triggerType: 'submission', stepOrder: 1, approverRole: 'manager' } })
  }
  for (const chain of chains) {
    const steps = approvalStepsSchema.parse(JSON.parse(chain.stepsJson ?? '[]'))
    if (steps.length !== chain.stepCount) throw new Response('Approval chain step count is invalid', { status: 400 })
    for (const step of steps) {
      const assigned = step.approverEmail ? await tx.user.findFirst({ where: { tenantId, email: step.approverEmail } }) : null
      if (step.approverEmail && (!assigned || !roleAtLeast(assigned.role, step.role))) throw new Response('Invalid assigned chain approver', { status: 400 })
      await tx.approval.create({ data: { tenantId, pursuitId, proposalId, requestedBy, chainId: chain.id, triggerType: chain.triggerType,
        stepOrder: step.order, approverRole: step.role, approverId: assigned?.id ?? null, slaDueAt: new Date(Date.now() + chain.slaHours * 3600000) } })
    }
  }
}

export async function decideApproval(actor: { tenantId: string; userId: string; role: string }, id: string,
  input: { decision: string; reason?: string }) {
  return db.$transaction(async tx => {
    const approval = await tx.approval.findFirst({ where: { id, tenantId: actor.tenantId } })
    if (!approval) throw new Response('Approval not found', { status: 404 })
    if (approval.decision !== 'pending') throw new Response('Approval has already been decided', { status: 409 })
    if (['submission','pricing','legal','bid_decision'].includes(approval.triggerType)) {
      const pursuit = await tx.pursuit.findFirst({ where: { id: approval.pursuitId, tenantId: actor.tenantId } })
      if (!pursuit) throw new Response('Pursuit not found', { status: 404 })
      if (['submitted','won','lost','no_bid'].includes(pursuit.stage)) throw new Response('Pursuit is locked for approval decisions', { status: 409 })
    }
    const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId } })
    if (!user || !roleAtLeast(user.role, 'manager') || !roleAtLeast(user.role, approval.approverRole ?? 'manager')) throw new Response('Approver role required', { status: 403 })
    if (approval.approverId && approval.approverId !== actor.userId) throw new Response('Assigned approver required', { status: 403 })
    if (approval.chainId) {
      const chain = await tx.approvalChain.findFirst({ where: { id: approval.chainId, tenantId: actor.tenantId, isActive: true } })
      if (!chain || chain.triggerType !== approval.triggerType) throw new Response('Approval chain unavailable', { status: 409 })
      const steps = approvalStepsSchema.parse(JSON.parse(chain.stepsJson ?? '[]'))
      const step = steps.find(step => step.order === approval.stepOrder)
      if (!step || steps.length !== chain.stepCount) throw new Response('Invalid approval step', { status: 409 })
      if (!roleAtLeast(user.role, step.role) || (step.approverEmail && step.approverEmail !== user.email.toLowerCase())) throw new Response('Assigned chain approver required', { status: 403 })
      const siblings = await tx.approval.findMany({ where: { tenantId: actor.tenantId, pursuitId: approval.pursuitId,
        proposalId: approval.proposalId, chainId: approval.chainId, triggerType: approval.triggerType } })
      if (steps.filter(step => step.order < approval.stepOrder).some(step => !siblings.some(row => row.stepOrder === step.order && row.decision === 'approved'))) {
        throw new Response('Previous approval steps must be approved first', { status: 409 })
      }
    }
    const decidedAt = new Date()
    const result = await tx.approval.updateMany({ where: { id, tenantId: actor.tenantId, decision: 'pending' },
      data: { decision: input.decision, reason: input.reason ?? null, decidedAt, approverId: actor.userId } })
    if (result.count !== 1) throw new Response('Approval was changed concurrently', { status: 409 })
    if (input.decision === 'approved' && ['submission', 'pricing', 'legal'].includes(approval.triggerType) &&
        await submissionApproved(tx, actor.tenantId, approval.pursuitId, approval.proposalId)) {
      if (approval.proposalId) {
        await assertProposalReady(tx, actor.tenantId, approval.proposalId)
        const proposal = await tx.proposal.findFirst({ where: { id: approval.proposalId, tenantId: actor.tenantId } })
        if (!proposal || !['draft','in_review','approved'].includes(proposal.status)) throw new Response('Proposal is locked', { status: 409 })
        await tx.proposal.update({ where: { id: approval.proposalId }, data: { status: 'approved', revision: { increment: 1 } } })
        await tx.bid.upsert({ where: { pursuitId: approval.pursuitId }, create: { pursuitId: approval.pursuitId, status: 'approved', submissionReady: true }, update: { status: 'approved', submissionReady: true } })
      }
    }
    if (input.decision !== 'approved' && approval.proposalId && ['submission','pricing','legal'].includes(approval.triggerType)) {
      await tx.proposal.updateMany({ where: { id: approval.proposalId, tenantId: actor.tenantId, status: { in: ['draft','in_review','approved'] } }, data: { status: 'draft', revision: { increment: 1 } } })
      await tx.bid.updateMany({ where: { pursuitId: approval.pursuitId, status: { not: 'submitted' } }, data: { status: 'draft', submissionReady: false } })
    }
    if (input.decision === 'rejected' && approval.triggerType === 'bid_decision') {
      await tx.pursuit.updateMany({ where: { id: approval.pursuitId, tenantId: actor.tenantId },
        data: { stage: 'no_bid', bidDecision: 'no_bid', decisionReason: input.reason ?? 'Rejected in approval' } })
      await tx.proposal.updateMany({ where: { pursuitId: approval.pursuitId, tenantId: actor.tenantId, status: { notIn: ['submitted','withdrawn'] } }, data: { status: 'withdrawn', revision: { increment: 1 } } })
      await tx.bid.updateMany({ where: { pursuitId: approval.pursuitId, status: { not: 'submitted' } }, data: { status: 'withdrawn', submissionReady: false } })
    }
    await enqueueOutbox(tx, actor.tenantId, 'webhook.event', { eventType: 'approval.decided', data: { id, pursuitId: approval.pursuitId, decision: input.decision } })
    return { ...approval, decision: input.decision, reason: input.reason ?? null, approverId: actor.userId, decidedAt }
  })
}

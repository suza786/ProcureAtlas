import type { Prisma } from '@prisma/client'
import { db } from './db'
import { roleAtLeast } from './auth'
import { requireProposalEvidence } from './evidence-security'
import { evidenceIdsFromJson } from './proposal-integrity'
import { isCurrentVerified } from './evidence-validity'
import { evaluateRequirement } from './requirement-evaluation'
import { submissionApproved } from './approval-workflow'
import { enqueueOutbox } from './outbox'
import { loadTenantEvaluationRequirements } from './tenant-requirement-evaluation'

type Actor = { tenantId: string; userId: string; role: string }
export async function requireEditableProposal(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const proposal = await tx.proposal.findFirst({ where: { id, tenantId }, include: { pursuit: true } })
  if (!proposal) throw new Response('Proposal not found', { status: 404 })
  if (['submitted', 'withdrawn'].includes(proposal.status) || ['submitted', 'won', 'lost'].includes(proposal.pursuit.stage)) {
    throw new Response('This proposal is locked; create a new pursuit for further work', { status: 409 })
  }
  return proposal
}

/** Every content change revokes earlier decisions; reviewers must approve the new text. */
export async function invalidateProposalApprovals(tx: Prisma.TransactionClient, tenantId: string, pursuitId: string, proposalId: string) {
  await tx.approval.updateMany({ where: { tenantId, pursuitId, triggerType: { in: ['submission', 'pricing', 'legal'] },
    OR: [{ proposalId }, { proposalId: null }] }, data: { decision: 'pending', decidedAt: null, reason: null } })
  await tx.bid.updateMany({ where: { pursuitId }, data: { status: 'draft', submissionReady: false, submittedAt: null } })
}

export async function recomputeProposal(tx: Prisma.TransactionClient, id: string, actor: Actor, invalidate = true) {
  const sections = await tx.proposalSection.findMany({ where: { proposalId: id } })
  const proposal = await tx.proposal.update({ where: { id }, data: {
    wordCount: sections.reduce((sum, section) => sum + section.wordCount, 0),
    completedSections: sections.filter(section => section.status === 'approved').length,
    evidenceCoverage: sections.length ? sections.filter(section => section.evidenceCount > 0).length / sections.length : 0,
    revision: { increment: 1 }, lastEditedAt: new Date(), lastEditedBy: actor.userId,
    ...(invalidate ? { status: 'draft' } : {}),
  } })
  if (invalidate) await invalidateProposalApprovals(tx, actor.tenantId, proposal.pursuitId, id)
  return proposal
}

export async function saveProposalSection(actor: Actor, id: string, sectionId: string, input: {
  expectedRevision: number; content?: string; status?: string; evidenceIds?: string[]; assignedTo?: string
}) {
  return db.$transaction(async tx => {
    const proposal = await requireEditableProposal(tx, actor.tenantId, id)
    const section = await tx.proposalSection.findUnique({ where: { id: sectionId, proposalId: id } })
    if (!section) throw new Response('Section not found', { status: 404 })
    if (section.revision !== input.expectedRevision) throw new Response('Section changed in another session. Reload before saving.', { status: 409 })
    const ids = await requireProposalEvidence(input.evidenceIds ?? evidenceIdsFromJson(section.evidenceIds), actor.tenantId, proposal.pursuit.companyId, tx)
    if (input.assignedTo && !await tx.user.findFirst({ where: { id: input.assignedTo, tenantId: actor.tenantId } })) throw new Response('Assignee not found', { status: 404 })
    if (input.status === 'approved' && !roleAtLeast(actor.role, 'manager')) throw new Response('Manager review required', { status: 403 })
    const content = input.content ?? section.content ?? ''
    const hasGaps = ids.length === 0 || /\[(?:gap|missing evidence)[^\]]*\]/i.test(content)
    if (input.status === 'approved' && (!content.trim() || hasGaps)) throw new Response('Resolve content and evidence gaps before approval', { status: 409 })
    const changed = input.content !== undefined && input.content !== section.content || input.evidenceIds !== undefined
    const status = input.status ?? (changed ? 'drafting' : section.status)
    const result = await tx.proposalSection.updateMany({ where: { id: sectionId, proposalId: id, revision: input.expectedRevision }, data: {
      content, wordCount: content.trim().split(/\s+/).filter(Boolean).length, status,
      evidenceIds: JSON.stringify(ids), evidenceCount: ids.length, hasGaps, assignedTo: input.assignedTo,
      revision: { increment: 1 }, lastEditedAt: new Date(), lastEditedBy: actor.userId,
    } })
    if (result.count !== 1) throw new Response('Section changed concurrently', { status: 409 })
    const updatedProposal = await recomputeProposal(tx, id, actor, changed || status !== 'approved')
    const updated = await tx.proposalSection.findUniqueOrThrow({ where: { id: sectionId } })
    return { ...updated, proposalRevision: updatedProposal.revision, proposal: updatedProposal }
  })
}

export async function assertProposalReady(tx: Prisma.TransactionClient, tenantId: string, proposalId: string) {
  const proposal = await tx.proposal.findFirst({ where: { id: proposalId, tenantId }, include: { sections: true,
    pursuit: { include: { tender: { include: { requirements: true } }, company: { include: { evidence: true } }, complianceItems: { include: { evidence: true } }, tasks: true } } } })
  if (!proposal) throw new Response('Proposal not found', { status: 404 })
  if (proposal.pursuit.stage !== 'bidding') throw new Response('Pursuit must be bidding before final approval or submission', { status: 409 })
  if (!proposal.sections.length || proposal.sections.some(section => section.status !== 'approved' || section.hasGaps || !section.content?.trim())) {
    throw new Response('All proposal sections require human approval and resolved gaps', { status: 409 })
  }
  for (const section of proposal.sections) {
    const ids = evidenceIdsFromJson(section.evidenceIds)
    if (!ids.length) throw new Response('Every section must reference current evidence', { status: 409 })
    await requireProposalEvidence(ids, tenantId, proposal.pursuit.companyId, tx)
  }
  const now = new Date()
  const rates = await tx.currencyRate.findMany({ where: { tenantId, rateDate: { lte: now } } })
  const requirements = await loadTenantEvaluationRequirements(tenantId, proposal.pursuit.tenderId, proposal.pursuit.tender.requirements, tx)
  for (const requirement of requirements.filter(row => row.isMandatory)) {
    const compliance = proposal.pursuit.complianceItems.find(row => row.requirementId === requirement.id)
    if (!requirement.id?.startsWith('tenant-review:') && (!compliance || compliance.status !== 'compliant' || !compliance.evidence ||
      compliance.evidence.companyId !== proposal.pursuit.companyId || !isCurrentVerified(compliance.evidence))) {
      throw new Response('Mandatory compliance requires verified current evidence', { status: 409 })
    }
    if (evaluateRequirement(requirement, proposal.pursuit.company.evidence, rates, tenantId, now).status !== 'pass') {
      throw new Response('Mandatory eligibility must be resolved and fully satisfied', { status: 409 })
    }
  }
  if (proposal.pursuit.tasks.some(task => task.status !== 'done')) throw new Response('Complete bid tasks before submission', { status: 409 })
  if (!await submissionApproved(tx, tenantId, proposal.pursuitId, proposalId)) throw new Response('All required approvals must be completed', { status: 409 })
  return proposal
}

export async function transitionProposal(actor: Actor, id: string, input: { expectedRevision: number; status?: string; title?: string }) {
  return db.$transaction(async tx => {
    const proposal = await tx.proposal.findFirst({ where: { id, tenantId: actor.tenantId }, include: { pursuit: true } })
    if (!proposal) throw new Response('Proposal not found', { status: 404 })
    if (proposal.revision !== input.expectedRevision) throw new Response('Proposal changed; reload before continuing', { status: 409 })
    const status = input.status ?? proposal.status
    const allowed: Record<string, string[]> = { draft: ['draft','in_review','withdrawn'], in_review: ['draft','in_review','approved','withdrawn'], approved: ['draft','approved','submitted','withdrawn'], submitted: ['submitted'], withdrawn: [] }
    if (!allowed[proposal.status]?.includes(status)) throw new Response('Invalid proposal transition', { status: 409 })
    if (['approved','submitted','withdrawn'].includes(status) && !roleAtLeast(actor.role, 'manager')) throw new Response('Manager role required', { status: 403 })
    if (proposal.status === 'submitted' && input.title) throw new Response('Submitted proposal is locked', { status: 409 })
    if (['approved','submitted'].includes(status)) await assertProposalReady(tx, actor.tenantId, id)
    if (status === 'submitted' && proposal.pursuit.stage !== 'bidding') throw new Response('Pursuit must be bidding before submission', { status: 409 })
    if (status === 'withdrawn' && ['submitted','won','lost'].includes(proposal.pursuit.stage)) throw new Response('Submitted pursuit is locked', { status: 409 })
    const submittedAt = status === 'submitted' ? new Date() : null
    const claimed = await tx.proposal.updateMany({ where: { id, tenantId: actor.tenantId, revision: input.expectedRevision }, data: {
      status, title: input.title, revision: { increment: 1 }, lastEditedBy: actor.userId, lastEditedAt: new Date(), ...(submittedAt ? { submittedAt } : {}),
    } })
    if (claimed.count !== 1) throw new Response('Proposal changed concurrently', { status: 409 })
    if (status === 'draft') await invalidateProposalApprovals(tx, actor.tenantId, proposal.pursuitId, id)
    else await tx.bid.upsert({ where: { pursuitId: proposal.pursuitId }, create: { pursuitId: proposal.pursuitId, status, submissionReady: ['approved','submitted'].includes(status), submittedAt }, update: { status, submissionReady: ['approved','submitted'].includes(status), submittedAt } })
    if (status === 'submitted') await tx.pursuit.update({ where: { id: proposal.pursuitId }, data: { stage: 'submitted' } })
    if (status === 'withdrawn') await tx.pursuit.update({ where: { id: proposal.pursuitId }, data: { stage: 'no_bid', bidDecision: 'no_bid', decisionReason: 'Proposal withdrawn', decidedAt: new Date(), decisionBy: actor.userId } })
    if (status !== proposal.status) await enqueueOutbox(tx, actor.tenantId, 'webhook.event', { eventType: `proposal.${status}`, data: { id, pursuitId: proposal.pursuitId, status } })
    return tx.proposal.findUniqueOrThrow({ where: { id } })
  })
}

export async function createProposalVersion(actor: Actor, id: string, input: { expectedRevision: number; changeSummary?: string }) {
  return db.$transaction(async tx => {
    const proposal = await tx.proposal.findFirst({ where: { id, tenantId: actor.tenantId }, include: { sections: { orderBy: { order: 'asc' } }, pursuit: { include: { company: { include: { evidence: true, certifications: true, projectRefs: true } } } } } })
    if (!proposal) throw new Response('Proposal not found', { status: 404 })
    if (proposal.revision !== input.expectedRevision) throw new Response('Proposal changed; save or reload before versioning', { status: 409 })
    const latest = await tx.proposalVersion.aggregate({ where: { proposalId: id }, _max: { versionNumber: true } })
    const versionNumber = Math.max(proposal.currentVersion, latest._max.versionNumber ?? 0) + 1
    const claimed = await tx.proposal.updateMany({ where: { id, revision: input.expectedRevision }, data: { currentVersion: versionNumber, revision: { increment: 1 } } })
    if (claimed.count !== 1) throw new Response('Proposal version changed concurrently', { status: 409 })
    const company = proposal.pursuit.company
    if (company.tenantId !== actor.tenantId) throw new Response('Company not found', { status: 404 })
    const records = [...company.evidence, ...company.certifications, ...company.projectRefs]
    const capturedAt = new Date()
    const sections = proposal.sections.map(section => {
      const evidenceIds = evidenceIdsFromJson(section.evidenceIds)
      return { ...section, evidenceIds, evidenceReferences: evidenceIds.map(evidenceId => {
        const record = records.find(row => row.id === evidenceId)
        return record ? { ...record, validAtSnapshot: isCurrentVerified(record, capturedAt) } : { id: evidenceId, missing: true, validAtSnapshot: false }
      }) }
    })
    return tx.proposalVersion.create({ data: { proposalId: id, versionNumber, snapshotJson: JSON.stringify({ capturedAt, proposalRevision: proposal.revision, sections }), wordCount: sections.reduce((sum, row) => sum + row.wordCount, 0), sectionCount: sections.length, changeSummary: input.changeSummary ?? `Version ${versionNumber}`, createdBy: actor.userId } })
  })
}

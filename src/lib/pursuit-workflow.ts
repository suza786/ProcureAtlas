import { assertPursuitQuota } from './usage-meter'
import { enqueueOutbox } from './outbox'
import { type Prisma } from '@prisma/client'
import { isCurrentVerified } from '@/lib/evidence-validity'

const transitions: Record<string, readonly string[]> = {
  discovering: ['qualifying', 'no_bid'],
  qualifying: ['bidding', 'no_bid'],
  bidding: ['no_bid'],
  submitted: ['won', 'lost'],
  no_bid: ['qualifying'],
  won: [], lost: [],
}

/** Submission belongs exclusively to the proposal approval workflow. */
export function canAdvancePursuit(from: string, to: string): boolean {
  return from === to || (transitions[from]?.includes(to) ?? false)
}

export async function initializePursuit(tx: Prisma.TransactionClient, tenantId: string, tenderId: string, companyId?: string, priority = 'medium') {
  const companies = await tx.company.findMany({ where: { tenantId, ...(companyId ? { id: companyId } : {}) }, select: { id: true }, take: 2 })
  if (!companies.length) throw new Response('Company not found in tenant scope', { status: 404 })
  if (companies.length !== 1) throw Response.json({ error: 'Select a company before creating a pursuit', code: 'COMPANY_SELECTION_REQUIRED' }, { status: 400 })
  const selectedCompanyId = companies[0].id
  const tender = await tx.tender.findUnique({ where: { id: tenderId }, select: { id: true, valueUSD: true, requirements: { select: { id: true } } } })
  if (!tender) throw new Response('Tender not found', { status: 404 })
  const existing = await tx.pursuit.findFirst({ where: { tenantId, tenderId, companyId: selectedCompanyId } })
  if (existing) return { pursuit: existing, created: false }
  await assertPursuitQuota(tx, tenantId, tenderId)
  const pursuit = await tx.pursuit.create({ data: {
    tenantId, tenderId, companyId: selectedCompanyId, stage: 'discovering', bidDecision: 'pending', priority,
    estimatedValueUSD: tender.valueUSD,
    bid: { create: { status: 'draft', submissionReady: false } },
    complianceItems: { create: tender.requirements.map(requirement => ({ requirementId: requirement.id, status: 'gap', confidence: 0 })) },
  } })
  await enqueueOutbox(tx, tenantId, 'webhook.event', { eventType: 'pursuit.created', data: { id: pursuit.id, tenderId, companyId: selectedCompanyId } })
  return { pursuit, created: true }
}

export function complianceSummary(items: Array<{ status: string }>) {
  const count = (status: string) => items.filter(item => item.status === status).length
  const compliant = count('compliant'), partial = count('partial'), not_applicable = count('not_applicable')
  const applicable = items.length - not_applicable
  return { total: items.length, compliant, partial, gap: count('gap'), not_applicable,
    coveragePct: applicable ? Math.round((compliant + partial * 0.5) / applicable * 100) : 0 }
}

/** Readiness decisions must be repeated after their supporting records change. */
export async function invalidatePursuitReview(tx: Prisma.TransactionClient, tenantId: string, pursuitId: string) {
  await tx.approval.updateMany({ where: { tenantId, pursuitId, triggerType: { in: ['submission', 'pricing', 'legal'] } },
    data: { decision: 'pending', decidedAt: null, reason: null } })
  await tx.proposal.updateMany({ where: { tenantId, pursuitId, status: { in: ['draft', 'in_review', 'approved'] } },
    data: { status: 'draft', revision: { increment: 1 } } })
  await tx.bid.updateMany({ where: { pursuitId }, data: { status: 'draft', submissionReady: false, submittedAt: null } })
}

export async function updateCompliance(tx: Prisma.TransactionClient, tenantId: string, pursuitId: string,
  input: { requirementId: string; status: string; evidenceId?: string | null; notes?: string | null }) {
  const pursuit = await tx.pursuit.findFirst({ where: { id: pursuitId, tenantId }, select: { companyId: true, tenderId: true, stage: true } })
  if (!pursuit) throw new Response('Pursuit not found', { status: 404 })
  if (['submitted', 'won', 'lost'].includes(pursuit.stage)) throw new Response('Submitted pursuit compliance is locked', { status: 409 })
  const requirement = await tx.requirement.findFirst({ where: { id: input.requirementId, tenderId: pursuit.tenderId } })
  if (!requirement) throw new Response('Requirement not found for this tender', { status: 404 })
  const current = await tx.complianceItem.findFirst({ where: { pursuitId, requirementId: input.requirementId } })
  const evidenceId = input.evidenceId === undefined ? current?.evidenceId ?? null : input.evidenceId
  const evidence = evidenceId ? await tx.evidence.findFirst({ where: { id: evidenceId, companyId: pursuit.companyId, company: { tenantId } } }) : null
  if (evidenceId && !evidence) throw new Response('Evidence not found for this company', { status: 404 })
  if (input.status === 'compliant' && (!evidence || !isCurrentVerified(evidence))) {
    throw new Response('Compliant status requires current, verified company evidence', { status: 400 })
  }
  const data = { status: input.status, evidenceId, notes: input.notes, confidence: evidence ? evidence.confidence : 0 }
  const item = await tx.complianceItem.upsert({ where: { pursuitId_requirementId: { pursuitId, requirementId: input.requirementId } },
    create: { pursuitId, requirementId: input.requirementId, ...data }, update: data, include: { requirement: true, evidence: true } })
  await invalidatePursuitReview(tx, tenantId, pursuitId)
  return item
}

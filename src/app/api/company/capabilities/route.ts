import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'
import { withApiErrors } from '@/lib/api-errors'
import { logAction } from '@/lib/auth'
import { isCurrentVerifiedEvidence } from '@/lib/requirement-evaluation'
import { pagination, validatedSearch, idSchema, currencySchema } from '@/lib/api-validation'
import { evidenceSupportsCapability } from '@/lib/capability-facts'
import { readWebhookBody } from '@/lib/inbound-webhook'

const fields = z.object({ companyId: idSchema, organizationId: idSchema.nullable().optional(), kind: z.enum(['sector', 'certification', 'turnover', 'jv_history', 'project_sector']), value: z.string().trim().min(1).max(500), amount: z.number().finite().nonnegative().max(1e12).nullable().optional(), currency: currencySchema.nullable().optional(), evidenceId: idSchema }).strict()
const validFact = (body: z.infer<typeof fields>) => {
  if (body.kind === 'turnover' && (body.amount == null || !body.currency)) throw new Response('Turnover requires an amount and currency', { status: 400 })
}

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { limit, offset } = pagination(validatedSearch(req), 50, 100)
  const companyId = req.nextUrl.searchParams.get('companyId')
  const organizationId = req.nextUrl.searchParams.get('organizationId')
  const page = await db.capabilityFact.findMany({ where: { tenantId: ctx.tenantId, ...(companyId ? { companyId } : {}), ...(organizationId ? { organizationId } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, skip: offset })
  const facts = page.slice(0, limit)
  const evidence = await db.evidence.findMany({ where: { id: { in: facts.map(fact => fact.evidenceId) }, company: { tenantId: ctx.tenantId } } })
  return NextResponse.json({ items: facts.map(fact => ({ ...fact, supported: evidence.some(item => item.id === fact.evidenceId && item.companyId === fact.companyId && isCurrentVerifiedEvidence(item) && evidenceSupportsCapability(fact, item)) })), limit, offset, hasMore: page.length > limit })
})

async function assertLinks(tx: Prisma.TransactionClient, tenantId: string, body: z.infer<typeof fields>) {
  const company = await tx.company.findFirst({ where: { id: body.companyId, tenantId } })
  if (!company) throw new Response('Company not found', { status: 404 })
  const evidence = await tx.evidence.findFirst({ where: { id: body.evidenceId, companyId: body.companyId, company: { tenantId } } })
  if (!evidence) throw new Response('Evidence not found for this company', { status: 404 })
  if (!evidenceSupportsCapability({ kind: body.kind, amount: body.amount ?? null, currency: body.currency ?? null }, evidence)) throw new Response('Evidence does not support this fact type; turnover must match reviewed annual turnover amount/currency', { status: 400 })
  if (body.organizationId && !await tx.organization.findFirst({ where: { id: body.organizationId, orgType: 'supplier' } })) throw new Response('Supplier not found', { status: 404 })
  if (body.kind === 'jv_history') {
    idSchema.parse(body.value)
    if (!await tx.organization.findFirst({ where: { id: body.value, orgType: 'supplier' } }) && !await tx.company.findFirst({ where: { id: body.value, tenantId } })) throw new Response('Prior JV partner not found', { status: 404 })
  }
}

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const body = fields.parse(JSON.parse(await readWebhookBody(req, 16384)))
  validFact(body)
  const fact = await db.$transaction(async tx => { await assertLinks(tx, ctx.tenantId, body); return tx.capabilityFact.create({ data: { ...body, tenantId: ctx.tenantId } }) })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'capability_fact_created', entityType: 'capability_fact', entityId: fact.id, afterJson: body, request: req })
  return NextResponse.json(fact, { status: 201 })
})

export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const { id, ...body } = fields.extend({ id: idSchema }).parse(JSON.parse(await readWebhookBody(req, 16384)))
  validFact(body)
  const fact = await db.$transaction(async tx => {
    if (!await tx.capabilityFact.findFirst({ where: { id, tenantId: ctx.tenantId } })) throw new Response('Capability fact not found', { status: 404 })
    await assertLinks(tx, ctx.tenantId, body)
    return tx.capabilityFact.update({ where: { id }, data: body })
  })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'capability_fact_updated', entityType: 'capability_fact', entityId: id, afterJson: body, request: req })
  return NextResponse.json(fact)
})

export const DELETE = withApiErrors(async function DELETE(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const id = z.string().min(1).max(200).parse(req.nextUrl.searchParams.get('id'))
  const deleted = await db.capabilityFact.deleteMany({ where: { id, tenantId: ctx.tenantId } })
  if (!deleted.count) throw new Response('Capability fact not found', { status: 404 })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'capability_fact_deleted', entityType: 'capability_fact', entityId: id, request: req })
  return NextResponse.json({ deleted: true })
})

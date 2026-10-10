import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { parseIds, readJson } from '@/lib/api-validation'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'
import { complianceSummary, updateCompliance } from '@/lib/pursuit-workflow'
import { isCurrentVerified } from '@/lib/evidence-validity'
import { logAction } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }
export const GET = withApiErrors(async function GET(_req: Request, { params }: RouteContext) {
  const { id } = parseIds(await params)
  const ctx = await getCurrentTenant()
  const pursuit = await db.pursuit.findFirst({ where: { id, tenantId: ctx.tenantId }, include: {
    tender: { select: { id: true, title: true } }, complianceItems: { include: { requirement: true, evidence: true }, orderBy: { createdAt: 'asc' } },
  } })
  if (!pursuit) return NextResponse.json({ error: 'Pursuit not found' }, { status: 404 })
  const items = pursuit.complianceItems.map(item => {
    const evidence = item.evidence?.companyId === pursuit.companyId ? item.evidence : null
    return { ...item, evidence, evidenceValid: evidence ? isCurrentVerified(evidence) : false }
  })
  return NextResponse.json({ pursuitId: id, tenderId: pursuit.tenderId, tenderTitle: pursuit.tender.title, items, summary: complianceSummary(items) })
})

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { ctx } = await requireTenantWithRole('contributor')
  const { id } = parseIds(await params)
  const input = await readJson(req, 'complianceUpdate')
  const item = await db.$transaction(tx => updateCompliance(tx, ctx.tenantId, id, input), { isolationLevel: 'Serializable' })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'compliance_updated', entityType: 'pursuit', entityId: id, afterJson: input, request: req })
  return NextResponse.json(item)
})

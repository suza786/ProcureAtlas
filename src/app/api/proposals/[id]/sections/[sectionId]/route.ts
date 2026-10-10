import { readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { saveProposalSection } from '@/lib/proposal-workflow'
import { logAction } from '@/lib/auth'
export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const { id, sectionId } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')
  const input = await readJson(req, 'section')
  const updated = await saveProposalSection(ctx, id, sectionId, input)
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'proposal_section_updated', entityType: 'proposal_section', entityId: sectionId, afterJson: { status: updated.status, revision: updated.revision }, request: req })
  return NextResponse.json(updated)
})

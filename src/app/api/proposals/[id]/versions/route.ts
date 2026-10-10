import { createProposalVersion } from '@/lib/proposal-workflow'
import { readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// POST /api/proposals/[id]/versions — create a version snapshot
export const POST = withApiErrors(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')
  const body = await readJson(req, 'version')
  const { changeSummary } = body

  const version = await createProposalVersion(ctx, id, body)
  const versionNumber = version.versionNumber

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'proposal_version_created',
    entityType: 'proposal',
    entityId: id,
    afterJson: { versionNumber, changeSummary },
    request: req,
  })

  return NextResponse.json(version, { status: 201 })
})

// GET /api/proposals/[id]/versions — list versions
export const GET = withApiErrors(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const ctx = await getCurrentTenant()

  const versions = await db.proposalVersion.findMany({
    where: { proposal: { id, tenantId: ctx.tenantId } },
    orderBy: { versionNumber: 'desc' },
  })

  return NextResponse.json({ items: versions })
})

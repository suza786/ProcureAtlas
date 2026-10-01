import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'

// POST /api/proposals/[id]/versions — create a version snapshot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { changeSummary } = body as { changeSummary?: string }

  const proposal = await db.proposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { sections: { orderBy: { order: 'asc' } } },
  })
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const versionNumber = proposal.currentVersion + 1
  const snapshot = {
    sections: proposal.sections.map(s => ({
      id: s.id,
      sectionType: s.sectionType,
      title: s.title,
      content: s.content,
      wordCount: s.wordCount,
      status: s.status,
      evidenceCount: s.evidenceCount,
      hasGaps: s.hasGaps,
    })),
  }

  const version = await db.proposalVersion.create({
    data: {
      proposalId: id,
      versionNumber,
      snapshotJson: JSON.stringify(snapshot),
      wordCount: proposal.wordCount,
      sectionCount: proposal.sections.length,
      changeSummary: changeSummary ?? `Version ${versionNumber}`,
      createdBy: ctx.userId,
    },
  })

  await db.proposal.update({
    where: { id },
    data: { currentVersion: versionNumber },
  })

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
}

// GET /api/proposals/[id]/versions — list versions
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()

  const versions = await db.proposalVersion.findMany({
    where: { proposal: { id, tenantId: ctx.tenantId } },
    orderBy: { versionNumber: 'desc' },
  })

  return NextResponse.json({ items: versions })
}

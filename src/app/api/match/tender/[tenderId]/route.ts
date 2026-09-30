import { NextResponse } from 'next/server'
import { getCurrentTenant } from '@/lib/tenant'
import { computeTenderMatchForTenant } from '@/lib/matching'

// GET /api/match/tender/[tenderId] — semantic match score for a tender vs tenant's company
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params
  const ctx = await getCurrentTenant()

  const match = await computeTenderMatchForTenant(tenderId, ctx.tenantId)

  if (!match) {
    return NextResponse.json({ error: 'Tender or company not found' }, { status: 404 })
  }

  return NextResponse.json({
    tenderId,
    ...match,
    engine: 'deterministic-v1 (pgvector-ready)',
    note: 'Phase 3 uses deterministic tag+keyword+capability matching. Production with PostgreSQL pgvector will use cosine similarity over embeddings.',
  })
}

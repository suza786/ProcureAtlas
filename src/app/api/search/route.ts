import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/search — faceted search across tenders, awards, buyers, suppliers
// Phase 3: SQLite-backed (deterministic). Prod will use OpenSearch.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const types = searchParams.get('types')?.split(',') ?? ['tender', 'award', 'buyer', 'supplier']
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  const results: Array<{ type: string; id: string; title: string; subtitle: string; market?: string; sector?: string; value?: number; url?: string }> = []

  if (q.length < 2) {
    return NextResponse.json({ results: [], facets: {}, total: 0 })
  }

  // Search tenders
  if (types.includes('tender')) {
    const tenders = await db.tender.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { titleLocal: { contains: q } },
        ],
        ...(market ? { market } : {}),
        ...(sector ? { sector } : {}),
      },
      include: { buyer: { include: { organization: true } } },
      take: limit,
      orderBy: { submissionDeadline: 'asc' },
    })
    tenders.forEach(t => {
      results.push({
        type: 'tender',
        id: t.id,
        title: t.title,
        subtitle: t.buyer?.organization?.name ?? 'Unknown buyer',
        market: t.market,
        sector: t.sector,
        value: t.valueUSD ?? undefined,
      })
    })
  }

  // Search buyers
  if (types.includes('buyer')) {
    const buyers = await db.organization.findMany({
      where: {
        orgType: 'buyer',
        OR: [
          { name: { contains: q } },
          { city: { contains: q } },
          { country: { contains: q } },
        ],
      },
      take: limit,
    })
    buyers.forEach(b => {
      results.push({
        type: 'buyer',
        id: b.id,
        title: b.name,
        subtitle: [b.city, b.country].filter(Boolean).join(', '),
      })
    })
  }

  // Search suppliers
  if (types.includes('supplier')) {
    const suppliers = await db.organization.findMany({
      where: {
        orgType: 'supplier',
        OR: [
          { name: { contains: q } },
          { city: { contains: q } },
          { country: { contains: q } },
        ],
      },
      take: limit,
    })
    suppliers.forEach(s => {
      results.push({
        type: 'supplier',
        id: s.id,
        title: s.name,
        subtitle: [s.city, s.country].filter(Boolean).join(', '),
      })
    })
  }

  // Search awards (by tender title or supplier name)
  if (types.includes('award')) {
    const awards = await db.award.findMany({
      where: {
        OR: [
          { tender: { title: { contains: q } } },
          { supplier: { name: { contains: q } } },
        ],
      },
      include: {
        tender: { select: { title: true, market: true, sector: true } },
        supplier: { select: { name: true } },
      },
      take: limit,
      orderBy: { awardedAt: 'desc' },
    })
    awards.forEach(a => {
      results.push({
        type: 'award',
        id: a.id,
        title: a.tender.title,
        subtitle: `Awarded to ${a.supplier.name}`,
        market: a.tender.market,
        sector: a.tender.sector,
        value: a.contractValue ?? undefined,
      })
    })
  }

  // Compute facets
  const facets: Record<string, Record<string, number>> = {
    type: {},
    market: {},
    sector: {},
  }
  results.forEach(r => {
    facets.type[r.type] = (facets.type[r.type] ?? 0) + 1
    if (r.market) facets.market[r.market] = (facets.market[r.market] ?? 0) + 1
    if (r.sector) facets.sector[r.sector] = (facets.sector[r.sector] ?? 0) + 1
  })

  return NextResponse.json({
    query: q,
    total: results.length,
    results: results.slice(0, limit * 2),
    facets,
  })
}

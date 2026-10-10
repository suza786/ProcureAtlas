import { validatedSearch } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { getCurrentTenant } from '@/lib/tenant'
import { pagination } from '@/lib/api-validation'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/search — faceted search across tenders, awards, buyers, suppliers
// Phase 3: SQLite-backed (deterministic). Prod will use OpenSearch.
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const q = (searchParams.get('q') ?? '').trim()
  const types = searchParams.get('types')?.split(',') ?? ['tender', 'award', 'buyer', 'supplier', 'company', 'pursuit']
  if (types.some(type => !['tender', 'award', 'buyer', 'supplier', 'company', 'pursuit'].includes(type))) return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const { limit } = pagination(searchParams, 20, 100)

  const results: Array<{ type: string; id: string; title: string; subtitle: string; market?: string; sector?: string; value?: number; tenderId?: string }> = []

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
        tenderId: a.tenderId,
        title: a.tender.title,
        subtitle: `Awarded to ${a.supplier.name}`,
        market: a.tender.market,
        sector: a.tender.sector,
        value: a.valueUSD ?? (a.currency === 'USD' ? a.contractValue ?? undefined : undefined),
      })
    })
  }

  if (types.includes('company')) {
    const companies = await db.company.findMany({ where: { tenantId: ctx.tenantId, OR: [{ name: { contains: q } }, { description: { contains: q } }] }, select: { id: true, name: true, country: true }, take: limit, orderBy: { name: 'asc' } })
    results.push(...companies.map(company => ({ type: 'company', id: company.id, title: company.name, subtitle: company.country })))
  }
  if (types.includes('pursuit')) {
    const pursuits = await db.pursuit.findMany({ where: { tenantId: ctx.tenantId, tender: { title: { contains: q } } }, select: { id: true, stage: true, tender: { select: { title: true, market: true } } }, take: limit, orderBy: { updatedAt: 'desc' } })
    results.push(...pursuits.map(pursuit => ({ type: 'pursuit', id: pursuit.id, title: pursuit.tender.title, subtitle: pursuit.stage, market: pursuit.tender.market })))
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
    returned: Math.min(results.length, limit * 2),
    totalIsSample: true,
    results: results.slice(0, limit * 2),
    facets,
  })
})

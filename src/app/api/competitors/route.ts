import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { normalizeAward } from '@/lib/financial-calculations'
import { cachedCatalog, organizationAwardStats, summaryStats, supplierFacets } from '@/lib/catalog-analytics'

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const params = validatedSearch(req)
  const search = params.get('search') ?? ''
  const { limit, offset } = pagination(params)
  const result = await cachedCatalog(`suppliers:${JSON.stringify({ search, limit, offset })}`, async () => {
    const where: Prisma.OrganizationWhereInput = { orgType: 'supplier', ...(search ? { OR: [{ name: { contains: search } }, { country: { contains: search } }] } : {}) }
    const [suppliers, total] = await Promise.all([
      db.organization.findMany({ where, take: limit, skip: offset, orderBy: [{ name: 'asc' }, { id: 'asc' }], include: { awards: { take: 3, orderBy: [{ awardedAt: 'desc' }, { id: 'asc' }], include: { tender: { select: { title: true, sector: true, market: true, valueUSD: true } } } } } }),
      db.organization.count({ where }),
    ])
    const ids = suppliers.map(s => s.id)
    const [stats, facets] = await Promise.all([organizationAwardStats(ids, 'supplier'), supplierFacets(ids)])
    return { total, items: suppliers.map(s => ({ id: s.id, name: s.name, country: s.country, city: s.city, website: s.website,
      stats: { ...summaryStats(stats.find(a => a.id === s.id)), sectorsWon: facets.filter(f => f.ownerId === s.id && f.dimension === 'sector').map(f => [f.name, f.count]), topBuyers: facets.filter(f => f.ownerId === s.id && f.dimension === 'buyer').map(f => [f.name, f.count]) },
      recentAwards: s.awards.map(a => normalizeAward(a, [], 'public')),
    })) }
  })
  const annotations = await db.tenantSupplierAnnotation.findMany({ where: { tenantId: ctx.tenantId, organizationId: { in: result.items.map(s => s.id) } } })
  return NextResponse.json({ ...result, limit, offset, normalizationBasis: 'persisted USD or original USD', items: result.items.map(s => { const note = annotations.find(a => a.organizationId === s.id); return { ...s, isCompetitor: note?.isCompetitor ?? false, isPartner: note?.isPartner ?? false, notes: note?.notes ?? null } }) })
})

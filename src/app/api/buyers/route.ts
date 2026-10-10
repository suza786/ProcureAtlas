import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { normalizeAward } from '@/lib/financial-calculations'
import { cachedCatalog, organizationAwardStats, summaryStats } from '@/lib/catalog-analytics'

export const GET = withApiErrors(async function GET(req: NextRequest) {
  await getCurrentTenant()
  const params = validatedSearch(req)
  const search = params.get('search') ?? ''
  const { limit, offset } = pagination(params)
  const result = await cachedCatalog(`buyers:${JSON.stringify({ search, limit, offset })}`, async () => {
    const where: Prisma.OrganizationWhereInput = { orgType: 'buyer', ...(search ? { OR: [{ name: { contains: search } }, { city: { contains: search } }, { country: { contains: search } }] } : {}) }
    const [buyers, total] = await Promise.all([
      db.organization.findMany({ where, take: limit, skip: offset, orderBy: [{ name: 'asc' }, { id: 'asc' }], include: { buyers: { take: 1, orderBy: { id: 'asc' } } } }), db.organization.count({ where }),
    ])
    const ids = buyers.flatMap(b => b.buyers.map(buyer => buyer.id))
    const [stats, tenderGroups, recent] = await Promise.all([
      organizationAwardStats(ids, 'buyer'),
      db.tender.groupBy({ by: ['buyerId', 'sector'], where: { buyerId: { in: ids } }, _count: { _all: true } }),
      ids.length ? db.$queryRaw<Array<{ id: string; buyerId: string }>>(Prisma.sql`WITH ranked AS (SELECT a.id, t."buyerId", ROW_NUMBER() OVER (PARTITION BY t."buyerId" ORDER BY a."awardedAt" DESC, a.id ASC) AS rank FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" WHERE t."buyerId" IN (${Prisma.join(ids)})) SELECT id, "buyerId" FROM ranked WHERE rank<=3`) : [],
    ])
    const awards = await db.award.findMany({ where: { id: { in: recent.map(a => a.id) } }, include: { supplier: { select: { name: true, country: true } } }, orderBy: [{ awardedAt: 'desc' }, { id: 'asc' }] })
    return { total, items: buyers.map(b => {
      const buyerId = b.buyers[0]?.id
      const stat = stats.find(s => s.id === buyerId)
      const sectors = tenderGroups.filter(t => t.buyerId === buyerId).sort((a,b) => b._count._all-a._count._all)
      return { id: b.id, name: b.name, country: b.country, city: b.city, website: b.website,
        ...summaryStats(stat), totalTenders: sectors.reduce((n,g) => n+g._count._all,0), incumbentCount: stat?.distinctWinnerCount ?? 0,
        topSectors: sectors.slice(0,3).map(g => [g.sector,g._count._all]),
        recentAwards: awards.filter(a => recent.some(r => r.id === a.id && r.buyerId === buyerId)).map(raw => { const a=normalizeAward(raw, [], 'public'); return { supplier: a.supplier.name, supplierCountry: a.supplier.country, contractValue: a.contractValue, currency: a.currency, valueUSD: a.valueUSD, awardedAt: a.awardedAt } }),
      }
    }) }
  })
  return NextResponse.json({ ...result, limit, offset, normalizationBasis: 'persisted USD or original USD' })
})

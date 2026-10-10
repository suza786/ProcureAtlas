import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { normalizeAward } from '@/lib/financial-calculations'
import { cachedCatalog, awardSummary, awardGroups } from '@/lib/catalog-analytics'

export const GET = withApiErrors(async function GET(req: NextRequest) {
  await getCurrentTenant()
  const params = validatedSearch(req)
  const market=params.get('market'), sector=params.get('sector'), supplierOrgId=params.get('supplierOrgId')
  const { limit, offset } = pagination(params)
  const where: Prisma.AwardWhereInput = { ...(supplierOrgId ? { supplierOrgId } : {}), ...(market || sector ? { tender: { ...(market ? { market } : {}), ...(sector ? { sector } : {}) } } : {}) }
  const sql = Prisma.sql`1=1 ${market ? Prisma.sql`AND t.market=${market}` : Prisma.empty} ${sector ? Prisma.sql`AND t.sector=${sector}` : Prisma.empty} ${supplierOrgId ? Prisma.sql`AND a."supplierOrgId"=${supplierOrgId}` : Prisma.empty}`
  const [awards, aggregates] = await Promise.all([
    db.award.findMany({ where, take: limit, skip: offset, orderBy: [{ awardedAt: 'desc' }, { id: 'asc' }], include: { supplier: { select: { id: true, name: true, country: true } }, tender: { select: { id: true, title: true, market: true, sector: true, country: true, valueUSD: true, buyer: { include: { organization: { select: { name: true } } } } } } } }),
    cachedCatalog(`awards:${JSON.stringify({ market, sector, supplierOrgId })}`, async () => {
      const [summary, marketShare, markets, sectors] = await Promise.all([awardSummary(sql), awardGroups('supplier',sql,100), awardGroups('market',sql,100), awardGroups('sector',sql,100)])
      return { total: summary.totalAwards, totalValueUSD: summary.totalValueUSD, averageValueUSD: summary.averageValueUSD, normalizedCount: summary.normalizedCount, unnormalizedCount: summary.unnormalizedCount, distinctWinnerCount: summary.distinctWinnerCount,
        marketShare: marketShare.map(a => ({ ...a, awardCount: a.count })), byMarket: markets.map(a => ({ market: a.id, count:a.count, totalValue:a.totalValue })), bySector: sectors.map(a => ({ sector:a.id, count:a.count, totalValue:a.totalValue })), summaryGroupLimit: 100 }
    }),
  ])
  return NextResponse.json({ ...aggregates, limit, offset, normalizationBasis: 'persisted USD or original USD', items: awards.map(a=>normalizeAward(a, [], 'public')) })
})

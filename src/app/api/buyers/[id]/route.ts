import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { parseIds, validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { normalizeAward } from '@/lib/financial-calculations'
import { cachedCatalog, awardSummary, awardGroups, summaryStats } from '@/lib/catalog-analytics'

export const GET = withApiErrors(async function GET(req: Request, { params }: { params: Promise<{id:string}> }) {
  await getCurrentTenant()
  const {id}=parseIds(await params)
  const {limit,offset}=pagination(validatedSearch(req),15,100)
  const org=await db.organization.findFirst({ where:{id,orgType:'buyer'},include:{buyers:{take:1,orderBy:{id:'asc'}}} })
  if(!org?.buyers[0]) return NextResponse.json({error:'Buyer not found'},{status:404})
  const buyerId=org.buyers[0].id
  const [tenders,awards,aggregates]=await Promise.all([
    db.tender.findMany({where:{buyerId},take:10,orderBy:[{publishedAt:'desc'},{id:'asc'}],include:{_count:{select:{requirements:true,amendments:true}}}}),
    db.award.findMany({where:{tender:{buyerId}},take:limit,skip:offset,orderBy:[{awardedAt:'desc'},{id:'asc'}],include:{supplier:{select:{id:true,name:true,country:true}},tender:{select:{id:true,title:true,sector:true,market:true}}}}),
    cachedCatalog(`buyer:${id}`,async()=>{
      const [summary,incumbents,tenderStats,sectors]=await Promise.all([
        awardSummary(Prisma.sql`t."buyerId"=${buyerId}`),awardGroups('supplier',Prisma.sql`t."buyerId"=${buyerId}`,10),
        db.tender.aggregate({where:{buyerId},_count:{_all:true},_sum:{valueUSD:true},_avg:{valueUSD:true}}),
        db.tender.groupBy({by:['sector'],where:{buyerId},_count:{_all:true},orderBy:{_count:{sector:'desc'}},take:100}),
      ])
      return {stats:{...summaryStats(summary),totalTenders:tenderStats._count._all,totalTenderValueUSD:tenderStats._sum.valueUSD??0,averageTenderValueUSD:tenderStats._avg.valueUSD,incumbentCount:summary.distinctWinnerCount},incumbents:incumbents.map(a=>({...a,awardCount:a.count})),sectorPreferences:sectors.map(a=>[a.sector,a._count._all])}
    }),
  ])
  return NextResponse.json({id:org.id,name:org.name,country:org.country,city:org.city,website:org.website,sourcePortal:org.sourcePortal,externalId:org.externalId,...aggregates,limit,offset,normalizationBasis:'persisted USD or original USD',recentTenders:tenders.map(t=>({...t,requirementCount:t._count.requirements,amendmentCount:t._count.amendments})),awardHistory:awards.map(a=>normalizeAward(a,[],'public'))})
})

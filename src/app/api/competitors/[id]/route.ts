import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import { z } from 'zod'
import { readWebhookBody } from '@/lib/inbound-webhook'

export const PATCH = withApiErrors(async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireTenantWithRole('contributor')
  const { id } = parseIds(await params)
  const body = z.object({ isCompetitor: z.boolean().optional(), isPartner: z.boolean().optional(), notes: z.string().max(10000).nullable().optional() }).strict().refine(value => Object.keys(value).length > 0, 'At least one annotation is required').parse(JSON.parse(await readWebhookBody(req, 16384)))
  if (!await db.organization.findFirst({ where: { id, orgType: 'supplier' } })) throw new Response('Supplier not found', { status: 404 })
  const annotation = await db.tenantSupplierAnnotation.upsert({ where: { tenantId_organizationId: { tenantId: ctx.tenantId, organizationId: id } }, create: { tenantId: ctx.tenantId, organizationId: id, ...body }, update: body })
  await logAction({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'supplier_annotation_updated', entityType: 'supplier_annotation', entityId: annotation.id, afterJson: body, request: req })
  return NextResponse.json({ id, isCompetitor: annotation.isCompetitor, isPartner: annotation.isPartner, notes: annotation.notes })
})
import { getCurrentTenant } from '@/lib/tenant'
import { parseIds, validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { normalizeAward } from '@/lib/financial-calculations'
import { cachedCatalog, awardSummary, awardGroups, summaryStats } from '@/lib/catalog-analytics'

export const GET = withApiErrors(async function GET(req: Request, { params }: { params: Promise<{id:string}> }) {
  const ctx=await getCurrentTenant()
  const {id}=parseIds(await params)
  const {limit,offset}=pagination(validatedSearch(req),20,100)
  const org=await db.organization.findFirst({where:{id,orgType:'supplier'}})
  if(!org) return NextResponse.json({error:'Competitor not found'},{status:404})
  const [awards,annotation,aggregates]=await Promise.all([
    db.award.findMany({where:{supplierOrgId:id},take:limit,skip:offset,orderBy:[{awardedAt:'desc'},{id:'asc'}],include:{tender:{select:{id:true,title:true,sector:true,market:true,country:true,valueUSD:true,publishedAt:true,buyer:{include:{organization:{select:{name:true,country:true}}}}}}}}),
    db.tenantSupplierAnnotation.findUnique({where:{tenantId_organizationId:{tenantId:ctx.tenantId,organizationId:id}}}),
    cachedCatalog(`supplier:${id}`,async()=>{
      const where=Prisma.sql`a."supplierOrgId"=${id}`
      const [summary,buyers,sectors,markets,years]=await Promise.all([awardSummary(where),awardGroups('buyer',where,10),awardGroups('sector',where,100),awardGroups('market',where,100),awardGroups('year',where,100)])
      return {stats:{...summaryStats(summary),firstAwardAt:summary.firstAwardAt==null?null:new Date(summary.firstAwardAt),lastAwardAt:summary.lastAwardAt==null?null:new Date(summary.lastAwardAt)},topBuyers:buyers.map(a=>({...a,awardCount:a.count})),sectorBreakdown:sectors.map(a=>({sector:a.id,count:a.count,totalValue:a.totalValue})),marketBreakdown:markets.map(a=>({market:a.id,count:a.count,totalValue:a.totalValue})),winTrend:years.sort((a,b)=>a.id.localeCompare(b.id)).map(a=>({year:a.id,count:a.count,totalValue:a.totalValue}))}
    }),
  ])
  return NextResponse.json({id:org.id,name:org.name,country:org.country,city:org.city,website:org.website,sourcePortal:org.sourcePortal,...aggregates,isCompetitor:annotation?.isCompetitor??false,isPartner:annotation?.isPartner??false,notes:annotation?.notes??null,limit,offset,normalizationBasis:'persisted USD or original USD',awardHistory:awards.map(a=>normalizeAward(a,[],'public'))})
})

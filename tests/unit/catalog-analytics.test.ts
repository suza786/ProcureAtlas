import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const fixture = vi.hoisted(() => ({ client: null as unknown as import('@prisma/client').PrismaClient }))
vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...args: unknown[]) => Reflect.apply(fixture.client.$queryRaw, fixture.client, args) } }))
import { Prisma } from '@prisma/client'
import { awardSummary, awardGroups, organizationAwardStats, supplierFacets, cachedCatalog } from '@/lib/catalog-analytics'
let directory: string
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'catalog-analytics-'))
  fixture.client = new PrismaClient({ datasources: { db: { url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}` } } })
  await fixture.client.$executeRawUnsafe('CREATE TABLE "Organization" (id TEXT PRIMARY KEY,name TEXT,country TEXT)')
  await fixture.client.$executeRawUnsafe('CREATE TABLE "Buyer" (id TEXT PRIMARY KEY,organizationId TEXT)')
  await fixture.client.$executeRawUnsafe('CREATE TABLE "Tender" (id TEXT PRIMARY KEY,buyerId TEXT,sector TEXT,market TEXT)')
  await fixture.client.$executeRawUnsafe('CREATE TABLE "Award" (id TEXT PRIMARY KEY,tenderId TEXT,supplierOrgId TEXT,valueUSD REAL,contractValue REAL,currency TEXT,awardedAt INTEGER)')
  await fixture.client.$executeRawUnsafe("INSERT INTO Organization VALUES ('s1','Supplier','US'),('s2','Other','BD'),('b1','Buyer','BD')")
  await fixture.client.$executeRawUnsafe("INSERT INTO Buyer VALUES ('buyer1','b1')")
  await fixture.client.$executeRawUnsafe("INSERT INTO Tender VALUES ('t1','buyer1','IT','BD')")
  await fixture.client.$executeRawUnsafe("INSERT INTO Award VALUES ('a1','t1','s1',NULL,100,'USD',1735689600000),('a2','t1','s1',250,999,'EUR',1735689600000),('a3','t1','s2',NULL,100000,'BDT',1735689600000),('a4','t1','s2',NULL,-5,'USD',1735689600000)")
})
afterAll(async () => { await fixture.client?.$disconnect(); if (directory) await rm(directory,{recursive:true,force:true}) })
describe('database catalog summaries', () => {
  it('aggregates normalized values in SQL without summing unknown non-USD amounts', async () => {
    expect(await awardSummary()).toMatchObject({ totalAwards: 4, totalValueUSD: 350, normalizedCount: 2, unnormalizedCount: 2, averageValueUSD: 175, distinctWinnerCount: 2 })
  })
  it('limits grouped results while retaining filtered complete totals', async () => {
    expect(await awardGroups('supplier', Prisma.sql`1=1`, 1)).toEqual([expect.objectContaining({ id:'s1',count:2,totalValue:350 })])
    expect(await awardSummary(Prisma.sql`a."supplierOrgId"=${'s2'}`)).toMatchObject({ totalAwards:2,totalValueUSD:0,normalizedCount:0 })
    expect(await awardGroups('year', Prisma.sql`1=1`)).toEqual([expect.objectContaining({ id:'2025', count:4,totalValue:350 })])
  })
  it('batches owner totals and top facets without loading award records', async () => {
    const owners=await organizationAwardStats(['s1','s2'],'supplier')
    expect(owners).toHaveLength(2)
    expect(owners.find(o=>o.id==='s1')).toMatchObject({totalAwards:2,totalValueUSD:350})
    expect(await supplierFacets(['s1'])).toEqual([expect.objectContaining({ownerId:'s1',dimension:'buyer',name:'Buyer',count:2}),expect.objectContaining({ownerId:'s1',dimension:'sector',name:'IT',count:2})])
  })
  it('caches filtered public data briefly and isolates cache keys', async () => {
    const compute=vi.fn().mockResolvedValue({ count:4 })
    await cachedCatalog('test:one',compute); await cachedCatalog('test:one',compute)
    expect(compute).toHaveBeenCalledTimes(1)
    await cachedCatalog('test:two',compute)
    expect(compute).toHaveBeenCalledTimes(2)
    const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+31_000)
    await cachedCatalog('test:one',compute)
    clock.mockRestore()
    expect(compute).toHaveBeenCalledTimes(3)
  })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const fixture = vi.hoisted(() => ({ client: null as unknown as import('@prisma/client').PrismaClient }))
vi.mock('@/lib/db', () => ({ db: { outboxJob: new Proxy({}, { get: (_target, key) => (...args: unknown[]) => Reflect.apply(fixture.client.outboxJob[key as keyof typeof fixture.client.outboxJob] as (...args: unknown[]) => unknown, fixture.client.outboxJob, args) }) } }))
import { claimJob, runNextJob, JobFailure } from '@/lib/outbox'
let directory: string
beforeAll(async () => {
  directory=await mkdtemp(join(tmpdir(),'outbox-db-'))
  fixture.client=new PrismaClient({datasources:{db:{url:`file:${join(directory,'test.db').replaceAll('\\','/')}`}}})
  await fixture.client.$executeRawUnsafe(`CREATE TABLE OutboxJob (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,kind TEXT NOT NULL,payloadJson TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,maxAttempts INTEGER NOT NULL DEFAULT 5,availableAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,lockedAt DATETIME,lockedBy TEXT,error TEXT,completedAt DATETIME,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL)`)
})
beforeEach(async()=>{await fixture.client.outboxJob.deleteMany()})
afterAll(async()=>{await fixture.client?.$disconnect();if(directory)await rm(directory,{recursive:true,force:true})})
describe('durable database job lifecycle',()=>{
  it('allows only one competing worker to claim a due job',async()=>{
    await fixture.client.outboxJob.create({data:{tenantId:'tenant1',kind:'test',payloadJson:'{}'}})
    const claimed=await Promise.all([claimJob('one'),claimJob('two')])
    expect(claimed.filter(Boolean)).toHaveLength(1)
    const record=await fixture.client.outboxJob.findFirstOrThrow()
    expect(record.attempts).toBe(1);expect(record.status).toBe('running')
  })
  it('recovers an abandoned stale lease, preserving attempt limits',async()=>{
    await fixture.client.outboxJob.create({data:{tenantId:'tenant1',kind:'test',payloadJson:'{}',status:'running',attempts:1,maxAttempts:2,lockedBy:'dead',lockedAt:new Date(Date.now()-180_000)}})
    const handler=vi.fn().mockRejectedValue(new JobFailure('still unavailable'))
    expect(await runNextJob({test:handler},'replacement')).toBe(true)
    const record=await fixture.client.outboxJob.findFirstOrThrow()
    expect(record).toMatchObject({status:'failed',attempts:2,lockedAt:null,lockedBy:null,error:'still unavailable'})
  })
  it('does not reclaim a live lease or execute a future retry',async()=>{
    await fixture.client.outboxJob.create({data:{tenantId:'tenant1',kind:'test',payloadJson:'{}',status:'running',lockedAt:new Date(),lockedBy:'live'}})
    await fixture.client.outboxJob.create({data:{tenantId:'tenant1',kind:'test',payloadJson:'{}',status:'retrying',availableAt:new Date(Date.now()+60_000)}})
    expect(await claimJob('other')).toBeNull()
  })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const fixture = vi.hoisted(() => ({ client: null as unknown as PrismaClient }))
vi.mock('@/lib/db', () => ({ db: new Proxy({}, { get: (_target, key) => { const value = Reflect.get(fixture.client, key); return typeof value === 'function' ? value.bind(fixture.client) : value } }) }))
import { ANALYTICS_JOB, scheduleAnalyticsPage, dispatchAnalyticsSnapshot, tenantAnalytics, utcDay } from '@/lib/analytics-history'
import { runNextJob } from '@/lib/outbox'
let directory: string
const now = new Date('2026-10-10T08:30:00Z')
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'analytics-history-'))
  fixture.client = new PrismaClient({ datasources: { db: { url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}` } } })
  const ddl = [
    'CREATE TABLE Tenant (id TEXT PRIMARY KEY)',
    'CREATE TABLE Company (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL)',
    'CREATE TABLE Pursuit (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,stage TEXT NOT NULL,estimatedValueUSD REAL)',
    'CREATE TABLE Alert (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,acknowledgedAt DATETIME)',
    'CREATE TABLE UsageEvent (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,kind TEXT NOT NULL,inputTokens INTEGER DEFAULT 0,outputTokens INTEGER DEFAULT 0,tokenSource TEXT,createdAt DATETIME NOT NULL)',
    'CREATE TABLE Evidence (id TEXT PRIMARY KEY,companyId TEXT NOT NULL,verified BOOLEAN NOT NULL,expiresAt DATETIME)',
    'CREATE TABLE Proposal (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,pursuitId TEXT NOT NULL,wordCount INTEGER NOT NULL)',
    'CREATE TABLE Bid (id TEXT PRIMARY KEY,pursuitId TEXT NOT NULL,createdAt DATETIME NOT NULL,submittedAt DATETIME)',
    `CREATE TABLE OutboxJob (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,kind TEXT NOT NULL,payloadJson TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,maxAttempts INTEGER NOT NULL DEFAULT 5,availableAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,lockedAt DATETIME,lockedBy TEXT,error TEXT,completedAt DATETIME,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL)`,
    `CREATE TABLE AnalyticsSnapshot (id TEXT PRIMARY KEY,tenantId TEXT NOT NULL,snapshotDate DATETIME NOT NULL,activePursuits INTEGER DEFAULT 0,biddingPursuits INTEGER DEFAULT 0,submittedPursuits INTEGER DEFAULT 0,wonPursuits INTEGER DEFAULT 0,lostPursuits INTEGER DEFAULT 0,pipelineValueUSD REAL DEFAULT 0,wonValueUSD REAL DEFAULT 0,winRate REAL DEFAULT 0,avgBidCycleDays REAL DEFAULT 0,avgProposalWordCount INTEGER DEFAULT 0,llmCallsCount INTEGER DEFAULT 0,llmCostUsd REAL DEFAULT 0,llmCostKnown BOOLEAN DEFAULT false,llmInputTokens INTEGER DEFAULT 0,llmOutputTokens INTEGER DEFAULT 0,evidenceCount INTEGER DEFAULT 0,evidenceCoverage REAL DEFAULT 0,source TEXT DEFAULT 'legacy',observedAt DATETIME,createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenantId,snapshotDate))`,
  ]
  for (const sql of ddl) await fixture.client.$executeRawUnsafe(sql)
})
beforeEach(async () => {
  for (const table of ['AnalyticsSnapshot', 'OutboxJob', 'Bid', 'Proposal', 'Evidence', 'UsageEvent', 'Alert', 'Pursuit', 'Company', 'Tenant']) await fixture.client.$executeRawUnsafe(`DELETE FROM ${table}`)
  await fixture.client.$executeRaw`INSERT INTO Tenant (id) VALUES ('a'),('b')`
  await fixture.client.$executeRaw`INSERT INTO Company (id,tenantId) VALUES ('ca','a'),('cb','b')`
})
afterAll(async () => { await fixture.client?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }) })

async function populate() {
  await fixture.client.$executeRaw`INSERT INTO Pursuit (id,tenantId,stage,estimatedValueUSD) VALUES ('win','a','won',400),('lose','a','lost',50),('declined','a','no_bid',2000),('bid','a','bidding',1250),('other','b','won',9000)`
  await fixture.client.$executeRaw`INSERT INTO Evidence (id,companyId,verified,expiresAt) VALUES ('v','ca',true,NULL),('u','ca',false,NULL),('expired','ca',true,${new Date('2026-10-01')}),('foreign','cb',true,NULL)`
  await fixture.client.$executeRaw`INSERT INTO UsageEvent (id,tenantId,kind,inputTokens,outputTokens,tokenSource,createdAt) VALUES ('call','a','provider_call',120,30,'provider_reported',${now}),('pending','a','provider_call',0,0,'reserved_upper_bound',${now}),('api','a','api_call',0,0,NULL,${now}),('foreign','b','provider_call',9999,9999,'provider_reported',${now}),('old','a','provider_call',500,500,'provider_reported',${new Date('2026-08-01')})`
  await fixture.client.$executeRaw`INSERT INTO Proposal (id,tenantId,pursuitId,wordCount) VALUES ('pa','a','bid',1500),('pb','b','other',9999)`
  await fixture.client.$executeRaw`INSERT INTO Bid (id,pursuitId,createdAt,submittedAt) VALUES ('ba','bid',${new Date('2026-10-08T08:30:00Z')},${now}),('bb','other',${new Date('2026-08-01')},${now})`
}

describe('observed tenant analytics history', () => {
  it('schedules bounded tenant pages idempotently, including competing schedulers and UTC rollover', async () => {
    await Promise.all([scheduleAnalyticsPage(now), scheduleAnalyticsPage(now)])
    expect(await fixture.client.outboxJob.count()).toBe(2)
    expect((await scheduleAnalyticsPage(now, undefined, 1)).cursor).toBe('a')
    expect((await scheduleAnalyticsPage(now, 'a', 1)).cursor).toBe('b')
    expect((await scheduleAnalyticsPage(now, 'b', 1)).cursor).toBeUndefined()
    await scheduleAnalyticsPage(new Date('2026-10-11T00:00:01Z'))
    expect(await fixture.client.outboxJob.count()).toBe(4)
    expect(utcDay(new Date('2026-10-10T23:59:59Z')).toISOString()).toBe('2026-10-10T00:00:00.000Z')
  })
  it('captures database aggregates through the durable worker and preserves the first observation', async () => {
    await populate()
    await scheduleAnalyticsPage(now)
    await fixture.client.outboxJob.updateMany({ data: { availableAt: new Date(0) } })
    expect(await runNextJob({ [ANALYTICS_JOB]: job => dispatchAnalyticsSnapshot(job, now) }, 'test-worker')).toBe(true)
    const snap = await fixture.client.analyticsSnapshot.findFirstOrThrow({ where: { tenantId: 'a' } })
    expect(snap).toMatchObject({ source: 'observed', wonPursuits: 1, lostPursuits: 1, winRate: .5, activePursuits: 1, biddingPursuits: 1, pipelineValueUSD: 1250, wonValueUSD: 400, llmCallsCount: 2, llmInputTokens: 120, llmOutputTokens: 30, llmCostKnown: false, evidenceCount: 3, avgBidCycleDays: 2, avgProposalWordCount: 1500 })
    expect(snap.evidenceCoverage).toBeCloseTo(1 / 3)
    expect(snap.observedAt).toEqual(now)
    expect(await fixture.client.outboxJob.findFirstOrThrow({ where: { tenantId: 'a' } })).toMatchObject({ status: 'completed', attempts: 1 })
    const job = await fixture.client.outboxJob.findFirstOrThrow({ where: { tenantId: 'a' } })
    await fixture.client.$executeRaw`UPDATE Pursuit SET stage='won' WHERE id='lose'`
    await dispatchAnalyticsSnapshot(job, new Date('2026-10-10T14:00:00Z'))
    expect((await fixture.client.analyticsSnapshot.findFirstOrThrow({ where: { tenantId: 'a' } })).winRate).toBe(.5)
    const result = await tenantAnalytics('a', now)
    expect(result.current).toMatchObject({ winRate: 100, llmCalls30d: 2, llmCost30d: null, pendingProviderCalls: 1 })
    expect(result.history[0].llmCostUsd).toBeNull()
    expect(result.metadata.timezone).toBe('UTC')
    expect((await tenantAnalytics('b', now)).current.pipelineValueUSD).toBe(0)
  })
  it('excludes legacy seed rows and returns the most recent observed daily window with unambiguous dates', async () => {
    const rows = Array.from({ length: 185 }, (_, i) => ({ tenantId: 'a', source: 'observed', snapshotDate: new Date(utcDay(now).getTime() - i * 86_400_000), observedAt: new Date(utcDay(now).getTime() - i * 86_400_000), activePursuits: i }))
    await fixture.client.analyticsSnapshot.createMany({ data: rows })
    await fixture.client.analyticsSnapshot.create({ data: { tenantId: 'b', source: 'observed', snapshotDate: utcDay(now), wonPursuits: 999 } })
    await fixture.client.analyticsSnapshot.update({ where: { tenantId_snapshotDate: { tenantId: 'a', snapshotDate: new Date(utcDay(now).getTime() - 86_400_000) } }, data: { source: 'legacy' } })
    const result = await tenantAnalytics('a', now)
    expect(result.history).toHaveLength(179)
    expect(result.history.at(-1)?.date).toBe('2026-10-10')
    expect(result.history.some(row => row.date === '2026-10-09')).toBe(false)
    expect(result.history[0].date).toBe(new Date(utcDay(now).getTime() - 179 * 86_400_000).toISOString().slice(0, 10))
    expect(result.history.every(row => row.wonPursuits !== 999)).toBe(true)
  })
  it('never backfills stale jobs and replaces a current legacy fixture only with an actual observation', async () => {
    await scheduleAnalyticsPage(new Date('2026-10-09T10:00:00Z'))
    const stale = await fixture.client.outboxJob.findFirstOrThrow({ where: { tenantId: 'a' } })
    await dispatchAnalyticsSnapshot(stale, now)
    expect(await fixture.client.analyticsSnapshot.count()).toBe(0)
    await fixture.client.analyticsSnapshot.create({ data: { tenantId: 'a', snapshotDate: utcDay(now), wonPursuits: 99 } })
    await scheduleAnalyticsPage(now)
    const job = await fixture.client.outboxJob.findFirstOrThrow({ where: { tenantId: 'a', payloadJson: JSON.stringify({ date: utcDay(now).toISOString() }) } })
    await dispatchAnalyticsSnapshot(job, now)
    expect(await fixture.client.analyticsSnapshot.findFirstOrThrow()).toMatchObject({ source: 'observed', wonPursuits: 0 })
  })
})

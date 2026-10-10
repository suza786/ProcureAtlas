import { describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'procureatlas-billing-'))
  const filename = path.join(directory, 'test.db')
  const db = new PrismaClient({ datasources: { db: { url: 'file:' + filename.replaceAll('\\', '/') } } })
  for (const ddl of [
    'CREATE TABLE "Tenant" ("id" TEXT PRIMARY KEY, "name" TEXT)',
    'CREATE TABLE "User" ("id" TEXT PRIMARY KEY)',
    'CREATE TABLE "ApiKey" ("id" TEXT PRIMARY KEY)',
    'CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT)',
    'CREATE TABLE "Subscription" ("id" TEXT PRIMARY KEY, "tenantId" TEXT, "plan" TEXT)',
    'CREATE TABLE "UsageMetric" ("id" TEXT PRIMARY KEY, "count" INTEGER)',
    'CREATE TABLE "Award" ("id" TEXT PRIMARY KEY, "contractValue" REAL, "currency" TEXT, "awardedAt" DATETIME)',
    'CREATE TABLE "DataExport" ("id" TEXT PRIMARY KEY, "requestedById" TEXT)',
    "INSERT INTO Tenant VALUES ('tenant', 'Original tenant')",
    "INSERT INTO Tenant VALUES ('other', 'Unrelated tenant')",
    "INSERT INTO User VALUES ('user')",
    "INSERT INTO User VALUES ('collision')",
    "INSERT INTO ApiKey VALUES ('api-key')",
    "INSERT INTO ApiKey VALUES ('collision')",
    "INSERT INTO AuditLog VALUES ('api', 'api-key', 'read')",
    "INSERT INTO AuditLog VALUES ('user', 'user', 'write')",
    "INSERT INTO AuditLog VALUES ('system', NULL, 'system')",
    "INSERT INTO AuditLog VALUES ('collision', 'collision', 'write')",
    "INSERT INTO Subscription VALUES ('subscription', 'tenant', 'professional')",
    "INSERT INTO UsageMetric VALUES ('usage', 47)",
    "INSERT INTO Award VALUES ('usd', 300, 'USD', 1788220800000)",
    "INSERT INTO Award VALUES ('bdt', 36000, 'BDT', 1788220800000)",
    "INSERT INTO Award VALUES ('zero', 0, 'USD', 1788220800000)",
    "INSERT INTO Award VALUES ('negative', -5, 'USD', 1788220800000)",
    "INSERT INTO Award VALUES ('excessive', 1000000000001, 'USD', 1788220800000)",
    "INSERT INTO DataExport VALUES ('api', 'api-key')",
    "INSERT INTO DataExport VALUES ('user', 'user')",
    "INSERT INTO DataExport VALUES ('collision', 'collision')",
  ]) await db.$executeRawUnsafe(ddl)
  const run = (apply = true) => execFileSync(process.execPath,
    ['scripts/billing-upgrade-2026-10.mjs', '--database', filename, ...(apply ? ['--apply'] : [])],
    { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  const refresh = async () => { await db.$disconnect(); await db.$connect() }
  const cleanup = async () => {
    await db.$disconnect()
    const resolved = path.resolve(directory)
    if (!resolved.startsWith(path.resolve(os.tmpdir(), 'procureatlas-billing-'))) throw new Error('Unexpected test directory')
    for (const entry of fs.readdirSync(resolved)) fs.unlinkSync(path.join(resolved, entry))
    fs.rmdirSync(resolved)
  }
  return { db, directory, run, refresh, cleanup }
}

describe('non-destructive billing schema upgrade', () => {
  it('dry run preserves all rows and schema without creating a backup', async () => {
    const test = await fixture()
    try {
      const schemaBefore = await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')
      const auditBefore = await test.db.$queryRawUnsafe('SELECT * FROM "AuditLog" ORDER BY id')
      const awardsBefore = await test.db.$queryRawUnsafe('SELECT * FROM "Award" ORDER BY id')
      expect(test.run(false)).toContain('Dry run; no changes.')
      expect(await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(schemaBefore)
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "AuditLog" ORDER BY id')).toEqual(auditBefore)
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Award" ORDER BY id')).toEqual(awardsBefore)
      expect(fs.readdirSync(test.directory).filter(name => name.endsWith('.bak'))).toEqual([])
    } finally { await test.cleanup() }
  }, 30000)

  it('backs up original data, adds columns and event keys, and is repeatable', async () => {
    const test = await fixture()
    try {
      expect(test.run()).toContain('Billing upgrade applied. Backup:')
      await test.refresh()
      const schemaAfter = await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')
      const auditAfter = await test.db.$queryRawUnsafe('SELECT * FROM "AuditLog" ORDER BY id')
      const awardsAfter = await test.db.$queryRawUnsafe('SELECT * FROM "Award" ORDER BY id')
      expect(test.run()).toContain('Billing upgrade applied. Backup:')
      await test.refresh()
      expect(await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(schemaAfter)
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "AuditLog" ORDER BY id')).toEqual(auditAfter)
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Award" ORDER BY id')).toEqual(awardsAfter)
      const backups = fs.readdirSync(test.directory).filter(name => name.endsWith('.bak')).sort()
      expect(backups).toHaveLength(2)
      const backup = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(test.directory, backups[0]).replaceAll('\\', '/') } } })
      try {
        expect(await backup.$queryRawUnsafe('SELECT * FROM "Subscription"')).toEqual([{ id: 'subscription', tenantId: 'tenant', plan: 'professional' }])
        expect(await backup.$queryRawUnsafe('SELECT * FROM "AuditLog" WHERE id = \'api\'')).toEqual([{ id: 'api', userId: 'api-key', action: 'read' }])
      } finally { await backup.$disconnect() }
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Subscription"')).toEqual([{ id: 'subscription', tenantId: 'tenant', plan: 'professional', billingVerifiedAt: null, billingEventCreatedAt: 0 }])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "UsageMetric"')).toEqual([{ id: 'usage', count: 47, reservedCount: 0 }])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Tenant" ORDER BY id')).toEqual([{ id: 'other', name: 'Unrelated tenant' }, { id: 'tenant', name: 'Original tenant' }])
      await test.db.$executeRawUnsafe("INSERT INTO BillingEvent (id,provider,eventId,tenantId,payloadHash) VALUES ('event','stripe','evt_1','tenant','hash')")
      await expect(test.db.$executeRawUnsafe("INSERT INTO BillingEvent (id,provider,eventId,tenantId,payloadHash) VALUES ('duplicate','stripe','evt_1','other','hash')")).rejects.toThrow()
      await test.db.$executeRawUnsafe("INSERT INTO BillingEvent (id,provider,eventId,tenantId,payloadHash) VALUES ('other-provider','other','evt_1','tenant','hash')")
      await test.db.$executeRawUnsafe("INSERT INTO UsageEvent (id,tenantId,kind) VALUES ('usage-event','tenant','llm')")
      expect(await test.db.$queryRawUnsafe('SELECT inputTokens,outputTokens,reservedTokens FROM "UsageEvent"')).toEqual([{ inputTokens: 0, outputTokens: 0, reservedTokens: 0 }])
    } finally { await test.cleanup() }
  }, 30000)

  it('normalizes safe original USD awards while preserving all original currencies and values', async () => {
    const test = await fixture()
    try {
      const original = await test.db.$queryRawUnsafe('SELECT id,contractValue,currency,awardedAt FROM "Award" ORDER BY id')
      test.run()
      await test.refresh()
      expect(await test.db.$queryRawUnsafe('SELECT id,contractValue,currency,awardedAt FROM "Award" ORDER BY id')).toEqual(original)
      expect(await test.db.$queryRawUnsafe('SELECT id,valueUSD,normalizationRate,normalizationDate,normalizationSource FROM "Award" ORDER BY id')).toEqual([
        { id: 'bdt', valueUSD: null, normalizationRate: null, normalizationDate: null, normalizationSource: null },
        { id: 'excessive', valueUSD: null, normalizationRate: null, normalizationDate: null, normalizationSource: null },
        { id: 'negative', valueUSD: null, normalizationRate: null, normalizationDate: null, normalizationSource: null },
        { id: 'usd', valueUSD: 300, normalizationRate: 1, normalizationDate: new Date('2026-09-01T00:00:00Z'), normalizationSource: 'original USD' },
        { id: 'zero', valueUSD: 0, normalizationRate: 1, normalizationDate: new Date('2026-09-01T00:00:00Z'), normalizationSource: 'original USD' },
      ])
      await test.db.$executeRawUnsafe("UPDATE Award SET valueUSD=299, normalizationSource='reviewed' WHERE id='usd'")
      test.run()
      await test.refresh()
      expect(await test.db.$queryRawUnsafe("SELECT valueUSD,normalizationSource FROM Award WHERE id='usd'")).toEqual([{ valueUSD: 299, normalizationSource: 'reviewed' }])
    } finally { await test.cleanup() }
  }, 30000)

  it('repairs legacy API-key actors and exports while retaining user actors and collisions', async () => {
    const test = await fixture()
    try {
      test.run()
      await test.refresh()
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "AuditLog" ORDER BY id')).toEqual([
        { id: 'api', userId: null, action: 'read', actorType: 'api_key', apiKeyId: 'api-key' },
        { id: 'collision', userId: 'collision', action: 'write', actorType: 'user', apiKeyId: null },
        { id: 'system', userId: null, action: 'system', actorType: 'system', apiKeyId: null },
        { id: 'user', userId: 'user', action: 'write', actorType: 'user', apiKeyId: null },
      ])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "DataExport" ORDER BY id')).toEqual([
        { id: 'api', requestedById: null, requestedByApiKeyId: 'api-key' },
        { id: 'collision', requestedById: 'collision', requestedByApiKeyId: null },
        { id: 'user', requestedById: 'user', requestedByApiKeyId: null },
      ])
    } finally { await test.cleanup() }
  }, 30000)

  it('fails before writes or backup when a required application table is missing', async () => {
    const test = await fixture()
    try {
      await test.db.$executeRawUnsafe('DROP TABLE "Subscription"')
      const original = await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')
      expect(() => test.run()).toThrow('Missing application table Subscription')
      expect(await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(original)
      expect(fs.readdirSync(test.directory).filter(name => name.endsWith('.bak'))).toEqual([])
    } finally { await test.cleanup() }
  }, 30000)
})



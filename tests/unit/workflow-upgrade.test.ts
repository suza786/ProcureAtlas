import { describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'procureatlas-workflow-'))
  const filename = path.join(directory, 'test.db')
  const db = new PrismaClient({ datasources: { db: { url: 'file:' + filename.replaceAll('\\', '/') } } })
  for (const ddl of [
    'CREATE TABLE "Requirement" ("id" TEXT PRIMARY KEY, "criterion" TEXT)',
    'CREATE TABLE "Evidence" ("id" TEXT PRIMARY KEY, "title" TEXT)',
    'CREATE TABLE "Proposal" ("id" TEXT PRIMARY KEY, "title" TEXT)',
    'CREATE TABLE "ProposalSection" ("id" TEXT PRIMARY KEY, "content" TEXT)',
    'CREATE TABLE "Pursuit" ("id" TEXT PRIMARY KEY, "tenantId" TEXT, "companyId" TEXT, "tenderId" TEXT)',
    'CREATE TABLE "ComplianceItem" ("id" TEXT PRIMARY KEY, "pursuitId" TEXT, "requirementId" TEXT)',
    'CREATE TABLE "ProposalVersion" ("id" TEXT PRIMARY KEY, "proposalId" TEXT, "versionNumber" INTEGER)',
    'CREATE TABLE "CurrencyRate" ("id" TEXT PRIMARY KEY, "tenantId" TEXT, "baseCurrency" TEXT, "quoteCurrency" TEXT, "rateDate" TEXT, "rate" REAL)',
    'CREATE UNIQUE INDEX "CurrencyRate_tenantId_baseCurrency_quoteCurrency_key" ON "CurrencyRate"("tenantId", "baseCurrency", "quoteCurrency")',
    "INSERT INTO Requirement VALUES ('requirement', 'Original requirement')",
    "INSERT INTO Evidence VALUES ('evidence', 'Original evidence')",
    "INSERT INTO Proposal VALUES ('proposal', 'Original proposal')",
    "INSERT INTO ProposalSection VALUES ('section', 'Original section')",
    "INSERT INTO Pursuit VALUES ('pursuit', 'tenant', 'company', 'tender')",
    "INSERT INTO ComplianceItem VALUES ('compliance', 'pursuit', 'requirement')",
    "INSERT INTO ProposalVersion VALUES ('version', 'proposal', 1)",
    "INSERT INTO CurrencyRate VALUES ('rate', 'tenant', 'USD', 'BDT', '2026-09-01', 120)",
  ]) await db.$executeRawUnsafe(ddl)
  const run = (apply = true) => execFileSync(process.execPath,
    ['scripts/workflow-upgrade-2026-10.mjs', '--database', filename, ...(apply ? ['--apply'] : [])],
    { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  const cleanup = async () => {
    await db.$disconnect()
    const resolved = path.resolve(directory)
    if (!resolved.startsWith(path.resolve(os.tmpdir(), 'procureatlas-workflow-'))) throw new Error('Unexpected test directory')
    for (const entry of fs.readdirSync(resolved)) fs.unlinkSync(path.join(resolved, entry))
    fs.rmdirSync(resolved)
  }
  return { db, filename, directory, run, cleanup }
}

describe('non-destructive workflow schema upgrade', () => {
  it('backs up, adds columns and unique keys, preserves rows and is idempotent', async () => {
    const test = await fixture()
    try {
      expect(test.run()).toContain('Workflow upgrade applied. Backup:')
      expect(test.run()).toContain('Workflow upgrade applied. Backup:')
      // The child process changed schema; refresh Prisma's cached raw-query column metadata.
      await test.db.$disconnect()
      await test.db.$connect()
      const backups = fs.readdirSync(test.directory).filter(name => name.endsWith('.bak'))
      expect(backups).toHaveLength(2)
      const backup = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(test.directory, backups.sort()[0]).replaceAll('\\', '/') } } })
      try {
        expect(await backup.$queryRawUnsafe('SELECT * FROM "Requirement"')).toEqual([{ id: 'requirement', criterion: 'Original requirement' }])
      } finally { await backup.$disconnect() }
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Requirement"')).toEqual([{
        id: 'requirement', criterion: 'Original requirement', thresholdAmount: null, thresholdCurrency: null,
        thresholdUnit: null, evaluationMetric: null, thresholdStatus: 'unreviewed',
      }])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Evidence"')).toEqual([{
        id: 'evidence', title: 'Original evidence', factMetric: null, factAmount: null, factCurrency: null, factUnit: null,
      }])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Proposal"')).toEqual([{ id: 'proposal', title: 'Original proposal', revision: 0 }])
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "ProposalSection"')).toEqual([{ id: 'section', content: 'Original section', revision: 0 }])
      expect(await test.db.$queryRawUnsafe('SELECT id, rate FROM "CurrencyRate"')).toEqual([{ id: 'rate', rate: 120 }])
      await test.db.$executeRawUnsafe("INSERT INTO CurrencyRate VALUES ('second-date', 'tenant', 'USD', 'BDT', '2026-10-01', 122)")
      await test.db.$executeRawUnsafe("INSERT INTO CurrencyRate VALUES ('other-tenant', 'other', 'USD', 'BDT', '2026-09-01', 121)")
      for (const duplicate of [
        "INSERT INTO Pursuit VALUES ('duplicate', 'tenant', 'company', 'tender')",
        "INSERT INTO ComplianceItem VALUES ('duplicate', 'pursuit', 'requirement')",
        "INSERT INTO ProposalVersion VALUES ('duplicate', 'proposal', 1)",
        "INSERT INTO CurrencyRate VALUES ('duplicate', 'tenant', 'USD', 'BDT', '2026-09-01', 1)",
      ]) await expect(test.db.$executeRawUnsafe(duplicate)).rejects.toThrow()
    } finally { await test.cleanup() }
  }, 30000)

  it('dry run leaves all schema and rows unchanged and creates no backup', async () => {
    const test = await fixture()
    try {
      const before = await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')
      expect(test.run(false)).toContain('Dry run; no changes.')
      expect(await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(before)
      expect(fs.readdirSync(test.directory).filter(name => name.endsWith('.bak'))).toHaveLength(0)
      expect(await test.db.$queryRawUnsafe('SELECT * FROM "Requirement"')).toEqual([{ id: 'requirement', criterion: 'Original requirement' }])
    } finally { await test.cleanup() }
  }, 30000)

  it.each([
    ['Pursuit', "INSERT INTO Pursuit VALUES ('duplicate', 'tenant', 'company', 'tender')"],
    ['ComplianceItem', "INSERT INTO ComplianceItem VALUES ('duplicate', 'pursuit', 'requirement')"],
    ['ProposalVersion', "INSERT INTO ProposalVersion VALUES ('duplicate', 'proposal', 1)"],
    ['CurrencyRate', "INSERT INTO CurrencyRate VALUES ('duplicate', 'tenant', 'USD', 'BDT', '2026-09-01', 1)"],
  ])('duplicate %s preflight leaves schema and rows unchanged', async (table, insert) => {
    const test = await fixture()
    try {
      if (table === 'CurrencyRate') await test.db.$executeRawUnsafe('DROP INDEX "CurrencyRate_tenantId_baseCurrency_quoteCurrency_key"')
      await test.db.$executeRawUnsafe(insert)
      const before = await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')
      const rowsBefore = await test.db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)
      expect(() => test.run()).toThrow(`Resolve duplicate ${table} keys before upgrading (no changes made)`)
      expect(await test.db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(before)
      expect(await test.db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)).toEqual(rowsBefore)
      expect(fs.readdirSync(test.directory).filter(name => name.endsWith('.bak'))).toHaveLength(0)
    } finally { await test.cleanup() }
  }, 30000)
})

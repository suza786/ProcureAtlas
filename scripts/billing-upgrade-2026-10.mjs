// Additive, repeatable SQLite migration. Dry-run default; apply creates a consistent backup.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try { process.loadEnvFile(path.join(root, '.env')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const index = process.argv.indexOf('--database')
const database = index >= 0 ? path.resolve(process.argv[index + 1]) : process.env.DATABASE_URL?.startsWith('file:') ? path.resolve(root, 'prisma', process.env.DATABASE_URL.slice(5)) : null
if (!database || !fs.existsSync(database)) throw new Error('Existing SQLite database required; pass --database <path>')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + database.replaceAll('\\','/') } } })
const additions = {
  AuditLog: { actorType: "TEXT NOT NULL DEFAULT 'system'", apiKeyId: 'TEXT' },
  Subscription: { billingVerifiedAt: 'DATETIME', billingEventCreatedAt: 'INTEGER NOT NULL DEFAULT 0' },
  UsageMetric: { reservedCount: 'INTEGER NOT NULL DEFAULT 0' },
  Award: { valueUSD: 'REAL', normalizationRate: 'REAL', normalizationDate: 'DATETIME', normalizationSource: 'TEXT' },
  DataExport: { requestedByApiKeyId: 'TEXT' },
}
try {
  const statements = []
  for (const [table,fields] of Object.entries(additions)) {
    const columns = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)
    if (!columns.length) throw new Error('Missing application table ' + table)
    for (const [name,type] of Object.entries(fields)) if (!columns.some(column => column.name === name)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`)
  }
  statements.push(`CREATE TABLE IF NOT EXISTS "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "kind" TEXT NOT NULL, "endpoint" TEXT,
    "userId" TEXT, "apiKeyId" TEXT, "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0, "tokenSource" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
  statements.push('CREATE INDEX IF NOT EXISTS "UsageEvent_tenantId_kind_createdAt_idx" ON "UsageEvent"("tenantId","kind","createdAt")')
  statements.push(`CREATE TABLE IF NOT EXISTS "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "provider" TEXT NOT NULL, "eventId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_provider_eventId_key" ON "BillingEvent"("provider","eventId")')
  statements.push('CREATE INDEX IF NOT EXISTS "BillingEvent_tenantId_idx" ON "BillingEvent"("tenantId")')
  statements.push(`UPDATE "AuditLog" SET "apiKeyId"="userId", "userId"=NULL, "actorType"='api_key' WHERE "apiKeyId" IS NULL AND "userId" IN (SELECT "id" FROM "ApiKey") AND "userId" NOT IN (SELECT "id" FROM "User")`)
  statements.push(`UPDATE "AuditLog" SET "actorType"='user' WHERE "userId" IS NOT NULL AND "apiKeyId" IS NULL`)
  statements.push(`UPDATE "DataExport" SET "requestedByApiKeyId"="requestedById", "requestedById"=NULL WHERE "requestedByApiKeyId" IS NULL AND "requestedById" IN (SELECT "id" FROM "ApiKey") AND "requestedById" NOT IN (SELECT "id" FROM "User")`)
  statements.push(`UPDATE "Award" SET "valueUSD"="contractValue", "normalizationRate"=1, "normalizationDate"="awardedAt", "normalizationSource"='original USD' WHERE "valueUSD" IS NULL AND "currency"='USD' AND "contractValue" BETWEEN 0 AND 1000000000000`)
  if (!process.argv.includes('--apply')) console.log('Dry run; no changes. Stop writers and use --apply.\n' + statements.join('\n'))
  else {
    const backup = database + '.billing-' + new Date().toISOString().replaceAll(/[:.]/g,'-') + '.bak'
    await db.$executeRawUnsafe('VACUUM INTO ?', backup)
    await db.$transaction(async tx => { for (const statement of statements) await tx.$executeRawUnsafe(statement) })
    console.log('Billing upgrade applied. Backup: ' + backup)
  }
} finally { await db.$disconnect() }

// Additive SQLite upgrade; --apply explicitly applies after duplicate preflight and backup.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try { process.loadEnvFile(path.join(root, '.env')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const index = process.argv.indexOf('--database')
const database = index >= 0 ? path.resolve(process.argv[index + 1]) : process.env.DATABASE_URL?.startsWith('file:') ? path.resolve(root, 'prisma', process.env.DATABASE_URL.slice(5)) : null
if (!database || !fs.existsSync(database)) throw new Error('Existing SQLite database required; pass --database <path>')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + database.replaceAll('\\', '/') } } })
const additions = {
  Requirement: { thresholdAmount: 'REAL', thresholdCurrency: 'TEXT', thresholdUnit: 'TEXT', evaluationMetric: 'TEXT', thresholdStatus: "TEXT NOT NULL DEFAULT 'unreviewed'" },
  Evidence: { factMetric: 'TEXT', factAmount: 'REAL', factCurrency: 'TEXT', factUnit: 'TEXT' },
  Proposal: { revision: 'INTEGER NOT NULL DEFAULT 0' }, ProposalSection: { revision: 'INTEGER NOT NULL DEFAULT 0' },
}
const unique = [ ['Pursuit', ['tenantId','companyId','tenderId']], ['ComplianceItem',['pursuitId','requirementId']], ['ProposalVersion',['proposalId','versionNumber']], ['CurrencyRate',['tenantId','baseCurrency','quoteCurrency','rateDate']] ]
try {
  const statements = []
  for (const [table, fields] of Object.entries(additions)) {
    const columns = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)
    if (!columns.length) throw new Error('Missing application table ' + table)
    for (const [name, type] of Object.entries(fields)) if (!columns.some(column => column.name === name)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`)
  }
  for (const [table, fields] of unique) {
    const columns = fields.map(field => `"${field}"`).join(', ')
    const duplicates = await db.$queryRawUnsafe(`SELECT ${columns}, COUNT(*) AS count FROM "${table}" GROUP BY ${columns} HAVING COUNT(*) > 1 LIMIT 10`)
    if (duplicates.length) throw new Error(`Resolve duplicate ${table} keys before upgrading (no changes made): ` + JSON.stringify(duplicates, (_, value) => typeof value === 'bigint' ? Number(value) : value))
    statements.push(`CREATE UNIQUE INDEX IF NOT EXISTS "${table}_${fields.join('_')}_key" ON "${table}"(${columns})`)
  }
  statements.push('DROP INDEX IF EXISTS "CurrencyRate_tenantId_baseCurrency_quoteCurrency_key"')
  if (!process.argv.includes('--apply')) console.log('Dry run; no changes. Stop writers then use --apply.\n' + statements.join('\n'))
  else {
    const backup = database + '.workflows-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '.bak'
    await db.$executeRawUnsafe('VACUUM INTO ?', backup)
    await db.$transaction(async tx => { for (const statement of statements) await tx.$executeRawUnsafe(statement) })
    console.log('Workflow upgrade applied. Backup: ' + backup)
  }
} finally { await db.$disconnect() }

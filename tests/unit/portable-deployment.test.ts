import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { constants, DatabaseSync } from 'node:sqlite'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createHash } from 'node:crypto'
import { inspectDatabase, deployDatabase, migrations, applyVersionedMigrationTransaction } from '../../scripts/database-deploy.mjs'
import { loadEnvironment, requireRuntime, runtimeEnvironment, sqliteLocation, workspaceRoot } from '../../scripts/runtime-helper.mjs'

let directory: string
const fileHash = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex')
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'portable-deployment-')) })
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
async function baseline(name: string) {
  const file = join(directory, name)
  const db = new DatabaseSync(file)
  db.exec(await readFile(join(workspaceRoot, 'prisma/migrations', migrations[0], 'migration.sql'), 'utf8'))
  db.prepare('INSERT INTO Tenant (id,name,slug,updatedAt) VALUES (?,?,?,?)').run('keep', 'Preserved business', 'preserved', Date.now())
  db.close()
  return file
}

describe('portable runtime and versioned SQLite deployment', () => {
  it.skipIf(typeof DatabaseSync.prototype.setAuthorizer !== 'function')('rolls back all DDL and receipts when SQLite rejects a statement during migration', () => {
    const db = new DatabaseSync(':memory:')
    try {
      db.setAuthorizer((action, name) => action === constants.SQLITE_CREATE_INDEX && name === 'Tenant_slug_key' ? constants.SQLITE_DENY : constants.SQLITE_OK)
      expect(() => applyVersionedMigrationTransaction(db)).toThrow()
      db.setAuthorizer(null)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([])
    } finally { db.close() }
  }, 180_000)
  it('serializes competing deployers without duplicate migration receipts', async () => {
    const file = join(directory, 'concurrent.db')
    const module = pathToFileURL(join(workspaceRoot, 'scripts/database-deploy.mjs')).href
    const deploy = () => new Promise<void>((resolve, reject) => {
      const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); import(workerData.module).then(m => m.deployDatabase(workerData.file)).then(() => parentPort.postMessage('ok')).catch(e => { parentPort.postMessage({ error: e.message }); });`, { eval: true, workerData: { module, file } })
      worker.once('message', result => result === 'ok' ? resolve() : reject(new Error(result.error)))
      worker.once('error', reject)
      worker.once('exit', code => { if (code !== 0) reject(new Error(`Deployment worker exited ${code}`)) })
    })
    await Promise.all([deploy(), deploy()])
    expect(inspectDatabase(file).pending).toEqual([])
    const db = new DatabaseSync(file, { readOnly: true })
    try { expect(db.prepare('SELECT migration_name FROM _prisma_migrations').all()).toHaveLength(2) } finally { db.close() }
  }, 180_000)
  it('supports Node 22.13 and 24, loads local env precedence, and preserves externally set values', async () => {
    expect(() => requireRuntime('22.12.0')).toThrow(/22.13/)
    expect(() => requireRuntime('22.13.0')).not.toThrow()
    expect(() => requireRuntime('24.15.0')).not.toThrow()
    await writeFile(join(directory, '.env'), 'APP_TEST=base\nPRESERVE_TEST=file\nDATABASE_URL=file:./fixture.db\n')
    await writeFile(join(directory, '.env.local'), 'APP_TEST=local\n')
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', PRESERVE_TEST: 'external' }
    loadEnvironment(directory, env)
    expect(env).toMatchObject({ APP_TEST: 'local', PRESERVE_TEST: 'external' })
    runtimeEnvironment(directory, env)
    expect(env.DATABASE_URL).toBe(`file:${join(directory, 'prisma/fixture.db').replaceAll('\\', '/')}`)
    expect(env.UPLOAD_DIR).toBe(join(directory, 'uploads'))
    expect(env.EXPORT_DIR).toBe(join(directory, '.private/exports'))
    expect(sqliteLocation(`file:${join(directory, 'absolute.db').replaceAll('\\', '/')}`, directory).database).toBe(join(directory, 'absolute.db'))
  })
  it('deploys a fresh database from versioned migrations and repeat deployment does not change it', async () => {
    const file = join(directory, 'fresh.db')
    expect(inspectDatabase(file).state).toBe('empty')
    await deployDatabase(file)
    expect(inspectDatabase(file)).toMatchObject({ state: 'versioned', pending: [], adopt: false })
    const first = await fileHash(file)
    await deployDatabase(file)
    expect(await fileHash(file)).toBe(first)
    const db = new DatabaseSync(file, { readOnly: true })
    try {
      expect(db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL').all()).toHaveLength(2)
      expect(db.prepare('PRAGMA table_info(AnalyticsSnapshot)').all().some(row => row.name === 'source')).toBe(true)
    } finally { db.close() }
  }, 180_000)
  it('preflights and backs up a complete existing baseline before adoption, preserving rows', async () => {
    const file = await baseline('adopt.db')
    const bytes = await fileHash(file)
    await deployDatabase(file, { check: true })
    expect(await fileHash(file)).toBe(bytes)
    const result = await deployDatabase(file)
    expect(result.backup).toBeTruthy()
    const backup = new DatabaseSync(result.backup!, { readOnly: true })
    const db = new DatabaseSync(file, { readOnly: true })
    try {
      expect(db.prepare("SELECT name FROM Tenant WHERE id='keep'").get()?.name).toBe('Preserved business')
      expect(backup.prepare("SELECT name FROM Tenant WHERE id='keep'").get()?.name).toBe('Preserved business')
      expect(backup.prepare("SELECT name FROM sqlite_master WHERE name='_prisma_migrations'").get()).toBeUndefined()
    } finally { backup.close(); db.close() }
    expect(inspectDatabase(file).pending).toEqual([])
  }, 180_000)
  it('rejects incomplete schema, missing unique indexes, and foreign key violations without changing data', async () => {
    const invalid = join(directory, 'invalid.db')
    let db = new DatabaseSync(invalid)
    db.exec('CREATE TABLE Tenant (id TEXT PRIMARY KEY,name TEXT); INSERT INTO Tenant VALUES (\'keep\',\'untouched\')')
    db.close()
    const original = await fileHash(invalid)
    await expect(deployDatabase(invalid)).rejects.toThrow(/tables/)
    expect(await fileHash(invalid)).toBe(original)
    const noIndex = await baseline('no-index.db')
    db = new DatabaseSync(noIndex)
    db.exec('DROP INDEX Tenant_slug_key')
    db.close()
    const indexBytes = await fileHash(noIndex)
    await expect(deployDatabase(noIndex)).rejects.toThrow(/unique indexes/)
    expect(await fileHash(noIndex)).toBe(indexBytes)
    const invalidForeignKey = await baseline('foreign-key.db')
    db = new DatabaseSync(invalidForeignKey)
    db.exec('PRAGMA foreign_keys=OFF')
    db.prepare('INSERT INTO Company (id,tenantId,name,country,updatedAt) VALUES (?,?,?,?,?)').run('orphan', 'missing', 'Orphan', 'BD', Date.now())
    db.close()
    const fkBytes = await fileHash(invalidForeignKey)
    await expect(deployDatabase(invalidForeignKey)).rejects.toThrow(/Foreign-key violations/)
    expect(await fileHash(invalidForeignKey)).toBe(fkBytes)
    expect((await readdir(directory)).filter(name => name.startsWith('invalid.db.backup') || name.startsWith('no-index.db.backup') || name.startsWith('foreign-key.db.backup'))).toEqual([])
  }, 180_000)
})

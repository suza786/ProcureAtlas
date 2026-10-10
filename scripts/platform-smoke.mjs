// Production HTTP/worker checks against a disposable database; no provider calls.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { deployDatabase } from './database-deploy.mjs'
const root = process.cwd()
const parent = path.resolve(root, '.private')
await fs.mkdir(parent, { recursive: true })
const directory = await fs.mkdtemp(path.join(parent, 'platform-smoke-'))
const database = path.join(directory, 'fixture.db')
const url = 'file:' + database.replaceAll('\\', '/')
const db = new PrismaClient({ datasources: { db: { url } } })
let server
const tokenHash = raw => crypto.createHash('sha256').update(raw).digest('hex')
async function makeKey(tenant, user) {
  const raw = 'pak_' + crypto.randomBytes(24).toString('hex')
  await db.apiKey.create({ data: { tenantId: tenant.id, userId: user.id, name: 'fixture', scopes: 'api:read api:write', keyPrefix: raw.slice(0, 12), keyHash: 'sha256:' + tokenHash(raw) } })
  return raw
}
try {
  await deployDatabase(database)
  const tenant = await db.tenant.create({ data: { name: 'Smoke fixture', slug: crypto.randomUUID() } })
  const other = await db.tenant.create({ data: { name: 'Other fixture', slug: crypto.randomUUID() } })
  const user = await db.user.create({ data: { tenantId: tenant.id, email: crypto.randomUUID() + '@example.invalid', role: 'owner' } })
  const otherUser = await db.user.create({ data: { tenantId: other.id, email: crypto.randomUUID() + '@example.invalid', role: 'owner' } })
  const key = await makeKey(tenant, user), otherKey = await makeKey(other, otherUser)
  const session = crypto.randomBytes(32).toString('hex')
  await db.session.create({ data: { userId: user.id, token: tokenHash(session), expiresAt: new Date(Date.now() + 3600000), lastActivityAt: new Date() } })
  await db.company.create({ data: { tenantId: tenant.id, name: 'Fixture company', country: 'US' } })
  const buyerOrg = await db.organization.create({ data: { name: 'Fixture buyer', sourcePortal: 'fixture', orgType: 'buyer' } })
  const buyer = await db.buyer.create({ data: { organizationId: buyerOrg.id } })
  const supplier = await db.organization.create({ data: { name: 'Fixture supplier', sourcePortal: 'fixture', orgType: 'supplier' } })
  await db.supplierProfile.create({ data: { organizationId: supplier.id, isCompetitor: true, notes: 'GLOBAL PRIVATE NOTE MUST NOT LEAK' } })
  const tender = await db.tender.create({ data: { sourcePortal: 'fixture', sourceUrl: 'https://example.invalid', title: '=Fixture', country: 'US', market: 'US', sector: 'IT', buyerId: buyer.id } })
  await db.award.create({ data: { tenderId: tender.id, supplierOrgId: supplier.id, contractValue: 100, currency: 'USD', awardedAt: new Date() } })
  const upload = await db.fileUpload.create({ data: { tenantId: tenant.id, uploadedById: user.id, fileName: 'legacy.txt', fileType: 'text/plain', fileSizeKb: 1, checksum: '0'.repeat(64), storageKey: 'legacy', category: 'evidence', virusScanResult: 'clean' } })
  const port = await new Promise(resolve => { const listener = net.createServer(); listener.listen(0, '127.0.0.1', () => { const number = listener.address().port; listener.close(() => resolve(number)) }) })
  const env = { ...process.env, DATABASE_URL: url, DEMO_MODE: 'false', DEMO_BILLING_SWITCHING: 'false', PORT: String(port), HOSTNAME: '127.0.0.1', EXPORT_DIR: path.join(directory, 'exports'), UPLOAD_DIR: path.join(directory, 'uploads') }
  server = spawn(process.execPath, ['.next/standalone/server.js'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  server.stdout.on('data', b => { logs = (logs + b.toString()).slice(-8000) }); server.stderr.on('data', b => { logs = (logs + b.toString()).slice(-8000) })
  const origin = `http://127.0.0.1:${port}`
  for (let attempt = 0; ; attempt++) {
    try { await fetch(origin + '/api/auth/me', { signal: AbortSignal.timeout(1000) }); break }
    catch { if (attempt >= 120 || server.exitCode !== null) throw new Error('Server failed to start: ' + logs); await new Promise(resolve => setTimeout(resolve, 500)) }
  }
  async function check(route, expected, options = {}) {
    const response = await fetch(origin + route, { ...options, signal: AbortSignal.timeout(20000) })
    if (response.status !== expected) throw new Error(`${route}: expected ${expected}, got ${response.status}: ${await response.text()}`)
    console.log(`${options.method ?? 'GET'} ${route}: ${response.status}`)
    return response
  }
  const bearer = { Authorization: 'Bearer ' + key }, cookie = { Cookie: 'procureatlas_session=' + session }
  await check('/api/buyers', 401)
  await check('/api/buyers?limit=1&offset=0', 200, { headers: cookie })
  const competitor = await (await check('/api/competitors', 200, { headers: cookie })).json()
  if (competitor.items[0]?.isCompetitor || JSON.stringify(competitor).includes('GLOBAL PRIVATE NOTE')) throw new Error('Global private supplier annotations leaked')
  await check('/api/awards', 200, { headers: cookie })
  await check(`/api/uploads/${upload.id}?download=true`, 423, { headers: cookie })
  const artifact = await (await check('/api/v1/exports', 201, { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ exportType: 'tenders', format: 'csv' }) })).json()
  const csv = await (await check(artifact.downloadUrl, 200, { headers: bearer })).text()
  if (!csv.includes("'=Fixture")) throw new Error('CSV spreadsheet escaping missing')
  await check(artifact.downloadUrl, 404, { headers: { Authorization: 'Bearer ' + otherKey } })
  await db.dataExport.update({ where: { id: artifact.id }, data: { expiresAt: new Date(0) } })
  await check(artifact.downloadUrl, 410, { headers: bearer })
  await db.user.update({ where: { id: user.id }, data: { active: false } })
  await check('/api/v1/usage', 401, { headers: bearer })
  await check('/api/buyers', 401, { headers: cookie })
  const worker = spawnSync(process.execPath, ['scripts/worker.mjs', '--once'], { env, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (worker.status !== 0) throw new Error('Worker startup failed: ' + worker.stderr + worker.stdout)
  console.log('Worker --once: exit 0; disposable fixture processing, no external delivery')
} finally {
  if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)) }
  await db.$disconnect()
  const relative = path.relative(parent, path.resolve(directory))
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await fs.rm(directory, { recursive: true, force: true })
}

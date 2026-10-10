// Real production HTTP workflows against a disposable two-tenant SQLite database.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { verifyReleaseBrowser } from './release-browser.mjs'
const root = process.cwd(), parent = path.resolve(root, '.private')
await fs.mkdir(parent, { recursive: true })
const directory = await fs.mkdtemp(path.join(parent, 'release-workflow-'))
const database = path.join(directory, 'fixture.db')
const url = 'file:' + database.replaceAll('\\', '/')
const db = new PrismaClient({ datasources: { db: { url } } })
let server
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex')
try {
  const migrated = spawnSync(process.execPath, ['scripts/database-deploy.mjs', '--database', database], { windowsHide: true, encoding: 'utf8', timeout: 60000 })
  if (migrated.status !== 0) throw new Error('Fixture migration failed: ' + migrated.stderr + migrated.stdout)
  const tenants = await Promise.all(['A', 'B'].map(name => db.tenant.create({ data: { name: 'Release fixture ' + name, slug: crypto.randomUUID() } })))
  const principals = []
  for (const tenant of tenants) {
    const owner = await db.user.create({ data: { tenantId: tenant.id, email: crypto.randomUUID() + '@example.invalid', role: 'owner', active: true } })
    const manager = await db.user.create({ data: { tenantId: tenant.id, email: crypto.randomUUID() + '@example.invalid', role: 'manager', active: true } })
    const company = await db.company.create({ data: { tenantId: tenant.id, name: 'Private release company ' + tenant.id, country: 'US' } })
    const cookies = []
    for (const user of [owner, manager]) {
      const token = crypto.randomBytes(32).toString('hex')
      await db.session.create({ data: { userId: user.id, token: hash(token), expiresAt: new Date(Date.now() + 3600000), lastActivityAt: new Date() } })
      cookies.push('procureatlas_session=' + token)
    }
    principals.push({ tenant, owner, manager, company, cookie: cookies[0], managerCookie: cookies[1] })
  }
  const tender = await db.tender.create({ data: { title: 'Release procurement workflow', sourcePortal: 'release-fixture', sourceUrl: 'https://example.invalid', country: 'US', market: 'US', sector: 'IT', currency: 'USD', valueUSD: 50000, submissionDeadline: new Date(Date.now() + 30 * 86400000) } })
  const requirement = await db.requirement.create({ data: { tenderId: tender.id, category: 'financial', criterion: 'Annual turnover', isMandatory: true, thresholdStatus: 'reviewed', evaluationMetric: 'annual_turnover', thresholdAmount: 100000, thresholdCurrency: 'USD', thresholdUnit: 'money', operator: '>=' } })
  for (const principal of principals) principal.alert = await db.alert.create({ data: { tenantId: principal.tenant.id, tenderId: tender.id, type: 'deadline', title: 'Private release alert', message: 'Tenant-owned deadline reminder' } })
  const port = await new Promise(resolve => { const listener = net.createServer(); listener.listen(0, '127.0.0.1', () => { const value = listener.address().port; listener.close(() => resolve(value)) }) })
  const origin = `http://127.0.0.1:${port}`
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'production', DEMO_MODE: 'false', DEMO_BILLING_SWITCHING: 'false', HOSTNAME: '127.0.0.1', PORT: String(port), UPLOAD_DIR: path.join(directory, 'uploads'), EXPORT_DIR: path.join(directory, 'exports') }
  server = spawn(process.execPath, ['.next/standalone/server.js'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { logs = (logs + data.toString()).slice(-8000) })
  for (let attempt = 0; ; attempt++) {
    try { await fetch(origin + '/api/auth/me', { signal: AbortSignal.timeout(1000) }); break }
    catch { if (attempt >= 120 || server.exitCode !== null) throw new Error('Production server did not start: ' + logs); await new Promise(resolve => setTimeout(resolve, 500)) }
  }
  let checks = 0
  async function request(principal, method, route, body, expected = 200, manager = false) {
    const response = await fetch(origin + route, { method, headers: { Cookie: manager ? principal.managerCookie : principal.cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) })
    const data = await response.json()
    if (response.status !== expected) throw new Error(`${method} ${route}: expected ${expected}, received ${response.status}: ${JSON.stringify(data)}`)
    checks++
    return data
  }
  const [a, b] = principals
  for (const principal of principals) {
    const evidence = await request(principal, 'POST', '/api/company/evidence', { category: 'financial', title: 'Reviewed turnover statement', factMetric: 'annual_turnover', factAmount: 500000, factCurrency: 'USD', factUnit: 'money' }, 201)
    await request(principal, 'PATCH', '/api/company/evidence', { id: evidence.id, verified: true, factMetric: 'annual_turnover', factAmount: 500000, factCurrency: 'USD', factUnit: 'money' })
    principal.evidence = evidence
    await request(principal, 'POST', '/api/approval-chains', { name: 'Two-step submission review', triggerType: 'submission', steps: [{ order: 1, role: 'manager', approverEmail: principal.manager.email }, { order: 2, role: 'owner', approverEmail: principal.owner.email }] }, 201)
    principal.pursuit = await request(principal, 'POST', '/api/pursuits', { tenderId: tender.id, companyId: principal.company.id }, 201)
    principal.task = await db.task.create({ data: { pursuitId: principal.pursuit.id, title: 'Check submission package', assignee: principal.owner.id } })
    await request(principal, 'PATCH', `/api/pursuits/${principal.pursuit.id}/tasks/${principal.task.id}`, { status: 'done' })
    await request(principal, 'PATCH', '/api/pursuits/' + principal.pursuit.id, { expectedStage: 'discovering', stage: 'qualifying' })
    await request(principal, 'PATCH', '/api/pursuits/' + principal.pursuit.id, { expectedStage: 'qualifying', stage: 'bidding' })
    await request(principal, 'PATCH', `/api/pursuits/${principal.pursuit.id}/compliance`, { requirementId: requirement.id, evidenceId: evidence.id, status: 'compliant' })
    principal.proposal = await request(principal, 'POST', '/api/proposals', { pursuitId: principal.pursuit.id, title: 'Release verified proposal' }, 201)
    const detail = await request(principal, 'GET', '/api/tenders/' + tender.id)
    if (detail.alerts?.length !== 1 || detail.alerts[0].id !== principal.alert.id) throw new Error('Tender details omitted or leaked tenant-owned alerts')
  }
  // Read and write boundaries are exercised with actual sessions and database rows.
  for (const [actor, victim] of [[a, b], [b, a]]) {
    await request(actor, 'GET', '/api/pursuits/' + victim.pursuit.id, undefined, 404)
    await request(actor, 'GET', `/api/pursuits/${victim.pursuit.id}/compliance`, undefined, 404)
    await request(actor, 'GET', '/api/proposals/' + victim.proposal.id, undefined, 404)
    await request(actor, 'PATCH', `/api/pursuits/${victim.pursuit.id}/tasks/${victim.task.id}`, { status: 'done' }, 404)
    await request(actor, 'POST', '/api/proposals', { pursuitId: victim.pursuit.id, title: 'Foreign proposal' }, 404)
    await request(actor, 'PATCH', `/api/pursuits/${actor.pursuit.id}/compliance`, { requirementId: requirement.id, evidenceId: victim.evidence.id, status: 'compliant' }, 404)
    const search = await request(actor, 'GET', '/api/search?q=Private%20release&types=company', undefined)
    if (search.results.some(result => result.id === victim.company.id) || !search.results.some(result => result.id === actor.company.id)) throw new Error('Global search leaked a private company')
  }
  for (const principal of principals) {
    const id = principal.proposal.id
    await request(principal, 'PATCH', '/api/proposals/' + id, { expectedRevision: 0, status: 'submitted' }, 409)
    for (const section of principal.proposal.sections) {
      const route = `/api/proposals/${id}/sections/${section.id}`
      await request(principal, 'PATCH', route, { expectedRevision: 0, content: `Human reviewed ${section.title}; requirement satisfied. [evidence:${principal.evidence.id}]`, evidenceIds: [principal.evidence.id], status: 'approved' })
      await request(principal, 'PATCH', route, { expectedRevision: 0, content: 'Stale update' }, 409)
    }
    let proposal = await request(principal, 'GET', '/api/proposals/' + id)
    proposal = await request(principal, 'PATCH', '/api/proposals/' + id, { expectedRevision: proposal.revision, status: 'in_review' })
    const approvals = (await db.approval.findMany({ where: { proposalId: id, tenantId: principal.tenant.id }, orderBy: { stepOrder: 'asc' } }))
    if (approvals.length !== 2) throw new Error('Expected the real configured two-step approval chain')
    await request(principal, 'PATCH', '/api/approvals/' + approvals[1].id, { decision: 'approved' }, 409)
    await request(principal, 'PATCH', '/api/approvals/' + approvals[0].id, { decision: 'approved' }, 403)
    await request(principal, 'PATCH', '/api/approvals/' + approvals[0].id, { decision: 'approved' }, 200, true)
    await request(principal, 'PATCH', '/api/approvals/' + approvals[1].id, { decision: 'approved' })
    proposal = await request(principal, 'GET', '/api/proposals/' + id)
    if (proposal.status !== 'approved') throw new Error('Final approval did not approve the proposal')
    await request(principal, 'PATCH', '/api/proposals/' + id, { expectedRevision: proposal.revision, status: 'submitted' })
    const final = await db.pursuit.findUniqueOrThrow({ where: { id: principal.pursuit.id }, include: { bid: true, proposals: true } })
    if (final.stage !== 'submitted' || final.bid?.status !== 'submitted' || !final.bid.submittedAt || final.proposals[0]?.status !== 'submitted') throw new Error('Proposal/bid/pursuit submission was inconsistent')
    if (await db.outboxJob.count({ where: { tenantId: principal.tenant.id, kind: 'webhook.event' } }) < 5) throw new Error('Workflow events were not durably recorded')
    await request(principal, 'PATCH', `/api/pursuits/${principal.pursuit.id}/tasks/${principal.task.id}`, { status: 'todo' }, 409)
  }
  console.log(`API workflow passed: ${checks} real HTTP checks; starting headless browser verification.`)
  await verifyReleaseBrowser(origin, principals, directory)
  console.log(`Release workflow passed: ${checks} real HTTP checks, two isolated tenants, verified compliance, 18 reviewed sections, ordered assigned approvals, atomic submission, stale-edit and bypass rejection. No external providers called.`)
} finally {
  if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)) }
  await db.$disconnect()
  const relative = path.relative(parent, directory)
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

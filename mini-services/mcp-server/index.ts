// ProcureAtlas AI — MCP Server (Phase 2 skeleton)
//
// Implements a minimal MCP (Model Context Protocol) server with HTTP+SSE transport.
// Exposes READ-ONLY tools from the ProcureAtlas intelligence graph.
//
// Per /docs/AI_ARCHITECTURE.md §6:
//   - MCP never exposes consequential actions (no submit, no delete, no approval decide)
//   - MCP never returns data the caller's API key is not authorized to read
//   - Every tool call is logged in the audit log
//
// Authorization: Bearer token (API key starting with "pak_...")
// Scopes: mcp:read required for all tools
//
// Port: 3001 (forwarded by Caddy via XTransformPort query param)

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const PORT = 3001
const db = new PrismaClient()

// ============================================================
// MCP tool definitions
// ============================================================

interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>, tenantId: string) => Promise<unknown>
}

const tools: Tool[] = [
  {
    name: 'tenders.search',
    description: 'Search tenders by market, sector, status, or free-text query. Returns up to 50 results.',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string', description: 'BD | SG | WB | ADB | UN | EU | US' },
        sector: { type: 'string', description: 'Cyber | IT | Consulting | Construction | Health | Engineering' },
        status: { type: 'string', description: 'active | closed | awarded | cancelled', default: 'active' },
        search: { type: 'string', description: 'Free-text search in title and description' },
        limit: { type: 'number', description: 'Max results (1-50)', default: 20 },
      },
    },
    async handler(args, tenantId) {
      // Tenders are global (not tenant-scoped) — but we log the caller's tenant
      const where: Record<string, unknown> = {}
      if (args.market) where.market = args.market
      if (args.sector) where.sector = args.sector
      if (args.status) where.status = args.status
      if (args.search) {
        where.OR = [
          { title: { contains: String(args.search) } },
          { description: { contains: String(args.search) } },
        ]
      }
      const limit = Math.min(Number(args.limit ?? 20), 50)
      const items = await db.tender.findMany({
        where,
        select: {
          id: true, title: true, market: true, sector: true, country: true,
          estimatedValue: true, valueUSD: true, currency: true,
          submissionDeadline: true, status: true, sourcePortal: true, sourceUrl: true,
          buyer: { select: { organization: { select: { name: true } } } },
        },
        orderBy: { submissionDeadline: 'asc' },
        take: limit,
      })
      return {
        count: items.length,
        items: items.map((t) => ({
          id: t.id,
          title: t.title,
          market: t.market,
          sector: t.sector,
          country: t.country,
          valueUSD: t.valueUSD,
          currency: t.currency,
          submissionDeadline: t.submissionDeadline,
          status: t.status,
          source: t.sourcePortal,
          url: t.sourceUrl,
          buyer: t.buyer?.organization?.name ?? null,
        })),
      }
    },
  },
  {
    name: 'tenders.get',
    description: 'Get the full Tender Digital Twin by ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    async handler(args, _tenantId) {
      const tender = await db.tender.findUnique({
        where: { id: String(args.id) },
        include: {
          buyer: { include: { organization: true } },
          lots: true,
          requirements: true,
          amendments: { orderBy: { amendmentNo: 'asc' } },
          awards: { include: { supplier: true } },
        },
      })
      if (!tender) return { error: 'Tender not found' }
      return tender
    },
  },
  {
    name: 'tenders.requirements',
    description: 'List requirements for a tender, with source citations.',
    inputSchema: {
      type: 'object',
      properties: { tenderId: { type: 'string' } },
      required: ['tenderId'],
    },
    async handler(args, _tenantId) {
      const items = await db.requirement.findMany({
        where: { tenderId: String(args.tenderId) },
        orderBy: { category: 'asc' },
      })
      return {
        count: items.length,
        items: items.map((r) => ({
          id: r.id,
          category: r.category,
          criterion: r.criterion,
          threshold: r.threshold,
          isMandatory: r.isMandatory,
          source: { doc: r.sourceDoc, page: r.sourcePage, clause: r.sourceClause, extractedText: r.extractedText },
          confidence: r.confidence,
        })),
      }
    },
  },
  {
    name: 'pursuits.list',
    description: 'List pursuits for the current tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'discovering | qualifying | bidding | submitted | won | lost | no_bid' },
      },
    },
    async handler(args, tenantId) {
      const where: Record<string, unknown> = { tenantId }
      if (args.stage) where.stage = args.stage
      const items = await db.pursuit.findMany({
        where,
        include: { tender: { select: { title: true, market: true, valueUSD: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
      return {
        count: items.length,
        items: items.map((p) => ({
          id: p.id,
          stage: p.stage,
          bidDecision: p.bidDecision,
          priority: p.priority,
          estimatedValueUSD: p.estimatedValueUSD,
          winProbability: p.winProbability,
          tender: p.tender,
        })),
      }
    },
  },
  {
    name: 'company.brain',
    description: 'Get the Company Brain (evidence graph) for the current tenant.',
    inputSchema: { type: 'object', properties: {} },
    async handler(_args, tenantId) {
      const company = await db.company.findFirst({
        where: { tenantId },
        include: {
          evidence: true,
          certifications: true,
          projectRefs: true,
          employees: true,
        },
      })
      if (!company) return { error: 'Company not found' }
      return {
        name: company.name,
        country: company.country,
        foundedYear: company.foundedYear,
        employeeCount: company.employeeCount,
        annualTurnoverUSD: company.annualTurnoverUSD,
        evidenceCount: company.evidence.length,
        certificationCount: company.certifications.length,
        projectReferenceCount: company.projectRefs.length,
        certifications: company.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer,
          expiresAt: c.expiresAt,
        })),
      }
    },
  },
  {
    name: 'alerts.list',
    description: 'List active alerts for the current tenant.',
    inputSchema: { type: 'object', properties: {} },
    async handler(_args, tenantId) {
      const items = await db.alert.findMany({
        where: { tenantId, acknowledgedAt: null },
        orderBy: [{ severity: 'desc' }, { dueAt: 'asc' }],
        take: 20,
      })
      return { count: items.length, items }
    },
  },
  {
    name: 'compliance.matrix',
    description: 'Get the compliance matrix for a pursuit.',
    inputSchema: {
      type: 'object',
      properties: { pursuitId: { type: 'string' } },
      required: ['pursuitId'],
    },
    async handler(args, tenantId) {
      const pursuit = await db.pursuit.findFirst({
        where: { id: String(args.pursuitId), tenantId },
        include: {
          complianceItems: {
            include: {
              requirement: true,
              evidence: { select: { title: true } },
            },
          },
        },
      })
      if (!pursuit) return { error: 'Pursuit not found' }
      return {
        pursuitId: pursuit.id,
        stage: pursuit.stage,
        items: pursuit.complianceItems.map((c) => ({
          requirement: c.requirement.criterion,
          status: c.status,
          evidence: c.evidence?.title ?? null,
          confidence: c.confidence,
        })),
      }
    },
  },
]

// ============================================================
// API key validation
// ============================================================

async function validateApiKey(req: IncomingMessage): Promise<{ valid: boolean; tenantId?: string; scopes?: string[] }> {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return { valid: false }
  }
  const rawKey = auth.slice(7)
  if (!rawKey.startsWith('pak_')) {
    return { valid: false }
  }
  // Look up by prefix first (faster), then verify with bcrypt
  const prefix = rawKey.slice(0, 12)
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: prefix, revokedAt: null },
    take: 5,
  })
  for (const k of candidates) {
    if (k.expiresAt && k.expiresAt < new Date()) continue
    if (bcrypt.compareSync(rawKey, k.keyHash)) {
      // Update lastUsedAt
      await db.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } })
      return { valid: true, tenantId: k.tenantId ?? undefined, scopes: k.scopes.split(' ') }
    }
  }
  return { valid: false }
}

// ============================================================
// JSON-RPC 2.0 handler (MCP-compatible subset)
// ============================================================

async function handleJsonRpc(req: IncomingMessage, res: ServerResponse, body: unknown) {
  const auth = await validateApiKey(req)
  if (!auth.valid || !auth.tenantId) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: invalid or missing API key' } }))
    return
  }
  if (!auth.scopes?.includes('mcp:read')) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32002, message: 'Forbidden: mcp:read scope required' } }))
    return
  }

  const { id, method, params } = body as { id?: string | number; method: string; params?: Record<string, unknown> }

  try {
    if (method === 'initialize') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'procureatlas-mcp', version: '0.2.0' },
          capabilities: { tools: {} },
        },
      }))
      return
    }

    if (method === 'tools/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0', id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      }))
      return
    }

    if (method === 'tools/call') {
      const toolName = params?.name as string
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>
      const tool = tools.find((t) => t.name === toolName)
      if (!tool) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolName}` } }))
        return
      }
      const result = await tool.handler(toolArgs, auth.tenantId)
      // Audit log the call
      await db.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          action: 'mcp_tool_call',
          entityType: 'mcp',
          entityId: toolName,
          afterJson: JSON.stringify({ args: toolArgs, resultSize: JSON.stringify(result).length }),
        },
      }).catch(() => { /* audit failures never block */ })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }))
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error', data: (e as Error).message } }))
  }
}

// ============================================================
// HTTP server
// ============================================================

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'procureatlas-mcp', version: '0.2.0' }))
    return
  }

  // MCP endpoint — accepts JSON-RPC 2.0 requests
  if (req.url === '/' || req.url === '/mcp') {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body)
          await handleJsonRpc(req, res, parsed)
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error', data: (e as Error).message } }))
        }
      })
      return
    }
    // GET returns server info
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      service: 'procureatlas-mcp',
      version: '0.2.0',
      protocol: 'MCP (JSON-RPC 2.0 over HTTP)',
      endpoints: {
        '/': 'MCP JSON-RPC endpoint',
        '/health': 'Health check',
        '/tools': 'Tool catalog (HTML)',
      },
      auth: 'Bearer token (API key starting with pak_)',
      scopes: 'mcp:read required for all tools',
    }))
    return
  }

  // Tools catalog (human-readable)
  if (req.url === '/tools') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<!doctype html>
<html><head><title>ProcureAtlas MCP — Tools</title>
<style>
  body { font-family: ui-sans-serif, system-ui; padding: 2rem; max-width: 900px; margin: 0 auto; color: #0f172a; }
  h1 { color: #0f172a; }
  .tool { border: 1px solid #e2e8f0; padding: 1rem; margin: 1rem 0; border-radius: 6px; background: #f8fafc; }
  .tool h3 { margin: 0 0 0.5rem 0; color: #0f172a; }
  .tool .desc { color: #475569; font-size: 0.875rem; margin-bottom: 0.5rem; }
  pre { background: #1e293b; color: #f1f5f9; padding: 0.75rem; border-radius: 4px; font-size: 0.75rem; overflow-x: auto; }
</style>
</head><body>
<h1>ProcureAtlas MCP Server — Tool Catalog</h1>
<p>Phase 2 skeleton. ${tools.length} read-only tools available. Authorization: Bearer token (API key with <code>mcp:read</code> scope).</p>
${tools.map((t) => `
<div class="tool">
  <h3>${t.name}</h3>
  <div class="desc">${t.description}</div>
  <pre>${JSON.stringify(t.inputSchema, null, 2)}</pre>
</div>
`).join('')}
</body></html>`)
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`[mcp-server] ProcureAtlas MCP server listening on port ${PORT}`)
  console.log(`[mcp-server] Tools: ${tools.map((t) => t.name).join(', ')}`)
  console.log(`[mcp-server] Health: http://localhost:${PORT}/health`)
  console.log(`[mcp-server] Tool catalog: http://localhost:${PORT}/tools`)
})

process.on('SIGTERM', async () => {
  console.log('[mcp-server] SIGTERM received, shutting down...')
  await db.$disconnect()
  server.close(() => process.exit(0))
})

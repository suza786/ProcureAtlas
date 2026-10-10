import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/usage-meter', () => ({ meterApiRequest: async () => {} }))
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), session: vi.fn(), write: vi.fn(), tenant: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/db', () => ({ db: { session: { findUnique: mocks.session }, tenant: { findUnique: mocks.tenant }, apiKey: { create: mocks.write } } }))
import { POST as createKey } from '@/app/api/api-keys/route'
import { NextRequest } from 'next/server'

describe('internal route authorization', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejects unauthenticated mutations before writing', async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined })
    const response = await createKey(new NextRequest('http://localhost/api/api-keys', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(401)
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.tenant).not.toHaveBeenCalled()
  })
  it('rejects viewers before parsing or writing administrative requests', async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: 'token' }) })
    mocks.session.mockResolvedValue({ id: 'session', revokedAt: null, expiresAt: new Date(Date.now() + 60000), lastActivityAt: new Date(),
      user: { id: 'viewer', active: true, tenantId: 'a', role: 'viewer', email: 'v@example.com', tenant: { slug: 'a' } } })
    const response = await createKey(new NextRequest('http://localhost/api/api-keys', { method: 'POST', body: 'malformed' }))
    expect(response.status).toBe(403)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('guards every internal mutation and every API-key v1 handler', () => {
    function walk(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === 'route.ts' ? [path.join(dir, e.name)] : [])
    }
    for (const file of walk('src/app/api')) {
      const name = file.replaceAll('\\', '/')
      if (name.includes('/billing/events/') || name.includes('/auth/') || name.includes('/scim/') || name.includes('/webhooks/ingest/')) continue
      const text = fs.readFileSync(file, 'utf8')
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      for (const statement of source.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(statement.name.text)) {
          expect(statement.getText(source), name).toContain('requireTenantWithRole(')
          expect(statement.getText(source), name).toContain('withApiErrors')
        }
        if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue
          const method = declaration.name.text
          if (!['GET', 'POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) continue
          const handler = declaration.getText(source)
          if (name.includes('/v1/')) {
            expect(handler, name).toContain(`requireApiScope(authResult, '${method === 'GET' ? 'api:read' : 'api:write'}')`)
          } else if (method !== 'GET') {
            expect(handler, name).toContain('requireTenantWithRole(')
          }
          if (name.includes('/v1/') || method !== 'GET') expect(handler, name).toContain('withApiErrors')
        }
      }
    }
  })
})

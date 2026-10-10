import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ audit: vi.fn(), sessionFind: vi.fn(), sessionUpdate: vi.fn(), cookieGet: vi.fn(), cookieDelete: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { auditLog: { create: mocks.audit }, session: { findUnique: mocks.sessionFind, update: mocks.sessionUpdate } } }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
import { logAction, signOut, hashToken } from '@/lib/auth'

let auditRows: Array<Record<string, unknown>>
beforeEach(() => {
  vi.clearAllMocks(); auditRows = []
  mocks.audit.mockImplementation(async ({ data }) => { auditRows.push(data); return data })
  mocks.cookieGet.mockReturnValue({ value: 'session-secret' })
  mocks.sessionFind.mockResolvedValue({ id: 'session', userId: 'user-a', user: { tenantId: 'tenant-a' } })
})

it('stores API-key actors separately from user foreign keys, even when a user ID is supplied', async () => {
  await logAction({ tenantId: 'tenant-a', apiKeyId: 'key-a', userId: 'user-a', action: 'export_requested', entityType: 'data_export', afterJson: { format: 'csv' } })
  expect(auditRows[0]).toMatchObject({ tenantId: 'tenant-a', apiKeyId: 'key-a', userId: null, actorType: 'api_key', action: 'export_requested', entityType: 'data_export', afterJson: '{"format":"csv"}' })
})
it.each([
  [{ userId: 'user-a' }, { userId: 'user-a', apiKeyId: null, actorType: 'user' }],
  [{}, { userId: null, apiKeyId: null, actorType: 'system' }],
])('preserves user and system actor identities %j', async (actor, expected) => {
  await logAction({ tenantId: 'tenant-a', action: 'reviewed', entityType: 'tender', ...actor })
  expect(auditRows[0]).toMatchObject(expected)
})
it('logs logout under the session user tenant and revokes the session identified by a hashed cookie', async () => {
  await signOut(new Request('http://localhost/api/auth/sign-out'))
  expect(auditRows).toHaveLength(1)
  expect(auditRows[0]).toMatchObject({ tenantId: 'tenant-a', userId: 'user-a', actorType: 'user', action: 'logout', entityType: 'auth', entityId: 'user-a' })
  expect(mocks.sessionFind).toHaveBeenCalledWith({ where: { token: hashToken('session-secret') }, include: { user: { select: { tenantId: true } } } })
  expect(mocks.sessionUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'session' }, data: { revokedAt: expect.any(Date) } })
  expect(mocks.cookieDelete).toHaveBeenCalledWith('procureatlas_session')
})
it('clears an unknown session cookie without inventing a tenant audit actor', async () => {
  mocks.sessionFind.mockResolvedValue(null)
  await signOut()
  expect(auditRows).toHaveLength(0)
  expect(mocks.cookieDelete).toHaveBeenCalledWith('procureatlas_session')
})

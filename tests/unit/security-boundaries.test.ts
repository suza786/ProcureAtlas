import { describe, it, expect, vi } from 'vitest'
import crypto from 'node:crypto'
import path from 'node:path'
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
import { roleAtLeast } from '@/lib/auth'
import { assertPublicWebhookUrl, isPublicIp } from '@/lib/url-guard'
import { getTenantUploadDirectory, requireTenantStoredPath } from '@/lib/upload-security'
import { verifyInboundWebhook } from '@/lib/inbound-webhook'
import { requireApiScope } from '@/lib/api-scopes'

describe('role hierarchy', () => {
  const roles = ['viewer', 'contributor', 'manager', 'admin', 'owner']
  it('allows exactly the same role or higher for every pair', () => {
    roles.forEach((user, i) => roles.forEach((required, j) =>
      expect(roleAtLeast(user, required), `${user} >= ${required}`).toBe(i >= j)))
    expect(roleAtLeast('unknown', 'viewer')).toBe(false)
    expect(roleAtLeast('constructor', 'viewer')).toBe(false)
    expect(roleAtLeast('__proto__', 'viewer')).toBe(false)
    expect(roleAtLeast('owner', 'unknown')).toBe(false)
    expect(roleAtLeast('OWNER', 'Admin')).toBe(true)
  })
})

describe('public addresses', () => {
  it.each(['0.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254',
    '100.64.0.1', '100.127.255.255', '224.0.0.1', '198.18.0.1',
    '::ffff:192.168.1.1', '::ffff:c0a8:101', 'febf::1', 'fd12::1'])('rejects %s', ip => {
    expect(isPublicIp(ip)).toBe(false)
    expect(assertPublicWebhookUrl(`http://${ip.includes(':') ? `[${ip}]` : ip}/`).ok).toBe(false)
  })
  it.each(['8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.1', '2001:4860:4860::8888'])('allows %s', ip => {
    expect(isPublicIp(ip)).toBe(true)
  })
  it('rejects embedded credentials', () => expect(assertPublicWebhookUrl('https://user:pass@example.com').ok).toBe(false))
})

describe('upload paths', () => {
  it.each(['../other', '../../src', '..\\other', '/tmp', 'C:\\Windows', 'evidence/../proposal', 'unknown'])('rejects category %s', category => {
    expect(() => getTenantUploadDirectory('uploads', 'tenant-a', category)).toThrow()
  })
  it('contains valid categories within the tenant root', () => {
    expect(getTenantUploadDirectory('uploads', 'tenant-a', 'evidence')).toBe(path.resolve('uploads', 'tenant-a', 'evidence'))
    expect(() => getTenantUploadDirectory('uploads', '../tenant-b', 'evidence')).toThrow()
  })
  it('rejects historical paths that cross tenant or category boundaries', () => {
    expect(() => requireTenantStoredPath('uploads', 'tenant-a', 'evidence', path.resolve('uploads', 'tenant-b', 'evidence', 'file.txt'))).toThrow()
    expect(() => requireTenantStoredPath('uploads', 'tenant-a', 'evidence', path.resolve('src', 'app', 'file.txt'))).toThrow()
    expect(requireTenantStoredPath('uploads', 'tenant-a', 'evidence', path.resolve('uploads', 'tenant-a', 'evidence', 'file.txt'))).toBe(path.resolve('uploads', 'tenant-a', 'evidence', 'file.txt'))
  })
})

describe('API scopes', () => {
  it('denies read keys writes and fails closed without tenant or scopes', () => {
    expect(() => requireApiScope({ valid: true, tenantId: 'a', scopes: ['api:read'] }, 'api:write')).toThrow()
    expect(() => requireApiScope({ valid: true, scopes: ['api:write'] }, 'api:write')).toThrow()
    expect(() => requireApiScope({ valid: true, tenantId: 'a' }, 'api:read')).toThrow()
    expect(() => requireApiScope({ valid: true, tenantId: 'a', scopes: ['api:write'] }, 'api:write')).not.toThrow()
  })
})

describe('inbound signatures', () => {
  const body = '{"title":"Tender"}', now = 1800000000, source = 'worldbank', event = 'tender.created', id = 'event-123'
  const signature = 'sha256=' + crypto.createHmac('sha256', 'secret').update(`${source}.${event}.${id}.${now}.${body}`).digest('hex')
  const headers = () => new Headers({ 'x-webhook-source': source, 'x-webhook-event': event, 'x-webhook-id': id,
    'x-webhook-timestamp': String(now), 'x-webhook-signature': signature })
  it('accepts a fresh, correctly signed body only', () => {
    expect(verifyInboundWebhook(headers(), body, { worldbank: 'secret' }, now)).toMatchObject({ source, eventType: event, eventId: id })
    expect(() => verifyInboundWebhook(headers(), body + ' ', { worldbank: 'secret' }, now)).toThrow()
    expect(() => verifyInboundWebhook(headers(), body, {}, now)).toThrow()
    expect(() => verifyInboundWebhook(headers(), body, { worldbank: 'secret' }, now + 301)).toThrow()
    const changed = headers(); changed.set('x-webhook-source', 'custom')
    expect(() => verifyInboundWebhook(changed, body, { custom: 'secret' }, now)).toThrow()
    const missing = headers(); missing.delete('x-webhook-signature')
    expect(() => verifyInboundWebhook(missing, body, { worldbank: 'secret' }, now)).toThrow()
  })
})

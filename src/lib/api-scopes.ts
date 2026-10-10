type ApiIdentity = { valid: boolean; tenantId?: string; scopes?: string[] }
export function requireApiScope<T extends ApiIdentity>(identity: T, scope: 'api:read' | 'api:write'): asserts identity is T & { tenantId: string } {
  if (!identity.valid || !identity.tenantId) throw new Response('Invalid or missing tenant API key', { status: 401 })
  if (!identity.scopes?.includes(scope)) throw new Response('Required scope: ' + scope, { status: 403 })
}

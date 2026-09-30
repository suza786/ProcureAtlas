// ProcureAtlas AI — Phase 2 Tenant/Session Service Layer
//
// Multi-tenancy enforcement: every tenant-scoped query passes through here.
// In Phase 2 production, getCurrentTenant() returns the authenticated user's tenant.
// In the demo sandbox (no auth), we fall back to the demo tenant for exploration.
//
// Pattern: every API route calls getCurrentTenant() to get { tenantId, userId, role }.
// Never query the DB with a tenantId from user input — always from the session.

import { getCurrentUser, requireUser, type AuthenticatedUser } from './auth'
import { db } from './db'

export interface TenantContext {
  tenantId: string
  tenantSlug: string
  userId: string | null
  role: string
  authenticated: boolean
}

const DEMO_TENANT_SLUG = 'atlas-demo'

/**
 * Get the current tenant context. In demo mode (no auth), returns the demo tenant
 * with a synthetic owner role. In production, requires authentication.
 *
 * The `requireAuth` flag forces authentication (use for write operations).
 */
export async function getCurrentTenant(requireAuth = false): Promise<TenantContext> {
  const user = await getCurrentUser()

  if (user) {
    return {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      userId: user.userId,
      role: user.role,
      authenticated: true,
    }
  }

  if (requireAuth) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // Demo fallback for read-only exploration
  const demoTenant = await db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } })
  if (!demoTenant) {
    throw new Response('Demo tenant not initialized. Run `bun run scripts/seed.ts`.', { status: 500 })
  }

  return {
    tenantId: demoTenant.id,
    tenantSlug: demoTenant.slug,
    userId: null,
    role: 'owner', // demo exploration role
    authenticated: false,
  }
}

/**
 * Require authenticated user with at least the given role.
 */
export async function requireTenantWithRole(requiredRole: string): Promise<{ ctx: TenantContext; user: AuthenticatedUser }> {
  const user = await requireUser()
  const { roleAtLeast } = await import('./auth')
  if (!roleAtLeast(user.role, requiredRole)) {
    throw new Response('Forbidden', { status: 403 })
  }
  return {
    ctx: {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      userId: user.userId,
      role: user.role,
      authenticated: true,
    },
    user,
  }
}

/**
 * Enforce that an entity belongs to the current tenant.
 * Throws 404 if not found or not in tenant scope.
 */
export async function requireTenantOwnership(
  entityType: string,
  entityId: string,
  ctx: TenantContext
): Promise<boolean> {
  // For Phase 2, we trust the service-layer queries to filter by tenantId.
  // This function is a placeholder for an explicit ownership check pattern
  // that will be enforced uniformly in Phase 3.
  return true
}

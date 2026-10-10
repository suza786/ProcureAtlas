import { meterApiRequest } from './usage-meter'
// ProcureAtlas AI — Tenant/Session Service Layer
//
// Multi-tenancy enforcement: every tenant-scoped query passes through here.
// The tenant ALWAYS comes from the authenticated session — never from user input.
//
// DEMO MODE: for sandbox exploration only. Enabled explicitly via DEMO_MODE=true.
// When disabled (the production default), unauthenticated requests receive 401
// on every route, including reads.

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

/** Demo fallback is opt-in ONLY. Never enable in production. */
const DEMO_MODE = process.env.DEMO_MODE === 'true'

if (DEMO_MODE) {
  console.warn('[ProcureAtlas] WARNING: DEMO_MODE is enabled. Unauthenticated requests receive owner-level access to the demo tenant. Do NOT enable in production.')
}

/**
 * Get the current tenant context. Requires authentication by default.
 *
 * @param requireAuth - kept for backward compatibility. Authentication is ALWAYS
 *   required unless DEMO_MODE=true (sandbox only). Calls without a valid session
 *   throw 401 in production.
 */
export async function getCurrentTenant(_requireAuth = false): Promise<TenantContext> {
  const user = await getCurrentUser()

  if (user) {
    await meterApiRequest(user.tenantId, { userId: user.userId })
    return {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      userId: user.userId,
      role: user.role,
      authenticated: true,
    }
  }

  if (!DEMO_MODE) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // Sandbox-only demo fallback for read/explore flows.
  // Write flows should additionally check ctx.authenticated.
  const demoTenant = await db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } })
  if (!demoTenant) {
    throw new Response('Demo tenant not initialized. Run `bun run scripts/seed.ts`.', { status: 500 })
  }

  await meterApiRequest(demoTenant.id)
  return {
    tenantId: demoTenant.id,
    tenantSlug: demoTenant.slug,
    userId: null,
    role: 'owner', // demo exploration role — sandbox only
    authenticated: false,
  }
}

/**
 * Require an authenticated user with at least the given role.
 */
export async function requireTenantWithRole(requiredRole: string): Promise<{ ctx: TenantContext & { userId: string; authenticated: true }; user: AuthenticatedUser }> {
  const user = await requireUser()
  await meterApiRequest(user.tenantId, { userId: user.userId })
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
 * Require that the caller is authenticated (demo fallback is NOT sufficient).
 * Use this at the top of every mutating (POST/PUT/PATCH/DELETE) handler.
 */
export async function requireAuthenticatedTenant(): Promise<TenantContext> {
  const ctx = await getCurrentTenant()
  if (!ctx.authenticated) {
    throw new Response('Authentication required for this operation', { status: 401 })
  }
  return ctx
}

// ============================================================
// Tenant ownership enforcement
// ============================================================

/**
 * Prisma delegates for tenant-scoped models, keyed by the entityType strings
 * used in audit logs and API routes. Extend as new models are added.
 * Unknown entity types fail CLOSED (throw) — never silently pass.
 */
const TENANT_SCOPED_MODELS: Record<string, (tx: typeof db) => { findFirst: (args: unknown) => Promise<unknown> }> = {
  user: (tx) => tx.user as never,
  company: (tx) => tx.company as never,
  pursuit: (tx) => tx.pursuit as never,
  proposal: (tx) => tx.proposal as never,
  approval: (tx) => tx.approval as never,
  approval_chain: (tx) => tx.approvalChain as never,
  alert: (tx) => tx.alert as never,
  file_upload: (tx) => tx.fileUpload as never,
  llm_extraction: (tx) => tx.llmExtraction as never,
  api_key: (tx) => tx.apiKey as never,
  notification: (tx) => tx.notification as never,
  notification_preference: (tx) => tx.notificationPreference as never,
  partner_suggestion: (tx) => tx.partnerSuggestion as never,
  subscription: (tx) => tx.subscription as never,
  webhook_endpoint: (tx) => tx.webhookEndpoint as never,
  webhook_delivery: (tx) => tx.webhookDelivery as never,
  currency_rate: (tx) => tx.currencyRate as never,
  bid_cost_estimate: (tx) => tx.bidCostEstimate as never,
  data_export: (tx) => tx.dataExport as never,
  inbound_webhook: (tx) => tx.inboundWebhook as never,
  scim_config: (tx) => tx.scimConfig as never,
  pwa_settings: (tx) => tx.pwaSettings as never,
  analytics_snapshot: (tx) => tx.analyticsSnapshot as never,
}

/**
 * Enforce that an entity belongs to the current tenant.
 * Throws 404 if not found or not in tenant scope (404, not 403, to avoid
 * revealing cross-tenant entity existence).
 */
export async function requireTenantOwnership(
  entityType: string,
  entityId: string,
  ctx: TenantContext
): Promise<boolean> {
  const modelFactory = TENANT_SCOPED_MODELS[entityType]
  if (!modelFactory) {
    throw new Response(`Unknown entity type: ${entityType}`, { status: 500 })
  }
  const model = modelFactory(db)
  const found = await model.findFirst({
    where: { id: entityId, tenantId: ctx.tenantId },
    select: { id: true },
  })
  if (!found) {
    throw new Response('Not found', { status: 404 })
  }
  return true
}

import { meterApiRequest } from './usage-meter'
// ProcureAtlas AI — Phase 2 Authentication
// Session-cookie based auth with bcrypt password hashing, role-based access,
// account lockout, session revocation, and audit logging.
//
// Phase 2 design choice: We use a custom session-cookie auth (not NextAuth's full adapter)
// to keep multi-tenancy enforcement tight and avoid leaking tenant scope to NextAuth internals.
// NextAuth.js v4 is still available as a dependency for future SSO providers.

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { db } from './db'
import { bodySchemas } from './api-validation'
import { checkRateLimit } from './rate-limit'
import { decryptSecret, verifiedTotpStep } from './account-security'

const SESSION_COOKIE = 'procureatlas_session'
const SESSION_TTL_DAYS = 7
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000 // 12 hours idle
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export const ROLE_HIERARCHY: Record<string, string[]> = {
  owner: ['owner', 'admin', 'manager', 'contributor', 'viewer'],
  admin: ['admin', 'manager', 'contributor', 'viewer'],
  manager: ['manager', 'contributor', 'viewer'],
  contributor: ['contributor', 'viewer'],
  viewer: ['viewer'],
}

export function roleAtLeast(userRole: string, requiredRole: string): boolean {
  const allowed = Object.hasOwn(ROLE_HIERARCHY, userRole.toLowerCase()) ? ROLE_HIERARCHY[userRole.toLowerCase()] : []
  return allowed.includes(requiredRole.toLowerCase())
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function ipHash(ip: string | null): string | null {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export interface AuthenticatedUser {
  userId: string
  tenantId: string
  tenantSlug: string
  email: string
  name: string | null
  role: string
  mfaEnabled: boolean
}

/**
 * Get the current authenticated user from the session cookie.
 * Returns null if not authenticated or session expired/revoked.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashToken(token)
  const session = await db.session.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        include: { tenant: true },
      },
    },
  })

  if (!session) return null
  if (!session.user.active) return null
  if (session.user.mfaEnabled && !session.mfaVerifiedAt) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  // Idle timeout check — sliding window based on lastActivityAt (updated on use)
  const lastActivity = (session.lastActivityAt ?? session.createdAt).getTime()
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return null
  }

  // Stamp activity, throttled to at most one write per minute per session
  if (Date.now() - lastActivity > 60_000) {
    await db.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    })
  }

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    tenantSlug: session.user.tenant.slug,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    mfaEnabled: session.user.mfaEnabled,
  }
}

/**
 * Get the current user or throw a 401 error.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
  }
  return user
}

/**
 * Require the user to have at least the given role.
 */
export async function requireRole(requiredRole: string): Promise<AuthenticatedUser> {
  const user = await requireUser()
  if (!roleAtLeast(user.role, requiredRole)) {
    throw new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
  }
  return user
}

/**
 * Sign in a user with email + password. Returns the session token on success,
 * or null on failure (with audit logging).
 */
export async function signIn(
  email: string,
  password: string,
  request?: Request,
  otp?: string
): Promise<{ success: boolean; error?: string; lockedUntil?: Date; mfaRequired?: boolean }> {
  const credentials = bodySchemas.login.parse({ email, password })
  email = credentials.email; password = credentials.password
  const accountIdentity = hashToken(email)
  const ip = process.env.TRUST_PROXY_HEADERS === 'true' ? request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' : 'unknown'
  for (const [identity, bucket, limits] of [
    [accountIdentity, 'auth:account', { requestsPerHour: 20, burst: 5 }],
    [hashToken(ip), 'auth:ip', { requestsPerHour: 1000, burst: 50 }],
  ] as const) {
    const throttle = await checkRateLimit(identity, bucket, 'free', limits)
    if (!throttle.allowed) throw new Response('Too many login attempts', { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds ?? 60) } })
  }
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { tenant: true },
  })

  if (!user || !user.active) {
    // Always run a hash compare to avoid timing attacks revealing user existence
    await verifyPassword(password, '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')
    await logAuthEvent(null, null, 'login_failed', 'user_not_found', request)
    return { success: false, error: 'Invalid email or password.' }
  }

  // Lockout check
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAuthEvent(user.tenantId, user.id, 'login_failed', 'account_locked', request)
    return {
      success: false,
      error: 'Account temporarily locked due to failed attempts.',
      lockedUntil: user.lockedUntil,
    }
  }

  const valid = await verifyPassword(password, user.passwordHash ?? '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW') && Boolean(user.passwordHash)
  if (valid && user.mfaEnabled && !otp) return { success: false, mfaRequired: true }
  const mfaStep = valid && user.mfaEnabled && user.mfaSecret && otp ? verifiedTotpStep(decryptSecret(user.mfaSecret), otp) : null
  const mfaValid = !user.mfaEnabled || (mfaStep !== null && mfaStep > (user.mfaLastStep ?? -1))

  if (!valid || !mfaValid) {
    const newFailedCount = await db.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: user.id } })
      if (!current) throw new Response('Invalid email or password', { status: 401 })
      if (current.lockedUntil && current.lockedUntil > new Date()) return current.failedLoginCount
      if (current.lockedUntil) await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
      const failed = await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } } })
      if (failed.failedLoginCount >= MAX_FAILED_ATTEMPTS) await tx.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } })
      return failed.failedLoginCount
    })
    const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS
    await logAuthEvent(user.tenantId, user.id, 'login_failed', `bad_password_${newFailedCount}`, request)
    return {
      success: false,
      error: shouldLock
        ? 'Account locked due to too many failed attempts. Try again in 15 minutes.'
        : 'Invalid email or password.',
    }
  }

  // Recheck credentials and lock state, reset failures and create the session atomically.
  const token = generateToken()
  const tokenHash = hashToken(token)
  await db.$transaction(async tx => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || !current.active || current.passwordHash !== user.passwordHash || current.mfaEnabled !== user.mfaEnabled || current.mfaSecret !== user.mfaSecret || (current.lockedUntil && current.lockedUntil > new Date())) {
      throw new Response('Invalid email or password', { status: 401 })
    }
    if (current.mfaEnabled && (mfaStep === null || mfaStep <= (current.mfaLastStep ?? -1))) throw new Response('Authenticator code already used', { status: 401 })
  await tx.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(mfaStep !== null ? { mfaLastStep: mfaStep } : {}),
      lastLoginIp: ipHash(request?.headers.get('x-forwarded-for') ?? null),
    },
  })

  await tx.session.create({
    data: {
      userId: user.id,
      ...(mfaStep !== null ? { mfaVerifiedAt: new Date() } : {}),
      token: tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipHash: ipHash(request?.headers.get('x-forwarded-for') ?? null),
      userAgent: request?.headers.get('user-agent')?.slice(0, 255) ?? null,
    },
  })
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  await meterApiRequest(user.tenantId, { userId: user.id })
  await logAuthEvent(user.tenantId, user.id, 'login_success', 'credentials', request)
  return { success: true }
}

/**
 * Sign out the current user — revoke the active session.
 */
export async function signOut(request?: Request): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    const tokenHash = hashToken(token)
    const session = await db.session.findUnique({ where: { token: tokenHash }, include: { user: { select: { tenantId: true } } } })
    if (session) {
      await meterApiRequest(session.user.tenantId, { userId: session.userId })
      await db.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      })
      await logAuthEvent(session.user.tenantId, session.userId, 'logout', 'explicit', request)
    }
    cookieStore.delete(SESSION_COOKIE)
  }
}

async function logAuthEvent(
  tenantId: string | null,
  userId: string | null,
  action: string,
  detail: string,
  request?: Request
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tenantId: tenantId ?? 'unknown',
        userId,
        actorType: userId ? 'user' : 'system',
        action,
        entityType: 'auth',
        entityId: userId,
        ipHash: ipHash(request?.headers.get('x-forwarded-for') ?? null),
        userAgent: request?.headers.get('user-agent')?.slice(0, 255) ?? null,
        afterJson: JSON.stringify({ detail }),
      },
    })
  } catch (e) {
    // Audit logging failures should never break the request flow
    console.error('Audit log failed:', e)
  }
}

/**
 * Log a tenant action to the audit log (for non-auth actions).
 */
export async function logAction(params: {
  tenantId: string
  userId?: string | null
  apiKeyId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  beforeJson?: object | null
  afterJson?: object | null
  request?: Request
  llmModel?: string
  llmPromptHash?: string
  llmInputTokens?: number
  llmOutputTokens?: number
  llmLatencyMs?: number
  llmCostUsd?: number
  requestId?: string
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.apiKeyId ? null : params.userId ?? null,
        apiKeyId: params.apiKeyId ?? null,
        actorType: params.apiKeyId ? 'api_key' : params.userId ? 'user' : 'system',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        beforeJson: params.beforeJson ? JSON.stringify(params.beforeJson) : null,
        afterJson: params.afterJson ? JSON.stringify(params.afterJson) : null,
        ipHash: ipHash(params.request?.headers.get('x-forwarded-for') ?? null),
        userAgent: params.request?.headers.get('user-agent')?.slice(0, 255) ?? null,
        llmModel: params.llmModel,
        llmPromptHash: params.llmPromptHash,
        llmInputTokens: params.llmInputTokens,
        llmOutputTokens: params.llmOutputTokens,
        llmLatencyMs: params.llmLatencyMs,
        llmCostUsd: params.llmCostUsd,
        requestId: params.requestId,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

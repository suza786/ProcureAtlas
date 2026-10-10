import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiErrors } from '@/lib/api-errors'
import { requireUser, verifyPassword, hashToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { decryptSecret, encryptSecret, generateTotpSecret, verifiedTotpStep } from '@/lib/account-security'
import { readWebhookBody } from '@/lib/inbound-webhook'
import { checkRateLimit } from '@/lib/rate-limit'
const input = z.object({ action: z.enum(['setup', 'enable', 'disable']), password: z.string().min(1).max(72), code: z.string().regex(/^\d{6}$/).optional() }).strict()
export const POST = withApiErrors(async function POST(req: Request) {
  const actor = await requireUser()
  const throttle = await checkRateLimit(actor.userId, 'mfa:management', 'free', { requestsPerHour: 20, burst: 5 })
  if (!throttle.allowed) throw new Response('Too many MFA attempts', { status: 429 })
  const body = input.parse(JSON.parse(await readWebhookBody(req, 4096)))
  const current = await db.user.findUniqueOrThrow({ where: { id: actor.userId } })
  if (!current.passwordHash || !await verifyPassword(body.password, current.passwordHash)) throw new Response('Invalid password', { status: 401 })
  if (body.action === 'setup') {
    if (current.mfaEnabled) throw new Response('MFA is already enabled', { status: 409 })
    const secret = generateTotpSecret()
    await db.$transaction(async tx => {
      await tx.accountToken.deleteMany({ where: { userId: current.id, kind: 'mfa_setup' } })
      await tx.accountToken.create({ data: { userId: current.id, tenantId: current.tenantId, kind: 'mfa_setup', tokenHash: hashToken(secret), credentialHash: encryptSecret(secret), expiresAt: new Date(Date.now() + 10 * 60000) } })
    })
    return NextResponse.json({ secret, uri: `otpauth://totp/ProcureAtlas:${encodeURIComponent(current.email)}?secret=${secret}&issuer=ProcureAtlas`, expiresInSeconds: 600 })
  }
  await db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: current.id } })
    if (!user.active || user.passwordHash !== current.passwordHash) throw new Response('Credentials changed; sign in again', { status: 409 })
    const pending = body.action === 'enable' ? await tx.accountToken.findFirst({ where: { userId: user.id, kind: 'mfa_setup', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }) : null
    const secret = body.action === 'enable' ? pending?.credentialHash : user.mfaSecret
    const step = secret && body.code ? verifiedTotpStep(decryptSecret(secret), body.code) : null
    if (step === null || (body.action === 'disable' && step <= (user.mfaLastStep ?? -1))) throw new Response('Invalid authenticator code', { status: 401 })
    if (body.action === 'enable' && user.mfaEnabled) throw new Response('MFA already enabled', { status: 409 })
    if (pending) {
      const claimed = await tx.accountToken.updateMany({ where: { id: pending.id, usedAt: null }, data: { usedAt: new Date() } })
      if (claimed.count !== 1) throw new Response('MFA setup already used', { status: 409 })
    }
    await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: body.action === 'enable', mfaSecret: body.action === 'enable' ? secret : null, mfaLastStep: step } })
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.apiKey.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, actorType: 'user', action: body.action === 'enable' ? 'mfa_enabled' : 'mfa_disabled', entityType: 'user', entityId: user.id } })
  })
  return NextResponse.json({ success: true, signInRequired: true })
})

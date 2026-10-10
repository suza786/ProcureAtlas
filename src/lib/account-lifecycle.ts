import { randomBytes, createHash } from 'node:crypto'
import type { OutboxJob, Prisma } from '@prisma/client'
import { db } from './db'
import { encryptSecret, decryptSecret } from './account-security'
import { enqueueOutbox, JobFailure, parseRetryAfter } from './outbox'
import { assertSeatQuota } from './usage-meter'
import bcrypt from 'bcryptjs'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function accountDeliveryConfigured() {
  const origin = process.env.APP_ORIGIN
  if (!origin || new URL(origin).protocol !== 'https:' || !process.env.RESEND_API_KEY || !process.env.ACCOUNT_EMAIL_FROM) throw new Response('Account email delivery is not configured', { status: 503 })
  encryptSecret('configuration check')
  return origin
}
export async function issueAccountToken(tx: Prisma.TransactionClient, user: { id: string; tenantId: string; email: string }, kind: 'invite' | 'recovery') {
  const origin = accountDeliveryConfigured()
  const token = randomBytes(32).toString('hex')
  await tx.accountToken.updateMany({ where: { userId: user.id, kind, usedAt: null }, data: { usedAt: new Date() } })
  await tx.accountToken.create({ data: { userId: user.id, tenantId: user.tenantId, kind, tokenHash: hash(token), expiresAt: new Date(Date.now() + (kind === 'invite' ? 48 * 3600000 : 15 * 60000)) } })
  const payload = { to: user.email, subject: kind === 'invite' ? 'Your ProcureAtlas invitation' : 'Reset your ProcureAtlas password', text: `Open ${origin.replace(/\/$/, '')}/?accountToken=${token} to choose your password. This link expires and can be used once.` }
  await enqueueOutbox(tx, user.tenantId, 'email.send', { encrypted: encryptSecret(JSON.stringify(payload)) })
}
export async function requestRecovery(email: string) {
  accountDeliveryConfigured()
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email } })
    if (user?.active) await issueAccountToken(tx, user, 'recovery')
  })
}
export async function inviteUser(tenantId: string, email: string, name: string | undefined, role: string) {
  accountDeliveryConfigured()
  return db.$transaction(async tx => {
    await assertSeatQuota(tx, tenantId)
    const user = await tx.user.create({ data: { tenantId, email, name, role, active: true, passwordHash: null }, select: { id: true, tenantId: true, email: true } })
    await issueAccountToken(tx, user, 'invite')
    return { id: user.id, email: user.email }
  })
}
export async function redeemAccountToken(token: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12)
  return db.$transaction(async tx => {
    const credential = await tx.accountToken.findUnique({ where: { tokenHash: hash(token) } })
    if (!credential || !['invite', 'recovery'].includes(credential.kind) || credential.usedAt || credential.expiresAt <= new Date()) throw new Response('Invalid or expired account link', { status: 400 })
    const user = await tx.user.findFirst({ where: { id: credential.userId, tenantId: credential.tenantId, active: true } })
    if (!user) throw new Response('Invalid or expired account link', { status: 400 })
    const claim = await tx.accountToken.updateMany({ where: { id: credential.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })
    if (claim.count !== 1) throw new Response('Account link already used', { status: 409 })
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } })
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.apiKey.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.accountToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } })
    await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, actorType: 'user', action: 'password_recovered', entityType: 'user', entityId: user.id } })
  })
}
export async function dispatchAccountEmail(job: OutboxJob) {
  accountDeliveryConfigured()
  const envelope = JSON.parse(job.payloadJson) as { encrypted: string }
  const email = JSON.parse(decryptSecret(envelope.encrypted)) as { to: string; subject: string; text: string }
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id }, body: JSON.stringify({ from: process.env.ACCOUNT_EMAIL_FROM, ...email }), signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new JobFailure(`Account email delivery failed (${response.status})`, response.status < 500 && ![408, 429].includes(response.status), parseRetryAfter(response.headers.get('retry-after') ?? undefined))
}

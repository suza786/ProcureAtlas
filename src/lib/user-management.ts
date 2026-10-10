import { db } from './db'
import bcrypt from 'bcryptjs'
import { roleAtLeast } from './auth'

export async function manageTenantUser(actor: { tenantId: string; userId: string; role: string }, id: string,
  input: { role?: string; resetPassword?: string; unlockAccount?: boolean }, client = db) {
  const passwordHash = input.resetPassword ? await bcrypt.hash(input.resetPassword, 12) : undefined
  return client.$transaction(async tx => {
    const currentActor = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId }, select: { role: true } })
    if (!currentActor || !roleAtLeast(currentActor.role, 'admin')) throw new Response('Forbidden', { status: 403 })
    const target = await tx.user.findFirst({ where: { id, tenantId: actor.tenantId } })
    if (!target) throw new Response('User not found', { status: 404 })
    if (currentActor.role !== 'owner' && (target.role === 'owner' || input.role === 'owner')) throw new Response('Owner role required to manage owners', { status: 403 })
    if (target.role === 'owner' && input.role && input.role !== 'owner') {
      const owners = await tx.user.count({ where: { tenantId: actor.tenantId, role: 'owner' } })
      if (owners <= 1) throw new Response('At least one owner must remain', { status: 409 })
    }
    const credentialsChanged = Boolean(passwordHash || (input.role && input.role !== target.role))
    const updated = await tx.user.update({
      where: { id, tenantId: actor.tenantId },
      data: { ...(input.role ? { role: input.role } : {}), ...(passwordHash ? { passwordHash } : {}),
        ...(passwordHash || input.unlockAccount ? { failedLoginCount: 0, lockedUntil: null } : {}) },
      select: { id: true, email: true, name: true, role: true, mfaEnabled: true },
    })
    if (credentialsChanged) {
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
      await tx.apiKey.updateMany({ where: { tenantId: actor.tenantId, userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    }
    return updated
  })
}

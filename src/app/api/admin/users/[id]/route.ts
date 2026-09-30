import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// PATCH /api/admin/users/[id] — update user role or reset password (admin+ only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { ctx, user } = await requireTenantWithRole('admin')

  // Verify user belongs to tenant
  const targetUser = await db.user.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await req.json()
  const { role, resetPassword, unlockAccount } = body as {
    role?: string
    resetPassword?: string
    unlockAccount?: boolean
  }

  const updates: Record<string, unknown> = {}

  if (role && ['owner', 'admin', 'manager', 'contributor', 'viewer'].includes(role)) {
    // Prevent self-demotion for owners
    if (targetUser.role === 'owner' && user.userId === targetUser.id && role !== 'owner') {
      return NextResponse.json({ error: 'Cannot demote yourself from owner' }, { status: 400 })
    }
    updates.role = role
  }

  if (resetPassword) {
    updates.passwordHash = await bcrypt.hash(resetPassword, 12)
    updates.failedLoginCount = 0
    updates.lockedUntil = null
  }

  if (unlockAccount) {
    updates.failedLoginCount = 0
    updates.lockedUntil = null
  }

  const updated = await db.user.update({
    where: { id },
    data: updates,
    select: { id: true, email: true, name: true, role: true, mfaEnabled: true },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'user_updated',
    entityType: 'user',
    entityId: id,
    afterJson: { role: updates.role, passwordReset: !!resetPassword, accountUnlocked: !!unlockAccount },
    request: req,
  })

  return NextResponse.json(updated)
}

// DELETE /api/admin/users/[id] — deactivate user (admin+ only; cannot delete self)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { ctx, user } = await requireTenantWithRole('admin')

  if (user.userId === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const targetUser = await db.user.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (targetUser.role === 'owner') {
    return NextResponse.json({ error: 'Cannot delete owner account' }, { status: 400 })
  }

  // Revoke all sessions
  await db.session.updateMany({
    where: { userId: id },
    data: { revokedAt: new Date() },
  })

  await db.user.delete({ where: { id } })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'user_deleted',
    entityType: 'user',
    entityId: id,
    afterJson: { email: targetUser.email },
    request: req,
  })

  return NextResponse.json({ success: true })
}

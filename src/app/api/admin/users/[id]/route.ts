import { readJson, parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantWithRole } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import { manageTenantUser } from '@/lib/user-management'

// PATCH /api/admin/users/[id] — update user role or reset password (admin+ only)
export const PATCH = withApiErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx, user } = await requireTenantWithRole('admin')

  const body = await readJson(req, 'adminUser')
  const { role, resetPassword, unlockAccount } = body
  const updated = await manageTenantUser(ctx, id, body)

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'user_updated',
    entityType: 'user',
    entityId: id,
    afterJson: { role, passwordReset: !!resetPassword, accountUnlocked: !!unlockAccount },
    request: req,
  })

  return NextResponse.json(updated)
})

// DELETE /api/admin/users/[id] — deactivate user (admin+ only; cannot delete self)
export const DELETE = withApiErrors(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
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

  await db.$transaction(async tx => {
    await tx.apiKey.updateMany({ where: { tenantId: ctx.tenantId, userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.session.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } })
    await tx.user.delete({ where: { id, tenantId: ctx.tenantId, role: { not: 'owner' } } })
  })

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
})

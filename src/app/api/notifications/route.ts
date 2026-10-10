import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { readJson, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/notifications — list notifications for the current tenant/user
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const unreadOnly = searchParams.get('unread') === 'true'
  const { limit, offset } = pagination(searchParams, 20, 100)

  const where: Prisma.NotificationWhereInput = { tenantId: ctx.tenantId }
  if (unreadOnly) where.readAt = null
  if (ctx.userId) {
    where.OR = [
      { userId: ctx.userId },
      { userId: null }, // broadcast notifications
    ]
  }

  const items = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit, skip: offset,
  })

  return NextResponse.json({ items })
})

// PATCH /api/notifications/[id] — mark as read
export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('viewer')
  const body = await readJson(req, 'notification')
  const { id, all } = body

  if (all) {
    await db.notification.updateMany({
      where: { tenantId: ctx.tenantId, readAt: null, OR: [{ userId: ctx.userId }, { userId: null }] },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ success: true, markedAllRead: true })
  }

  if (!id) {
    return NextResponse.json({ error: 'id or all=true required' }, { status: 400 })
  }

  await db.notification.updateMany({
    where: { id, tenantId: ctx.tenantId, OR: [{ userId: ctx.userId }, { userId: null }] },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ success: true })
})

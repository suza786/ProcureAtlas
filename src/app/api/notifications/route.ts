import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/notifications — list notifications for the current tenant/user
export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  const where: Record<string, unknown> = { tenantId: ctx.tenantId }
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
    take: limit,
  })

  return NextResponse.json({ items })
}

// PATCH /api/notifications/[id] — mark as read
export async function PATCH(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { id, all } = body as { id?: string; all?: boolean }

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
    where: { id, tenantId: ctx.tenantId },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

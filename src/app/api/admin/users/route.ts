import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant, requireTenantWithRole } from '@/lib/tenant'

// GET /api/admin/users — list users in the current tenant (manager+ only)
export async function GET() {
  const { ctx } = await requireTenantWithRole('manager')

  const users = await db.user.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    items: users.map(u => ({
      ...u,
      isLocked: u.lockedUntil ? u.lockedUntil > new Date() : false,
    })),
  })
}

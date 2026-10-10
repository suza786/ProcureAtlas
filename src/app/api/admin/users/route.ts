import { pagination, validatedSearch } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantWithRole } from '@/lib/tenant'

// GET /api/admin/users — list users in the current tenant (manager+ only)
export const GET = withApiErrors(async function GET(req: Request) {
  const { limit, offset } = pagination(validatedSearch(req))
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
    take: limit, skip: offset,
  })

  return NextResponse.json({
    items: users.map(u => ({
      ...u,
      isLocked: u.lockedUntil ? u.lockedUntil > new Date() : false,
    })),
  })
})

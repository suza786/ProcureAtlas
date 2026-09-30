import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/alerts — active alerts for the current tenant
export async function GET() {
  const ctx = await getCurrentTenant()
  if (!ctx.tenantId) return NextResponse.json({ items: [] })

  const alerts = await db.alert.findMany({
    where: { tenantId: ctx.tenantId, acknowledgedAt: null },
    include: { tender: { select: { id: true, title: true, submissionDeadline: true } } },
    orderBy: [
      { severity: 'desc' },
      { dueAt: 'asc' },
    ],
    take: 50,
  })

  return NextResponse.json({
    items: alerts.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      tender: a.tender,
    })),
  })
}

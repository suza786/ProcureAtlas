import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/alerts — active alerts for the demo tenant
export async function GET() {
  const tenant = await db.tenant.findUnique({ where: { slug: 'atlas-demo' } })
  if (!tenant) return NextResponse.json({ items: [] })

  const alerts = await db.alert.findMany({
    where: { tenantId: tenant.id, acknowledgedAt: null },
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

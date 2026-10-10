import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/notifications/preferences — list notification preferences for the current user
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  if (!ctx.userId) {
    return NextResponse.json({ items: [] })
  }

  const prefs = await db.notificationPreference.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
  })

  // Build a complete matrix of channel × eventType
  const channels = ['in_app', 'email', 'slack', 'teams']
  const eventTypes = ['alert', 'deadline', 'amendment', 'extraction_ready', 'approval_request', 'system', 'webhook_delivery']
  const matrix: Array<{ channel: string; eventType: string; enabled: boolean; minSeverity: string }> = []
  for (const channel of channels) {
    for (const eventType of eventTypes) {
      const pref = prefs.find(p => p.channel === channel && p.eventType === eventType)
      matrix.push({
        channel,
        eventType,
        enabled: pref?.enabled ?? true,
        minSeverity: pref?.minSeverity ?? 'low',
      })
    }
  }

  return NextResponse.json({ items: matrix })
})

// PATCH /api/notifications/preferences — update preferences
export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('viewer')
  if (!ctx.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await readJson(req, 'preferences')
  const { preferences } = body

  for (const pref of preferences) {
    await db.notificationPreference.upsert({
      where: {
        tenantId_userId_channel_eventType: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          channel: pref.channel,
          eventType: pref.eventType,
        },
      },
      update: {
        enabled: pref.enabled,
        minSeverity: pref.minSeverity ?? 'low',
      },
      create: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        channel: pref.channel,
        eventType: pref.eventType,
        enabled: pref.enabled,
        minSeverity: pref.minSeverity ?? 'low',
      },
    })
  }

  return NextResponse.json({ success: true })
})

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/pwa/manifest — PWA manifest.json for the current tenant
export async function GET() {
  const ctx = await getCurrentTenant()

  let pwaSettings = await db.pwaSettings.findUnique({ where: { tenantId: ctx.tenantId } })
  if (!pwaSettings) {
    pwaSettings = await db.pwaSettings.create({
      data: {
        tenantId: ctx.tenantId,
        appName: 'ProcureAtlas AI',
        shortName: 'ProcureAtlas',
        themeColor: '#0f172a',
        backgroundColor: '#f8fafc',
        displayMode: 'standalone',
        offlineEnabled: true,
      },
    })
  }

  return NextResponse.json({
    name: pwaSettings.appName,
    short_name: pwaSettings.shortName,
    description: 'Global Tender Intelligence & Bid Operations Platform',
    start_url: '/',
    display: pwaSettings.displayMode,
    background_color: pwaSettings.backgroundColor,
    theme_color: pwaSettings.themeColor,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
    categories: ['business', 'productivity', 'finance'],
    lang: 'en',
    dir: 'ltr',
  })
}

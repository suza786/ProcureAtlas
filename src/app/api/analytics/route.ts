import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { getCurrentTenant } from '@/lib/tenant'
import { tenantAnalytics } from '@/lib/analytics-history'

export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  return NextResponse.json(await tenantAnalytics(ctx.tenantId))
})

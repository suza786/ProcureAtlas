import { withApiErrors } from '@/lib/api-errors'
import { getCurrentTenant } from '@/lib/tenant'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/markets — list all market configs
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  const markets = await db.marketConfig.findMany({
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ items: markets })
})

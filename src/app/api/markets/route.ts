import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/markets — list all market configs
export async function GET() {
  const markets = await db.marketConfig.findMany({
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ items: markets })
}

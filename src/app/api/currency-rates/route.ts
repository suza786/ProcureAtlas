import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/currency-rates — list currency rates for the tenant
export async function GET() {
  const ctx = await getCurrentTenant()
  const rates = await db.currencyRate.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { quoteCurrency: 'asc' },
  })
  return NextResponse.json({ items: rates })
}

// POST /api/currency-rates — create or update a currency rate
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { baseCurrency, quoteCurrency, rate, source } = body as {
    baseCurrency: string
    quoteCurrency: string
    rate: number
    source?: string
  }

  if (!baseCurrency || !quoteCurrency || !rate) {
    return NextResponse.json({ error: 'baseCurrency, quoteCurrency, and rate required' }, { status: 400 })
  }

  const existing = await db.currencyRate.findUnique({
    where: {
      tenantId_baseCurrency_quoteCurrency: {
        tenantId: ctx.tenantId,
        baseCurrency,
        quoteCurrency,
      },
    },
  })

  if (existing) {
    const updated = await db.currencyRate.update({
      where: { id: existing.id },
      data: { rate, source: source ?? 'manual', rateDate: new Date() },
    })
    return NextResponse.json(updated)
  }

  const created = await db.currencyRate.create({
    data: {
      tenantId: ctx.tenantId,
      baseCurrency,
      quoteCurrency,
      rate,
      source: source ?? 'manual',
      rateDate: new Date(),
    },
  })

  return NextResponse.json(created, { status: 201 })
}

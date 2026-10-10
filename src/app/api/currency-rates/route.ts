import { readJson } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/currency-rates — list currency rates for the tenant
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  const rates = await db.currencyRate.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ rateDate: 'desc' }, { quoteCurrency: 'asc' }],
  })
  return NextResponse.json({ items: rates })
})

// POST /api/currency-rates — create or update a currency rate
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('manager')
  const body = await readJson(req, 'currencyRate')
  const { baseCurrency, quoteCurrency, rate, source } = body
  const rateDate = new Date(`${body.rateDate}T00:00:00.000Z`)

  if (!baseCurrency || !quoteCurrency || !rate) {
    return NextResponse.json({ error: 'baseCurrency, quoteCurrency, and rate required' }, { status: 400 })
  }

  const existing = await db.currencyRate.findUnique({
    where: {
      tenantId_baseCurrency_quoteCurrency_rateDate: {
        tenantId: ctx.tenantId,
        baseCurrency,
        quoteCurrency,
        rateDate,
      },
    },
  })

  if (existing) {
    const updated = await db.currencyRate.update({
      where: { id: existing.id },
      data: { rate, source: source ?? 'manual' },
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
      rateDate,
    },
  })

  return NextResponse.json(created, { status: 201 })
})

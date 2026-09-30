import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { cptuBdConnector, runConnector } from '@/lib/connectors/cptu_bd'
import { logAction } from '@/lib/auth'

// GET /api/connectors — list connector status + recent runs
export async function GET() {
  const ctx = await getCurrentTenant()

  const connectors = [
    {
      code: cptuBdConnector.code,
      name: cptuBdConnector.name,
      country: cptuBdConnector.country,
      url: cptuBdConnector.url,
      legalStatus: cptuBdConnector.legalStatus,
      isLiveEnabled: cptuBdConnector.isLiveEnabled,
      description: 'Bangladesh Central Procurement Technical Unit eTender portal. Public notices accessible without login. Live fetching requires legal sign-off.',
    },
    {
      code: 'gebiz_sg',
      name: 'Singapore GeBIZ',
      country: 'SG',
      url: 'https://www.gebiz.gov.sg/',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'Singapore government e-procurement portal. Public business opportunities feed.',
    },
    {
      code: 'worldbank',
      name: 'World Bank Procurement',
      country: 'GLOBAL',
      url: 'https://projects.worldbank.org/en/projects-operations/procurement',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'World Bank corporate procurement + project-related procurement notices.',
    },
    {
      code: 'adb',
      name: 'Asian Development Bank',
      country: 'GLOBAL',
      url: 'https://uxdm.adb.org/',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'ADB procurement notices via UXDM data exchange.',
    },
    {
      code: 'ungm',
      name: 'UN Global Marketplace',
      country: 'GLOBAL',
      url: 'https://www.ungm.org/',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'United Nations Global Marketplace public tenders.',
    },
    {
      code: 'ted',
      name: 'EU TED',
      country: 'EU',
      url: 'https://ted.europa.eu/',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'EU Tenders Electronic Daily — official TED API + daily XML supplement.',
    },
    {
      code: 'sam_gov',
      name: 'U.S. SAM.gov',
      country: 'US',
      url: 'https://sam.gov/',
      legalStatus: 'verified',
      isLiveEnabled: false,
      description: 'U.S. federal contract opportunities. Public API requires free API key.',
    },
  ]

  // Fetch recent runs for each connector
  const runs = await db.connectorRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
  })

  const runsBySource = runs.reduce((acc, r) => {
    if (!acc[r.sourceCode]) acc[r.sourceCode] = []
    acc[r.sourceCode].push({
      id: r.id,
      runType: r.runType,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      itemsFetched: r.itemsFetched,
      itemsCreated: r.itemsCreated,
      itemsUpdated: r.itemsUpdated,
      itemsSkipped: r.itemsSkipped,
      errorMessage: r.errorMessage,
    })
    return acc
  }, {} as Record<string, unknown[]>)

  return NextResponse.json({
    connectors: connectors.map((c) => ({
      ...c,
      recentRuns: runsBySource[c.code] ?? [],
    })),
  })
}

// POST /api/connectors — trigger a connector run manually
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { sourceCode, runType, limit } = body as {
    sourceCode: string
    runType?: 'scheduled' | 'manual' | 'backfill'
    limit?: number
  }

  if (!sourceCode) {
    return NextResponse.json({ error: 'sourceCode required' }, { status: 400 })
  }

  // For Phase 2, only CPTU connector is implemented
  if (sourceCode !== 'cptu_bd') {
    return NextResponse.json({
      error: `Connector ${sourceCode} not yet implemented. Available: cptu_bd (skeleton, mock data only).`,
    }, { status: 400 })
  }

  const result = await runConnector(cptuBdConnector, {
    runType: runType ?? 'manual',
    triggeredById: ctx.userId,
    tenantId: ctx.tenantId,
    limit,
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'connector_triggered',
    entityType: 'connector',
    entityId: sourceCode,
    afterJson: result,
    request: req,
  })

  return NextResponse.json({
    success: true,
    ...result,
    note: cptuBdConnector.isLiveEnabled
      ? 'Live fetch completed.'
      : 'Connector live fetching is DISABLED. Returned mock data only. Enable live fetching only after legal sign-off per DATA_SOURCE_LEGAL_REGISTER.md.',
  })
}

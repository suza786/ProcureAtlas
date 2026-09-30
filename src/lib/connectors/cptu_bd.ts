// ProcureAtlas AI — Bangladesh CPTU Connector Skeleton (Phase 2)
//
// STATUS: SKELETON ONLY — DO NOT ENABLE LIVE FETCHING WITHOUT LEGAL SIGN-OFF.
//
// Per /docs/DATA_SOURCE_LEGAL_REGISTER.md:
//   - Source: Bangladesh CPTU eTender (https://www.eprocure.gov.bd/)
//   - Legal status: verified (public notices accessible without login)
//   - Permitted method: public feed / open data (when available)
//   - Prohibited: CAPTCHA bypass, auth bypass, scraping private pages, breaking ToS
//
// This module defines the connector interface and a deterministic mock fetcher
// that returns normalized Tender payloads. The mock fetcher is the ONLY thing
// wired in Phase 2. Live fetching requires:
//   1. Legal sign-off on DATA_SOURCE_LEGAL_REGISTER.md
//   2. Confirmation that CPTU publishes an official API or permitted feed
//   3. Rate-limit-compliant client implementation
//   4. ConnectorRun audit logging on every fetch

import { db } from '@/lib/db'
import { logAction } from '@/lib/auth'

export interface NormalizedTender {
  externalId: string
  sourcePortal: string
  sourceUrl: string
  title: string
  titleLocal?: string
  description?: string
  country: string
  market: string
  sector: string
  procurementMethod?: string
  noticeType?: string
  currency: string
  estimatedValue?: number
  valueUSD?: number
  publishedAt?: Date
  submissionDeadline?: Date
  questionDeadline?: Date
  status: string
  buyerName?: string
  buyerExternalId?: string
  buyerCountry?: string
  buyerWebsite?: string
  contactPerson?: string
  contactEmail?: string
}

export interface ConnectorFetchResult {
  source: string
  itemsFetched: number
  itemsCreated: number
  itemsUpdated: number
  itemsSkipped: number
  errors: string[]
  durationMs: number
}

export interface Connector {
  code: string
  name: string
  country: string
  url: string
  legalStatus: 'verified' | 'under_review' | 'prohibited'
  isLiveEnabled: boolean
  fetch(limit?: number): Promise<NormalizedTender[]>
  normalize(raw: unknown): NormalizedTender | null
}

// ============================================================
// CPTU Bangladesh connector (skeleton)
// ============================================================

export const cptuBdConnector: Connector = {
  code: 'cptu_bd',
  name: 'Bangladesh CPTU eTender',
  country: 'BD',
  url: 'https://www.eprocure.gov.bd/',
  legalStatus: 'verified',
  isLiveEnabled: false, // ⚠️ Set to true ONLY after legal sign-off

  async fetch(limit = 50): Promise<NormalizedTender[]> {
    if (!this.isLiveEnabled) {
      // Mock fetch — returns deterministic sample data
      // In production, this would call the official CPTU API or permitted feed
      return mockCptuFetch(limit)
    }

    // LIVE FETCH (not yet implemented — requires legal sign-off)
    // 1. Fetch from https://www.eprocure.gov.bd/ (official endpoint TBD)
    // 2. Respect rate limits (max 1 req/sec)
    // 3. Parse HTML or JSON response
    // 4. Normalize each item via this.normalize()
    // 5. Return array of NormalizedTender
    throw new Error('CPTU live fetching not yet enabled — requires legal sign-off per DATA_SOURCE_LEGAL_REGISTER.md')
  },

  normalize(raw: unknown): NormalizedTender | null {
    // Placeholder — would parse CPTU's HTML/XML structure
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    return {
      externalId: String(r.id ?? ''),
      sourcePortal: 'cptu_bd',
      sourceUrl: String(r.url ?? 'https://www.eprocure.gov.bd/'),
      title: String(r.title ?? ''),
      titleLocal: r.title_bn ? String(r.title_bn) : undefined,
      description: r.description ? String(r.description) : undefined,
      country: 'BD',
      market: 'BD',
      sector: String(r.sector ?? 'IT'),
      procurementMethod: r.method ? String(r.method) : 'open',
      noticeType: r.notice_type ? String(r.notice_type) : 'tender',
      currency: 'BDT',
      estimatedValue: r.value ? Number(r.value) : undefined,
      valueUSD: r.value ? Number(r.value) / 110 : undefined,
      publishedAt: r.published ? new Date(String(r.published)) : undefined,
      submissionDeadline: r.deadline ? new Date(String(r.deadline)) : undefined,
      status: 'active',
      buyerName: r.buyer ? String(r.buyer) : undefined,
      buyerExternalId: r.buyer_id ? String(r.buyer_id) : undefined,
      buyerCountry: 'BD',
      contactPerson: r.contact ? String(r.contact) : undefined,
      contactEmail: r.email ? String(r.email) : undefined,
    }
  },
}

// ============================================================
// Mock fetcher (deterministic sample data)
// ============================================================

function mockCptuFetch(limit: number): NormalizedTender[] {
  const NOW = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const samples: NormalizedTender[] = [
    {
      externalId: `MOCK-CPTU-${NOW}-001`,
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/mock-001',
      title: '[MOCK] Supply of Network Equipment for Bangladesh Railway',
      description: 'Mock tender — generated by cptuBdConnector skeleton. Replace with live data after legal sign-off.',
      country: 'BD', market: 'BD', sector: 'IT',
      procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 65000000, valueUSD: 590000,
      publishedAt: new Date(NOW - 2 * DAY),
      submissionDeadline: new Date(NOW + 25 * DAY),
      status: 'active',
      buyerName: 'Bangladesh Railway',
      buyerExternalId: 'BR-001', buyerCountry: 'BD',
      contactPerson: 'BR Procurement Cell',
    },
    {
      externalId: `MOCK-CPTU-${NOW}-002`,
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/mock-002',
      title: '[MOCK] Cybersecurity Audit for Bangladesh Bank',
      description: 'Mock tender — generated by cptuBdConnector skeleton.',
      country: 'BD', market: 'BD', sector: 'Cyber',
      procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 18000000, valueUSD: 163000,
      publishedAt: new Date(NOW - 1 * DAY),
      submissionDeadline: new Date(NOW + 18 * DAY),
      status: 'active',
      buyerName: 'Bangladesh Bank',
      buyerExternalId: 'BB-001', buyerCountry: 'BD',
      contactPerson: 'BB IT Procurement',
    },
    {
      externalId: `MOCK-CPTU-${NOW}-003`,
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/mock-003',
      title: '[MOCK] Data Center Cooling System for BCC',
      description: 'Mock tender — generated by cptuBdConnector skeleton.',
      country: 'BD', market: 'BD', sector: 'Engineering',
      procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 42000000, valueUSD: 381000,
      publishedAt: new Date(NOW - 3 * DAY),
      submissionDeadline: new Date(NOW + 30 * DAY),
      status: 'active',
      buyerName: 'Bangladesh Computer Council',
      buyerExternalId: 'BCC-001', buyerCountry: 'BD',
      contactPerson: 'BCC Facilities',
    },
  ]
  return samples.slice(0, limit)
}

// ============================================================
// Connector runner — ingests normalized tenders into the DB
// ============================================================

export async function runConnector(
  connector: Connector,
  options: { runType?: 'scheduled' | 'manual' | 'backfill'; triggeredById?: string; tenantId: string } & { limit?: number }
): Promise<ConnectorFetchResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let itemsFetched = 0
  let itemsCreated = 0
  let itemsUpdated = 0
  let itemsSkipped = 0

  // Create a ConnectorRun record
  const run = await db.connectorRun.create({
    data: {
      sourceCode: connector.code,
      runType: options.runType ?? 'manual',
      status: 'running',
      triggeredById: options.triggeredById ?? null,
    },
  })

  try {
    const items = await connector.fetch(options.limit ?? 50)
    itemsFetched = items.length

    for (const item of items) {
      try {
        // Check if tender already exists (by source portal + external ID)
        const existing = await db.tender.findUnique({
          where: {
            sourcePortal_externalId: {
              sourcePortal: item.sourcePortal,
              externalId: item.externalId,
            },
          },
        })

        if (existing) {
          // Update if changed (simplified — would diff in production)
          await db.tender.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              description: item.description,
              submissionDeadline: item.submissionDeadline,
              status: item.status,
            },
          })
          itemsUpdated++
        } else {
          // Resolve or create buyer organization
          let buyerId: string | undefined
          if (item.buyerName) {
            const buyerOrg = await db.organization.upsert({
              where: {
                sourcePortal_externalId: {
                  sourcePortal: item.sourcePortal,
                  externalId: item.buyerExternalId ?? item.buyerName,
                },
              },
              update: { name: item.buyerName },
              create: {
                sourcePortal: item.sourcePortal,
                externalId: item.buyerExternalId ?? item.buyerName,
                name: item.buyerName,
                country: item.buyerCountry ?? item.country,
                orgType: 'buyer',
              },
            })
            // Find or create buyer record (organizationId is not unique, so use findFirst)
            let buyer = await db.buyer.findFirst({ where: { organizationId: buyerOrg.id } })
            if (!buyer) {
              buyer = await db.buyer.create({ data: { organizationId: buyerOrg.id } })
            }
            buyerId = buyer.id
          }

          await db.tender.create({
            data: {
              externalId: item.externalId,
              sourcePortal: item.sourcePortal,
              sourceUrl: item.sourceUrl,
              title: item.title,
              titleLocal: item.titleLocal,
              description: item.description,
              country: item.country,
              market: item.market,
              sector: item.sector,
              procurementMethod: item.procurementMethod ?? 'open',
              noticeType: item.noticeType ?? 'tender',
              currency: item.currency,
              estimatedValue: item.estimatedValue,
              valueUSD: item.valueUSD,
              publishedAt: item.publishedAt,
              submissionDeadline: item.submissionDeadline,
              questionDeadline: item.questionDeadline,
              status: item.status,
              contactPerson: item.contactPerson,
              contactEmail: item.contactEmail,
              buyerId: buyerId,
              confidence: 0.9,
            },
          })
          itemsCreated++
        }
      } catch (e) {
        errors.push(`Item ${item.externalId}: ${(e as Error).message}`)
        itemsSkipped++
      }
    }

    await db.connectorRun.update({
      where: { id: run.id },
      data: {
        status: errors.length === 0 ? 'success' : 'partial',
        completedAt: new Date(),
        itemsFetched,
        itemsCreated,
        itemsUpdated,
        itemsSkipped,
        errorMessage: errors.length > 0 ? errors.join('\n').slice(0, 2000) : null,
        logJson: JSON.stringify({ errors: errors.slice(0, 10) }),
      },
    })

    await logAction({
      tenantId: options.tenantId,
      userId: options.triggeredById,
      action: 'connector_run_completed',
      entityType: 'connector_run',
      entityId: run.id,
      afterJson: {
        source: connector.code,
        itemsFetched, itemsCreated, itemsUpdated, itemsSkipped,
        errors: errors.length,
      },
    })
  } catch (e) {
    await db.connectorRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        itemsFetched,
        errorMessage: (e as Error).message,
      },
    })
    errors.push(`Connector run failed: ${(e as Error).message}`)
  }

  return {
    source: connector.code,
    itemsFetched,
    itemsCreated,
    itemsUpdated,
    itemsSkipped,
    errors,
    durationMs: Date.now() - startTime,
  }
}

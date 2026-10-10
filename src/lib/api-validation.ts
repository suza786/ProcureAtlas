import { z } from 'zod'
import { readWebhookBody } from './inbound-webhook'

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)
export const roleSchema = z.enum(['owner', 'admin', 'manager', 'contributor', 'viewer'])
const text = z.string().trim().min(1).max(500)
const notes = z.string().max(10000)
const email = z.string().trim().toLowerCase().max(254).email()
const password = z.string().min(1).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password exceeds 72 UTF-8 bytes')
const newPassword = password.refine(value => value.length >= 12, 'Password must contain at least 12 characters')
export const currencySchema = z.string().regex(/^[A-Z]{3}$/).refine(value => new Set(Intl.supportedValuesOf('currency')).has(value), 'Unknown currency')
export const dateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })])
const money = z.number().finite().min(0).max(1e12)
const percentage = z.number().finite().min(0).max(100)
export const triggerSchema = z.enum(['bid_decision', 'submission', 'pricing', 'legal', 'evidence_verification'])
export const approvalStepsSchema = z.array(z.object({ order: z.number().int().min(1).max(20), role: z.enum(['manager', 'admin', 'owner']),
  approverEmail: email.optional(), autoApprove: z.literal(false).optional() }).strict()).min(1).max(20).refine(steps =>
    [...steps].sort((a, b) => a.order - b.order).every((step, index) => step.order === index + 1), 'Step orders must be unique and consecutive starting at 1')
const extractedItem = z.object({ category: z.enum(['eligibility', 'technical', 'financial', 'legal', 'experience', 'certification', 'document']),
  criterion: text, operator: z.string().max(100).nullable(), threshold: z.string().max(2000).nullable(),
  thresholdAmount: money.optional(), thresholdCurrency: currencySchema.optional(), thresholdUnit: text.optional(), evaluationMetric: text.optional(),
  isMandatory: z.boolean(), sourceSnippet: z.string().min(1).max(10000), confidence: z.number().min(0).max(1) }).strict()
const chainCreate = z.object({ name: text, triggerType: triggerSchema, slaHours: z.number().int().min(1).max(8760).optional(), steps: approvalStepsSchema }).strict()

export const bodySchemas = {
  login: z.object({ email, password, otp: z.string().regex(/^\d{6}$/).optional() }).strict(),
  adminUser: z.object({ role: roleSchema.optional(), resetPassword: newPassword.optional(), unlockAccount: z.boolean().optional() }).strict().refine(value => Object.keys(value).length > 0, 'No updates supplied'),
  apiKey: z.object({ name: text, scopes: z.array(z.enum(['mcp:read', 'api:read', 'api:write'])).min(1).max(3), expiresAt: dateSchema.optional() }).strict().refine(value => !value.expiresAt || new Date(value.expiresAt) > new Date(), 'Expiry must be in the future'),
  chainCreate, chainUpdate: chainCreate.partial().extend({ id: idSchema, isActive: z.boolean().optional() }).strict(),
  approval: z.object({ decision: z.enum(['approved', 'rejected', 'changes_requested']), reason: notes.optional() }).strict(),
  cost: z.object({ pursuitId: idSchema, label: text, currency: currencySchema.optional(), laborCost: money.optional(), materialsCost: money.optional(),
    subcontractorCost: money.optional(), overheadCost: money.optional(), travelCost: money.optional(), contingencyPct: percentage.optional(), marginPct: percentage.refine(value => value < 100, 'Margin must be below 100%').optional(), notes: notes.optional(), hedgingNotes: notes.optional() }).strict(),
  subscription: z.object({ plan: z.enum(['free', 'solo', 'professional', 'bid_team', 'enterprise', 'intelligence', 'pursuit_pro', 'team']).optional(), billingCycle: z.enum(['monthly', 'yearly']).optional(), cancelAtPeriodEnd: z.boolean().optional() }).strict(),
  evidence: z.object({ category: z.enum(['registration', 'financial', 'certification', 'project', 'oem', 'partnership', 'employee', 'facility', 'equipment', 'catalogue', 'reference', 'proposal_library', 'past_response', 'past_win', 'past_loss']), title: text, description: notes.optional(), issuer: text.optional(), issuedAt: dateSchema.optional(), expiresAt: dateSchema.optional(), fileUploadId: idSchema.optional(), factMetric: text.optional(), factAmount: money.optional(), factCurrency: currencySchema.optional(), factUnit: text.optional() }).strict().refine(value => !value.issuedAt || !value.expiresAt || new Date(value.issuedAt) <= new Date(value.expiresAt), 'Expiry precedes issue date'),
  connector: z.object({ sourceCode: z.literal('cptu_bd'), runType: z.enum(['scheduled', 'manual', 'backfill']).optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  currencyRate: z.object({ baseCurrency: currencySchema, quoteCurrency: currencySchema, rate: z.number().finite().min(1e-9).max(1e9), source: text.optional(), rateDate: z.iso.date() }).strict(),
  extraction: z.object({ decision: z.enum(['approved', 'rejected', 'edited']), notes: notes.optional(), editedItems: z.array(extractedItem).max(500).optional() }).strict().refine(value => value.decision !== 'edited' || value.editedItems !== undefined, 'Edited items required'),
  notification: z.object({ id: idSchema.optional(), all: z.boolean().optional() }).strict().refine(value => Boolean(value.id || value.all), 'id or all=true required'),
  preferences: z.object({ preferences: z.array(z.object({ channel: z.enum(['in_app', 'email', 'slack', 'teams', 'webhook']), eventType: z.enum(['alert', 'deadline', 'amendment', 'extraction_ready', 'approval_request', 'system', 'webhook_delivery']), enabled: z.boolean(), minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional() }).strict()).max(50) }).strict(),
  proposalCreate: z.object({ pursuitId: idSchema, title: text }).strict(),
  proposalUpdate: z.object({ expectedRevision: z.number().int().nonnegative(), status: z.enum(['draft', 'in_review', 'approved', 'submitted', 'withdrawn']).optional(), title: text.optional() }).strict(),
  draft: z.object({ sectionId: idSchema, expectedRevision: z.number().int().nonnegative() }).strict(),
  section: z.object({ expectedRevision: z.number().int().nonnegative(), content: z.string().max(200000).optional(), status: z.enum(['todo', 'drafting', 'in_review', 'approved', 'needs_revision']).optional(), evidenceIds: z.array(idSchema).max(100).optional(), assignedTo: idSchema.optional() }).strict(),
  version: z.object({ expectedRevision: z.number().int().nonnegative(), changeSummary: notes.optional() }).strict(),
  pursuit: z.object({ tenderId: idSchema, companyId: idSchema.optional(), stage: z.literal('discovering').optional(), bidDecision: z.literal('pending').optional(), decisionReason: notes.optional(), priority: z.enum(['low', 'medium', 'high', 'strategic']).optional() }).strict(),
  taskUpdate: z.object({ status: z.enum(['todo','in_progress','in_review','done','blocked']) }).strict(),
  evidenceReview: z.object({ id: idSchema, verified: z.boolean(), factMetric: text.optional(), factAmount: money.optional(), factCurrency: currencySchema.optional(), factUnit: text.optional() }).strict(),
  pursuitUpdate: z.object({ expectedStage: z.enum(['discovering','qualifying','bidding','submitted','won','lost','no_bid']), stage: z.enum(['discovering','qualifying','bidding','won','lost','no_bid']), priority: z.enum(['low','medium','high','strategic']).optional() }).strict(),
  complianceUpdate: z.object({ requirementId: idSchema, evidenceId: idSchema.nullable().optional(), status: z.enum(['compliant','partial','gap','not_applicable']), notes: notes.optional() }).strict(),
  scim: z.object({ tenantId: idSchema, schemas: z.array(z.string().max(256)).max(10).optional(), userName: email.optional(), displayName: text.optional(), emails: z.array(z.object({ value: email, primary: z.boolean().optional(), type: text.optional() }).strict()).max(10).optional(), active: z.boolean().optional() }).strict().refine(value => Boolean(value.userName || value.emails?.length), 'User email required'),
  embeddings: z.object({ texts: z.array(z.string().min(1).max(100000)).min(1).max(20), entityType: z.enum(['tender', 'company', 'evidence', 'requirement']).optional(), entityId: idSchema.optional() }).strict().refine(value => Boolean(value.entityType) === Boolean(value.entityId), 'Entity type and ID must be supplied together'),
  export: z.object({ exportType: z.enum(['tenders', 'pursuits', 'evidence', 'audit_log', 'full_backup', 'awards']), format: z.enum(['json', 'csv']).optional() }).strict(),
  webhook: z.object({ name: text, url: z.url().max(2048), events: z.array(z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/)).min(1).max(50) }).strict(),
  delivery: z.object({ endpointId: idSchema, eventType: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/), payload: z.record(z.string(), z.unknown()).optional() }).strict(),
}

export const inboundTenderSchema = z.object({
  id: z.union([z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_.:/-]+$/), z.number().int().nonnegative().safe()]).optional(), reference: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_.:/-]+$/).optional(),
  title: z.string().trim().min(1).max(1000), url: z.httpUrl().max(2048), description: notes.optional(),
  country: z.string().min(2).max(10).optional(), sector: text.optional(), currency: currencySchema.optional(),
  value: money.optional(), value_usd: money.optional(), published: dateSchema.optional(), deadline: dateSchema.optional(),
}).passthrough().refine(value => value.id !== undefined || value.reference !== undefined, 'Stable external ID or reference required')

export async function readJson<K extends keyof typeof bodySchemas>(req: Request, schema: K): Promise<z.output<(typeof bodySchemas)[K]>> {
  return bodySchemas[schema].parse(JSON.parse(await readWebhookBody(req))) as z.output<(typeof bodySchemas)[K]>
}
export function parseIds<T extends Record<string, string>>(params: T): T {
  for (const value of Object.values(params)) idSchema.parse(value)
  return params
}
const integer = (maximum: number, minimum = 0) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum))
export function pagination(search: URLSearchParams, defaultLimit = 50, maximum = 100) {
  return { limit: integer(maximum, 1).parse(search.get('limit') ?? String(defaultLimit)), offset: integer(100000).parse(search.get('offset') ?? '0') }
}

export function validatedSearch(req: Request): URLSearchParams {
  const url = new URL(req.url)
  const search = url.searchParams
  for (const [key, value] of search) {
    z.string().max(500).parse(value)
    if (key === 'id' || key.endsWith('Id')) idSchema.parse(value)
    if (['read', 'unread', 'download', 'active'].includes(key)) z.enum(['true', 'false']).parse(value)
    if (key === 'reviewStatus') z.enum(['pending', 'approved', 'rejected', 'edited', 'all']).parse(value)
    if (key === 'currency' || key.endsWith('Currency')) currencySchema.parse(value)
    if (key === 'status') {
      const states = url.pathname.includes('tenders') ? ['active', 'closed', 'awarded', 'cancelled', 'amended', 'all'] :
        url.pathname.includes('proposals') ? ['draft', 'in_review', 'approved', 'submitted', 'withdrawn', 'all'] :
        url.pathname.includes('approvals') ? ['pending', 'approved', 'rejected', 'changes_requested', 'all'] :
        ['pending', 'delivered', 'failed', 'retrying', 'running', 'completed', 'success', 'partial', 'all']
      z.string().refine(value => states.includes(value), 'Invalid status').parse(value)
    }
  }
  // Even unused pagination parameters are bounded consistently.
  if (search.has('limit') || search.has('offset')) pagination(search)
  return search
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code = 'request_failed') {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to complete the request. Please retry.'
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function has(value: unknown, arrays: string[] = [], objects: string[] = []): boolean {
  return isRecord(value) && arrays.every(key => Array.isArray(value[key])) && objects.every(key => isRecord(value[key]))
}
function numbers(value: unknown, keys: string[]) {
  return isRecord(value) && keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
}

/** Validate the containers used by views before they can be rendered. */
export function validApiPayload(url: string, value: unknown, method = 'GET'): boolean {
  if (!isRecord(value) || typeof value.error === 'string') return false
  const path = url.split('?')[0]
  if (method !== 'GET') {
    if (method === 'POST' && ['/api/pursuits', '/api/proposals', '/api/company/evidence', '/api/uploads', '/api/api-keys', '/api/webhooks'].includes(path)) {
      return typeof value.id === 'string' && (path !== '/api/api-keys' || typeof value.key === 'string') && (path !== '/api/webhooks' || typeof value.secret === 'string')
    }
    return true
  }
  if (['/api/tenders', '/api/pursuits', '/api/proposals', '/api/buyers', '/api/competitors', '/api/markets', '/api/notifications', '/api/notifications/preferences', '/api/api-keys', '/api/webhooks', '/api/webhooks/deliveries', '/api/approvals', '/api/approval-chains', '/api/extractions', '/api/admin/users', '/api/audit', '/api/bid-cost-estimates', '/api/currency-rates'].includes(path)) {
    if (!has(value, ['items']) || !(value.items as unknown[]).every(isRecord)) return false
    if (path === '/api/tenders') return ['total', 'limit', 'offset'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key])) && (value.items as Record<string, unknown>[]).every(item => ['id', 'title', 'market', 'sector', 'currency'].every(key => typeof item[key] === 'string'))
    if (path === '/api/buyers') return (value.items as unknown[]).every(item => has(item, ['topSectors', 'recentAwards']))
    if (path === '/api/competitors') return (value.items as Record<string, unknown>[]).every(item => has(item, ['recentAwards'], ['stats']) && has(item.stats, ['sectorsWon', 'topBuyers']))
    return true
  }
  if (path === '/api/company') return has(value, ['evidence', 'certifications', 'projectReferences', 'employees'], ['stats', 'capabilityMap', 'expiryBuckets'])
  if (path === '/api/connectors') return has(value, ['connectors'])
  if (path === '/api/billing/usage') return has(value, ['usage', 'invoices'], ['subscription']) && (value.usage as unknown[]).every(item => numbers(item, ['used', 'limit', 'percentage']) && isRecord(item) && typeof item.metricType === 'string') && typeof (value.subscription as Record<string, unknown>).plan === 'string'
  if (path === '/api/partners') return has(value, ['suggestions'], ['tenantCompany'])
  if (path === '/api/awards') return has(value, ['items', 'marketShare', 'byMarket', 'bySector']) && numbers(value, ['total', 'totalValueUSD', 'normalizedCount', 'unnormalizedCount', 'distinctWinnerCount']) && (value.averageValueUSD === null || typeof value.averageValueUSD === 'number')
  if (path === '/api/analytics') return has(value, ['history'], ['current', 'trends', 'metadata']) && numbers(value.current, ['activePursuits', 'llmCalls30d']) && isRecord(value.current) && (value.current.llmCost30d === null || numbers(value.current, ['llmCost30d'])) && has(value.trends, ['winRate', 'pipelineValue', 'llmUsage', 'evidenceCoverage', 'bidCycleTime'])
  if (path === '/api/admin/system') return has(value, ['recentConnectorRuns'], ['tenant', 'stats', 'llmUsage', 'storage']) && numbers(value.stats, ['fileUploads', 'tenders', 'llmExtractions', 'auditEntries']) && numbers(value.llmUsage, ['costUsd'])
  if (/^\/api\/pursuits\/[^/]+\/compliance$/.test(path)) return has(value, ['items'], ['summary'])
  if (/^\/api\/pursuits\/[^/]+$/.test(path)) return has(value, ['tasks', 'approvals'], ['pursuit', 'compliance', 'scoring']) && has(value.compliance, ['items']) && has(value.pursuit, [], ['tender']) && has(value.scoring, [], ['eligibility', 'opportunityFit'])
  if (/^\/api\/scoring\/[^/]+$/.test(path)) return has(value, [], ['eligibility', 'opportunityFit']) && has(value.eligibility, ['components']) && has(value.opportunityFit, ['components'])
  if (/^\/api\/tenders\/[^/]+$/.test(path)) return has(value, ['lots', 'requirements', 'documents', 'amendments', 'awards', 'alerts']) && typeof value.id === 'string'
  if (/^\/api\/buyers\/[^/]+$/.test(path)) return has(value, ['sectorPreferences', 'incumbents', 'recentTenders', 'awardHistory'], ['stats'])
  if (/^\/api\/competitors\/[^/]+$/.test(path)) return has(value, ['topBuyers', 'sectorBreakdown', 'marketBreakdown', 'winTrend', 'awardHistory'], ['stats'])
  if (/^\/api\/proposals\/[^/]+$/.test(path)) return has(value, ['sections', 'versions'])
  if (path === '/api/auth/me') return value.authenticated === true && isRecord(value.user)
  return true
}

function report(url: string, method: string, error: ApiError | null) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('api-request-state', { detail: { url, method, error: error?.message ?? null, status: error?.status } }))
}

/** Response-compatible adapter for callers that also use headers/status/text. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  try {
    const response = await fetch(url, init)
    if (!response.ok) {
      const body: unknown = await response.clone().json().catch(() => null)
      const message = response.status === 401 && url === '/api/auth/sign-in' && isRecord(body) && typeof body.error === 'string' ? body.error
        : response.status === 401 ? 'Your session has expired. Please sign in again.'
        : response.status === 403 ? 'You do not have permission to perform this action.'
        : response.status === 404 ? 'The requested record was not found.'
        : isRecord(body) && typeof body.error === 'string' ? body.error
        : `Request failed (${response.status}). Please retry.`
      throw new ApiError(message, response.status)
    }
    // Validate even when a mutation caller only checks the status.
    if (response.status !== 204 && !url.startsWith('/api/v1/')) {
      const body: unknown = await response.clone().json().catch(() => { throw new ApiError('The server returned invalid JSON. Please retry.', response.status, 'invalid_response') })
      if (!validApiPayload(url, body, method)) throw new ApiError('The server returned an unexpected response. Please retry.', response.status, 'invalid_response')
    }
    report(url, method, null)
    return response
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw cause
    const error = cause instanceof ApiError ? cause : new ApiError('Unable to reach the server. Please retry.', 0, 'network_error')
    report(url, method, error)
    throw error
  }
}

export async function apiRequest<T = unknown>(url: string, init?: RequestInit, validate?: (value: unknown) => boolean): Promise<T> {
  const response = await apiFetch(url, init)
  const value: unknown = await response.json().catch(() => { throw new ApiError('The server returned invalid JSON. Please retry.', response.status, 'invalid_response') })
  if (!isRecord(value) || (validate && !validate(value))) {
    const error = new ApiError('The server returned an unexpected response. Please retry.', response.status, 'invalid_response')
    report(url, init?.method ?? 'GET', error)
    throw error
  }
  return value as T
}

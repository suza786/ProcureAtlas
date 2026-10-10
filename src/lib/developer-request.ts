export function developerRequest(endpoint: { method: string; path: string }, token: string, entityId: string, query: string, body: string): { url: string; init: RequestInit } {
  const key = token.trim().replace(/^Bearer\s+/i, '')
  if (!key || /\s/.test(key)) throw new Error('Paste a complete API key')
  let path = endpoint.path
  if (path.includes(':id')) {
    if (!entityId.trim()) throw new Error('Enter a real entity ID')
    path = path.replace(':id', encodeURIComponent(entityId.trim()))
  }
  if (!path.startsWith('/api/v1/')) throw new Error('Invalid API endpoint')
  const url = new URL(path, 'http://localhost')
  const additional = new URLSearchParams(query.replace(/^\?/, ''))
  additional.forEach((value, name) => url.searchParams.set(name, value))
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  const init: RequestInit = { method: endpoint.method, headers, credentials: 'omit', cache: 'no-store' }
  if (endpoint.method !== 'GET') {
    const parsed = JSON.parse(body)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Request body must be a JSON object')
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(parsed)
  }
  return { url: url.pathname + url.search, init }
}

import { AsyncLocalStorage } from 'node:async_hooks'
export const apiContext = new AsyncLocalStorage<{ metered: boolean; metering?: Promise<void>; tenantId?: string; userId?: string | null; apiKeyId?: string; path?: string }>()
export function runApiRequest<T>(request: unknown, callback: () => T): T {
  const path = request instanceof Request ? new URL(request.url).pathname : undefined
  return apiContext.run({ metered: false, path }, callback)
}

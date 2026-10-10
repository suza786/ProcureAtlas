import { runApiRequest } from './request-context'
import { ZodError } from 'zod'
import { unstable_rethrow } from 'next/navigation'
/** Normalize deliberate guard, validation and database errors without leaking internals. */
export function withApiErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    return runApiRequest(args[0], async () => {
    try {
      const response = await handler(...args)
      if (response.status >= 400 && !response.headers.get('content-type')?.includes('application/json')) {
        const headers = new Headers(response.headers)
        headers.delete('content-type'); headers.delete('content-length')
        return Response.json({ error: (await response.text()) || response.statusText }, { status: response.status, headers })
      }
      return response
    }
    catch (error) {
      unstable_rethrow(error)
      if (error instanceof Response) {
        const headers = new Headers(error.headers)
        headers.delete('content-type'); headers.delete('content-length')
        if (error.headers.get('content-type')?.includes('application/json')) return error
        return Response.json({ error: (await error.text()) || error.statusText || 'Request denied' }, { status: error.status, headers })
      }
      if (error instanceof ZodError) return Response.json({ error: 'Invalid request', details: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) }, { status: 400 })
      if (error instanceof SyntaxError) return Response.json({ error: 'Invalid JSON' }, { status: 400 })
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 })
      if (code === 'P2002') return Response.json({ error: 'Record already exists' }, { status: 409 })
      if (code === 'P2003') return Response.json({ error: 'Invalid related record' }, { status: 400 })
      if (code === 'P2034' || code === 'P2028') return Response.json({ error: 'Concurrent update; retry the request' }, { status: 409 })
      console.error('API request failed', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
    })
  }
}

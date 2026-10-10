import path from 'node:path'
const CATEGORIES = new Set(['evidence', 'tender_document', 'bid_document', 'proposal'])
export const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
export function getTenantUploadDirectory(root: string, tenantId: string, category: unknown): string {
  if (typeof category !== 'string' || !CATEGORIES.has(category)) throw new Response('Invalid upload category', { status: 400 })
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) throw new Response('Invalid tenant storage path', { status: 400 })
  const tenantRoot = path.resolve(root, tenantId)
  const directory = path.resolve(tenantRoot, category)
  if (!directory.startsWith(tenantRoot + path.sep)) throw new Response('Invalid upload path', { status: 400 })
  return directory
}

/** Reject historical unsafe storage paths on reads and deletes as well as new writes. */
export function requireTenantStoredPath(root: string, tenantId: string, category: unknown, storedPath: string): string {
  const directory = getTenantUploadDirectory(root, tenantId, category)
  const resolved = path.resolve(storedPath)
  if (path.dirname(resolved) !== directory) throw new Response('File storage path is outside tenant scope', { status: 400 })
  return resolved
}

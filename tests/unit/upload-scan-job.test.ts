import { afterEach, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { OutboxJob } from '@prisma/client'
const state = vi.hoisted(() => ({ row: null as null | Record<string, unknown> }))
vi.mock('@/lib/db', () => ({ db: { fileUpload: {
  findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => state.row?.id === where.id && state.row?.tenantId === where.tenantId ? state.row : null,
  updateMany: async ({ where, data }: { where: { id: string; tenantId: string }; data: Record<string, unknown> }) => {
    if (state.row?.id !== where.id || state.row?.tenantId !== where.tenantId) return { count: 0 }
    Object.assign(state.row, data); return { count: 1 }
  },
} } }))
vi.mock('@/lib/outbox', () => ({ JobFailure: class extends Error { constructor(message: string, public permanent = false) { super(message) } } }))
import { dispatchUploadScan } from '@/lib/upload-processing'
import { getTenantUploadDirectory, UPLOAD_ROOT } from '@/lib/upload-security'
const directories: string[] = []
afterEach(async () => { vi.unstubAllEnvs(); state.row = null; for (const directory of directories.splice(0)) await fs.rm(directory, { recursive: true, force: true }) })

async function storedUpload() {
  const tenantId = 'scan-test-' + randomUUID()
  const directory = getTenantUploadDirectory(UPLOAD_ROOT, tenantId, 'evidence')
  directories.push(path.dirname(directory))
  await fs.mkdir(directory, { recursive: true })
  const storageUrl = path.join(directory, 'upload.txt')
  const bytes = Buffer.from('Real evidence text')
  await fs.writeFile(storageUrl, bytes)
  state.row = { id: 'upload-a', tenantId, fileName: 'evidence.txt', fileType: 'text/plain', category: 'evidence', checksum: createHash('sha256').update(bytes).digest('hex'), storageUrl, virusScanResult: 'pending', textExtracted: null }
  return { tenantId, payloadJson: '{"uploadId":"upload-a"}' } as OutboxJob
}

it('leaves actual stored bytes quarantined when scanner cannot execute', async () => {
  const job = await storedUpload()
  vi.stubEnv('CLAMAV_COMMAND', 'procureatlas-nonexistent-scanner')
  await expect(dispatchUploadScan(job)).rejects.toThrow('Malware scanner unavailable')
  expect(state.row?.virusScanResult).toBe('error')
  expect(state.row?.textExtracted).toBeNull()
})

it('does not process an upload from a different tenant', async () => {
  const job = await storedUpload()
  await dispatchUploadScan({ ...job, tenantId: 'foreign-tenant' })
  expect(state.row?.virusScanResult).toBe('pending')
})

it('quarantines bytes that no longer match the stored checksum', async () => {
  const job = await storedUpload()
  await fs.writeFile(state.row!.storageUrl as string, 'Changed evidence')
  await expect(dispatchUploadScan(job)).rejects.toThrow('checksum mismatch')
  expect(state.row?.virusScanResult).toBe('error')
})

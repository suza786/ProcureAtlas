import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { fileUpload: { findFirst: mocks.find } } }))
vi.mock('@/lib/tenant', () => ({ getCurrentTenant: async () => ({ tenantId: 'tenant-a', userId: 'user-a' }), requireTenantWithRole: vi.fn() }))
import { GET } from '@/app/api/uploads/[id]/route'

it.each([null, 'pending', 'error', 'infected', 'unknown', 'clean'])('denies download without a verified scan timestamp while scan is %s', async virusScanResult => {
  mocks.find.mockResolvedValue({ id: 'upload-a', tenantId: 'tenant-a', category: 'evidence', fileName: 'test.txt', fileType: 'text/plain', virusScanResult, storageUrl: null })
  const response = await GET(new Request('http://localhost/api/uploads/upload-a?download=true'), { params: Promise.resolve({ id: 'upload-a' }) })
  expect(response.status).toBe(423)
})

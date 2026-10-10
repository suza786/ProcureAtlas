import { expect, it } from 'vitest'
import { uploadScanStatus, uploadPollDelay } from '@/lib/upload-status'
it('only offers download for a clean upload with scan provenance', () => {
  expect(uploadScanStatus('clean', null).downloadable).toBe(false)
  expect(uploadScanStatus('clean', 'invalid').downloadable).toBe(false)
  expect(uploadScanStatus('clean', '2026-10-09T00:00:00Z').downloadable).toBe(true)
  for (const status of ['pending', 'error', 'infected', null, 'unknown']) expect(uploadScanStatus(status, '2026-10-09T00:00:00Z').downloadable).toBe(false)
  expect(uploadScanStatus('infected', null).poll).toBe(false)
  expect(uploadScanStatus('pending', null).poll).toBe(true)
  expect(uploadScanStatus('error', null).poll).toBe(true)
})
it('bounds automatic status reads so unavailable workers cannot drain the tenant quota', () => {
  expect(uploadPollDelay(0)).toBe(1000)
  expect(uploadPollDelay(2)).toBe(8000)
  expect(uploadPollDelay(10)).toBe(30000)
  expect(uploadPollDelay(12)).toBeNull()
})

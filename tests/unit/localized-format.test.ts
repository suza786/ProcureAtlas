import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDate } from '@/lib/format'
describe('explicit timezone formatting', () => {
  it('shows the same instant at the chosen timezone including its zone', () => {
    const utc = formatDateTime('2026-10-09T23:30:00Z', { locale: 'en', timeZone: 'UTC' })
    const dhaka = formatDateTime('2026-10-09T23:30:00Z', { locale: 'en', timeZone: 'Asia/Dhaka' })
    expect(utc).toContain('09 Oct 2026')
    expect(dhaka).toContain('10 Oct 2026')
    expect(utc).toContain('UTC')
    expect(dhaka).toMatch(/GMT\+6|BST/)
  })
  it('uses Bangla formatting and handles invalid dates without exceptions', () => {
    expect(formatDate('2026-10-10T12:00:00Z', { locale: 'bn', timeZone: 'UTC' })).toMatch(/[০-৯]/)
    expect(formatDateTime('invalid')).toBe('—')
    expect(formatDate(null)).toBe('—')
  })
  it('formats SQLite aggregate timestamps, including epoch zero', () => {
    expect(formatDate(0)).toBe('01 Jan 1970')
    expect(formatDateTime(Date.parse('2026-10-09T23:30:00Z'))).toContain('09 Oct 2026')
    expect(formatDateTime('2026-10-09 23:30:00')).toContain('09 Oct 2026')
  })
})

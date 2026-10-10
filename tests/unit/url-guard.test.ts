import { describe, it, expect } from 'vitest'
import { assertPublicWebhookUrl } from '@/lib/url-guard'

describe('assertPublicWebhookUrl (SSRF guard)', () => {
  it('allows public https URLs', () => {
    expect(assertPublicWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx').ok).toBe(true)
    expect(assertPublicWebhookUrl('https://example.com/webhook?a=1').ok).toBe(true)
  })

  it('blocks loopback and localhost', () => {
    for (const u of ['http://localhost/x', 'http://127.0.0.1/x', 'http://127.5.6.7/x', 'http://[::1]/x']) {
      expect(assertPublicWebhookUrl(u).ok, u).toBe(false)
    }
  })

  it('blocks private RFC-1918 ranges', () => {
    expect(assertPublicWebhookUrl('http://10.0.0.5/x').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://172.16.0.1/x').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://172.31.255.255/x').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://192.168.1.1/x').ok).toBe(false)
  })

  it('blocks link-local, CGNAT, and metadata-style targets', () => {
    expect(assertPublicWebhookUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://100.64.0.1/x').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://0.0.0.0/x').ok).toBe(false)
  })

  it('blocks non-HTTP schemes', () => {
    expect(assertPublicWebhookUrl('file:///etc/passwd').ok).toBe(false)
    expect(assertPublicWebhookUrl('gopher://example.com/x').ok).toBe(false)
  })

  it('blocks internal hostnames', () => {
    expect(assertPublicWebhookUrl('http://internal.example.com/x').ok).toBe(false)
    expect(assertPublicWebhookUrl('http://printer.local/x').ok).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(assertPublicWebhookUrl('not-a-url').ok).toBe(false)
    expect(assertPublicWebhookUrl('').ok).toBe(false)
  })
})

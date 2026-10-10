import { describe, expect, it, vi } from 'vitest'
import { boundedFormData, validateUploadContent, requireCleanUpload, extractUploadText, classifyScanResult, scanUploadFile } from '@/lib/upload-processing'
import { docxFixture, pdfFixture } from './fixtures/upload-documents'

describe('upload processing security', () => {
  it('bounds actual multipart bytes even with missing or misleading length', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: '123456789', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '1' } })
    await expect(boundedFormData(request, 8)).rejects.toMatchObject({ status: 413 })
  })
  it('parses genuine bounded multipart after reading it', async () => {
    const form = new FormData(); form.set('file', new File(['hello'], 'a.txt', { type: 'text/plain' }))
    const parsed = await boundedFormData(new Request('http://localhost', { method: 'POST', body: form }), 1024)
    expect(await (parsed.get('file') as File).text()).toBe('hello')
  })
  it('rejects disguised PDF and extension/mime mismatch', () => {
    expect(() => validateUploadContent('report.pdf', 'application/pdf', Buffer.from('executable'))).toThrow()
    expect(() => validateUploadContent('report.txt', 'application/pdf', Buffer.from('%PDF-1.4\n%%EOF'))).toThrow()
    expect(() => validateUploadContent('report.txt', 'text/plain', Buffer.from([0xff, 0x00]))).toThrow()
    expect(() => validateUploadContent('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from('PK\x03\x04fake'))).toThrow()
  })
  it('denies every scan state except clean', () => {
    for (const state of [null, undefined, 'pending', 'error', 'infected', 'unknown', 'CLEAN']) expect(() => requireCleanUpload(state)).toThrow()
    expect(() => requireCleanUpload('clean')).toThrow()
    expect(() => requireCleanUpload('clean', new Date())).not.toThrow()
  })
  it('requires an actual successful scanner result', () => {
    expect(classifyScanResult(0, 'Scanned files: 1\nInfected files: 0')).toBe('clean')
    expect(classifyScanResult(1, 'virus FOUND')).toBe('infected')
    expect(classifyScanResult(0, '')).toBe('error')
    expect(classifyScanResult(2, 'scanner unavailable')).toBe('error')
  })
  it('fails closed when the configured scanner cannot execute', async () => {
    vi.stubEnv('CLAMAV_COMMAND', 'procureatlas-missing-scanner-executable')
    try { expect(await scanUploadFile('unused-file.txt')).toBe('error') }
    finally { vi.unstubAllEnvs() }
  })
  it('extracts real UTF-8 text without fabricated content', async () => {
    expect(await extractUploadText(Buffer.from('Tender scope: bridge repairs.\nবাংলা'), 'text/plain')).toBe('Tender scope: bridge repairs.\nবাংলা')
    expect(await extractUploadText(Buffer.from([137, 80, 78, 71]), 'image/png')).toBeNull()
  })
  it('extracts actual PDF page text', async () => {
    const bytes = pdfFixture()
    validateUploadContent('document.pdf', 'application/pdf', bytes)
    expect(await extractUploadText(bytes, 'application/pdf')).toContain('Verified tender document')
  }, 60000)
  it('extracts actual DOCX paragraphs and rejects a DOCX passed as XLSX', async () => {
    const bytes = docxFixture()
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    validateUploadContent('document.docx', mime, bytes)
    expect(await extractUploadText(bytes, mime)).toContain('Verified procurement scope')
    expect(() => validateUploadContent('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes)).toThrow()
  }, 60000)
  it('rejects a ZIP expansion bomb before DOCX parsing', () => {
    const bytes = docxFixture()
    const end = bytes.length - 22
    const directory = bytes.readUInt32LE(end + 16)
    bytes.writeUInt32LE(26 * 1024 * 1024, directory + 24)
    expect(() => validateUploadContent('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes)).toThrow()
  })
})

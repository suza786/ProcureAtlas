import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { OutboxJob } from '@prisma/client'
import { UPLOAD_ROOT, requireTenantStoredPath } from './upload-security'

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
// Allow bounded multipart headers/fields in addition to the file itself.
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024

/** Read and count the actual stream before invoking the multipart parser. */
export async function boundedFormData(request: Request, limit = MAX_UPLOAD_BODY_BYTES): Promise<FormData> {
  const advertised = Number(request.headers.get('content-length'))
  if (advertised > limit) throw new Response('Upload request exceeds size limit', { status: 413 })
  if (!request.body) throw new Response('Missing upload body', { status: 400 })
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new Response('Upload request exceeds size limit', { status: 413 })
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData()
  } catch { throw new Response('Invalid multipart upload', { status: 400 }) }
}

/** Inspect ZIP directory records, including expansion limits, without extracting files. */
function officeEntries(buffer: Buffer): Set<string> {
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid ZIP signature')
  let end = -1
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new Error('Invalid ZIP directory')
  const count = buffer.readUInt16LE(end + 10)
  const directorySize = buffer.readUInt32LE(end + 12)
  let offset = buffer.readUInt32LE(end + 16)
  const directoryEnd = offset + directorySize
  if (count > 512 || directoryEnd > end) throw new Error('Oversized ZIP directory')
  const entries = new Set<string>()
  let expanded = 0
  for (let index = 0; index < count; index++) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP record')
    if (buffer.readUInt16LE(offset + 8) & 1) throw new Error('Encrypted uploads unsupported')
    expanded += buffer.readUInt32LE(offset + 24)
    if (expanded > MAX_UPLOAD_BYTES) throw new Error('Expanded archive too large')
    const length = buffer.readUInt16LE(offset + 28)
    const next = offset + 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    if (next > directoryEnd) throw new Error('Invalid ZIP entry length')
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString('utf8')
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || entries.has(name)) throw new Error('Unsafe ZIP entry')
    entries.add(name); offset = next
  }
  if (offset !== directoryEnd) throw new Error('Invalid ZIP directory size')
  return entries
}

const types: Record<string, string[]> = {
  '.pdf': ['application/pdf'], '.png': ['image/png'], '.jpg': ['image/jpeg', 'image/jpg'], '.jpeg': ['image/jpeg', 'image/jpg'],
  '.txt': ['text/plain'], '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
}

export function validateUploadContent(name: string, mime: string, bytes: Buffer): void {
  const extension = path.extname(name).toLowerCase()
  if (!types[extension]?.includes(mime)) throw new Response('Unsupported file type or extension', { status: 400 })
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Response('File must be nonempty and at most 25 MB', { status: 413 })
  try {
    let valid = false
    if (extension === '.pdf') valid = /^%PDF-1\.[0-9]|^%PDF-2\.0/.test(bytes.subarray(0, 8).toString('ascii')) && bytes.subarray(-1024).includes(Buffer.from('%%EOF'))
    if (extension === '.png') valid = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(12, 16).toString('ascii') === 'IHDR'
    if (extension === '.jpg' || extension === '.jpeg') valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
    if (extension === '.txt') {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)
    }
    if (extension === '.docx' || extension === '.xlsx') {
      const entries = officeEntries(bytes)
      valid = entries.has('[Content_Types].xml') && entries.has('_rels/.rels') && entries.has(extension === '.docx' ? 'word/document.xml' : 'xl/workbook.xml') && !Array.from(entries).some(entry => /vbaProject\.bin$/i.test(entry))
    }
    if (!valid) throw new Error('Signature mismatch')
  } catch { throw new Response('File content does not match its declared format', { status: 400 }) }
}

export function requireCleanUpload(result: string | null | undefined, scannedAt?: Date | null): void {
  if (result !== 'clean' || !(scannedAt instanceof Date) || !Number.isFinite(scannedAt.getTime())) throw new Response('File is quarantined until a successful malware scan', { status: 423 })
}

export function classifyScanResult(code: number | null, output: string): 'clean' | 'infected' | 'error' {
  if (code === 1) return 'infected'
  if (code === 0 && /Infected files:\s*0\b/.test(output) && /Scanned files:\s*[1-9]\d*\b/.test(output)) return 'clean'
  return 'error'
}

export function scanUploadFile(filePath: string): Promise<'clean' | 'infected' | 'error'> {
  return new Promise(resolve => {
    execFile(process.env.CLAMAV_COMMAND || 'clamscan', ['--', filePath], { timeout: 60_000, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
      resolve(classifyScanResult(code, stdout + stderr))
    })
  })
}

/** Parsers consume real document bytes; unsupported image/XLSX extraction remains null. */
export async function extractUploadText(bytes: Buffer, mime: string): Promise<string | null> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error('Document exceeds extraction size limit')
  if (mime === 'text/plain') return new TextDecoder('utf-8', { fatal: true }).decode(bytes).slice(0, 64000)
  if (mime === 'application/pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 })
    const document = await loading.promise
    try {
      if (document.numPages > 1000) throw new Error('PDF page limit exceeded')
      let text = ''
      let itemCount = 0
      for (let pageNumber = 1; pageNumber <= document.numPages && text.length < 64000; pageNumber++) {
        const page = await document.getPage(pageNumber)
        const reader = page.streamTextContent().getReader()
        try {
          while (text.length < 64000) {
            const { done, value } = await reader.read()
            if (done) break
            for (const item of value.items) {
              if (++itemCount > 200000) throw new Error('PDF text item limit exceeded')
              if ('str' in item) text += (item.str + (item.hasEOL ? '\n' : ' ')).slice(0, 64000 - text.length)
              if (text.length >= 64000) break
            }
          }
          if (text.length >= 64000) await reader.cancel()
          else text += '\n'
        } finally { reader.releaseLock(); page.cleanup() }
      }
      return text.slice(0, 64000)
    } finally { await loading.destroy() }
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    officeEntries(bytes) // Bound archive expansion even when extraction is called outside the worker.
    const mammoth = await import('mammoth')
    return (await mammoth.extractRawText({ buffer: bytes })).value.slice(0, 64000)
  }
  return null
}

export async function dispatchUploadScan(job: OutboxJob): Promise<void> {
  const { db } = await import('./db')
  const { JobFailure } = await import('./outbox')
  let uploadId: unknown
  try { uploadId = JSON.parse(job.payloadJson).uploadId } catch { throw new JobFailure('Invalid upload scan payload', true) }
  if (typeof uploadId !== 'string' || !uploadId) throw new JobFailure('Invalid upload scan payload', true)
  const upload = await db.fileUpload.findFirst({ where: { id: uploadId, tenantId: job.tenantId } })
  if (!upload) return // deletion revokes the queued work
  if (upload.virusScanResult === 'infected') return
  if (!upload.storageUrl) throw new JobFailure('Upload storage unavailable', true)
  const filePath = requireTenantStoredPath(UPLOAD_ROOT, job.tenantId, upload.category, upload.storageUrl)
  try {
    if ((await fs.stat(filePath)).size > MAX_UPLOAD_BYTES) throw new JobFailure('Stored upload exceeds size limit', true)
    const bytes = await fs.readFile(filePath)
    if (createHash('sha256').update(bytes).digest('hex') !== upload.checksum) throw new JobFailure('Upload checksum mismatch', true)
    validateUploadContent(upload.fileName, upload.fileType, bytes)
    const result = await scanUploadFile(filePath)
    if (result !== 'clean') await db.fileUpload.updateMany({ where: { id: upload.id, tenantId: job.tenantId }, data: { virusScanResult: result, virusScannedAt: result === 'infected' ? new Date() : null, textExtracted: null, textExtractedAt: null } })
    if (result === 'error') throw new JobFailure('Malware scanner unavailable or failed')
    if (result === 'infected') return
    // Verify that bytes did not change while the scanner inspected the storage path.
    const afterScan = await fs.readFile(filePath)
    if (!afterScan.equals(bytes)) throw new JobFailure('Upload changed during malware scan', true)
    const textExtracted = await extractUploadText(bytes, upload.fileType)
    await db.fileUpload.updateMany({ where: { id: upload.id, tenantId: job.tenantId }, data: { virusScanResult: 'clean', virusScannedAt: new Date(), textExtracted, textExtractedAt: textExtracted === null ? null : new Date() } })
  } catch (error) {
    await db.fileUpload.updateMany({ where: { id: upload.id, tenantId: job.tenantId, virusScanResult: { not: 'infected' } }, data: { virusScanResult: 'error', virusScannedAt: null, textExtracted: null, textExtractedAt: null } })
    throw error
  }
}

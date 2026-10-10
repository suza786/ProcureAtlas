export function uploadScanStatus(result: string | null | undefined, scannedAt: string | null | undefined) {
  const downloadable = result === 'clean' && !!scannedAt && Number.isFinite(Date.parse(scannedAt))
  if (downloadable) return { downloadable, poll: false, message: 'Malware scan passed. Your file is ready.' }
  if (result === 'infected') return { downloadable, poll: false, message: 'Malware detected. This file is quarantined and cannot be downloaded.' }
  if (result === 'error') return { downloadable, poll: true, message: 'File processing failed. Your file remains quarantined while processing is retried.' }
  return { downloadable, poll: true, message: 'Your file is quarantined while its malware scan and document processing run.' }
}
export function uploadPollDelay(attempt: number): number | null {
  return attempt >= 12 ? null : attempt === 0 ? 1000 : Math.min(30000, 2000 * 2 ** attempt)
}

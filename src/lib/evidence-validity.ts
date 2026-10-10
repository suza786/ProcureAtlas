/** Records without a verification flag cannot substantiate a claim. */
export function isCurrentVerified(record: { verified?: boolean; verifiedAt?: Date | string | null; issuedAt?: Date | string | null; expiresAt?: Date | string | null }, now = new Date()): boolean {
  if (record.verified !== true) return false
  if (record.verifiedAt && (!Number.isFinite(new Date(record.verifiedAt).getTime()) || new Date(record.verifiedAt) > now)) return false
  if (record.issuedAt && (!Number.isFinite(new Date(record.issuedAt).getTime()) || new Date(record.issuedAt) > now)) return false
  if (record.expiresAt && (!Number.isFinite(new Date(record.expiresAt).getTime()) || new Date(record.expiresAt) <= now)) return false
  return true
}

/** Memory-only cache. Identity changes and mutations advance a generation so late
 * responses cannot repopulate invalidated data. Never persist authentication. */
export class ClientQueryCache {
  private entries = new Map<string, { value: unknown; expires: number }>()
  private scope = ''
  version = 0
  constructor(private ttl = 30_000, private maxEntries = 60) {}
  setScope(scope: string) {
    if (scope !== this.scope) { this.scope = scope; this.clear() }
  }
  clear() { this.entries.clear(); this.version++ }
  remove(key: string) { this.entries.delete(key) }
  read<T>(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) { this.entries.delete(key); return undefined }
    return entry.value as T
  }
  write(key: string, value: unknown, version = this.version) {
    if (version !== this.version) return
    this.entries.delete(key)
    this.entries.set(key, { value, expires: Date.now() + this.ttl })
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!)
  }
}

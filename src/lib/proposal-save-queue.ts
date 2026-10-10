/** Serializes saves so the next request can use the revision returned by the previous one. */
export class SaveQueue {
  private tail: Promise<unknown> = Promise.resolve()
  private error: unknown = null
  enqueue<T>(save: () => Promise<T>): Promise<T> {
    const result = this.tail.then(save)
    this.tail = result.then(() => { this.error = null }, error => { this.error = error })
    return result
  }
  async flush(): Promise<void> {
    await this.tail
    if (this.error) throw this.error
  }
}

export class MemoryCache<T> {
  private readonly values = new Map<string, { value: T; expiresAt: number }>();
  private readonly pending = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T) {
    this.values.delete(key);
    this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
    return value;
  }

  async getOrLoad(key: string, load: () => Promise<T>) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const running = this.pending.get(key);
    if (running) return running;
    const request = load()
      .then((value) => this.set(key, value))
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  clear() {
    this.values.clear();
    this.pending.clear();
  }
}

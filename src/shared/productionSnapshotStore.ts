export type ProductionSnapshotStoredEntry = { id: string; bytes: number; savedAtMs: number };
export type ProductionSnapshotBackend = {
  read(id: string, maxBytes: number): Promise<Uint8Array | null>;
  write(id: string, bytes: Uint8Array, savedAtMs: number): Promise<void>;
  entries(): Promise<ProductionSnapshotStoredEntry[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
};
type Options = { backend: ProductionSnapshotBackend; sha256: (value: string) => Promise<string>; now?: () => number;
  maxAgeMs?: number; maxEntries?: number; maxEntryBytes?: number; maxTotalBytes?: number };

/** @v2 ProductionSnapshotStore */
export class ProductionSnapshotStore {
  private readonly backend: ProductionSnapshotBackend;
  private readonly sha256: (value: string) => Promise<string>;
  private readonly now: () => number;
  private readonly maxAgeMs: number;
  private readonly maxEntries: number;
  private readonly maxEntryBytes: number;
  private readonly maxTotalBytes: number;
  private tail: Promise<void> = Promise.resolve();
  private currentGeneration = 0;
  private readonly keyGenerations = new Map<string, number>();
  private needsClear = false;

  constructor(options: Options) {
    this.backend = options.backend; this.sha256 = options.sha256; this.now = options.now ?? Date.now;
    this.maxAgeMs = options.maxAgeMs ?? 7 * 24 * 60 * 60_000;
    this.maxEntries = options.maxEntries ?? 24; this.maxEntryBytes = options.maxEntryBytes ?? 16 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 64 * 1024 * 1024;
    if (this.maxAgeMs <= 0 || this.maxEntries <= 0 || this.maxEntryBytes <= 0 || this.maxTotalBytes < this.maxEntryBytes) {
      throw new RangeError('Invalid production snapshot cache limits');
    }
  }
  get generation(): number { return this.currentGeneration; }
  private serial<T>(fallback: T, operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => { try { return await operation(); } catch { return fallback; } });
    this.tail = result.then(() => undefined); return result;
  }
  private key(scope: string, key: string): string { return JSON.stringify([scope, key]); }
  private current(key: string, generation: number, keyGeneration: number): boolean {
    return generation === this.currentGeneration && keyGeneration === (this.keyGenerations.get(key) ?? 0);
  }
  async read(scope: string, key: string): Promise<Record<string, unknown> | null> {
    if (!scope || !key) return null;
    const rawKey = this.key(scope, key), generation = this.currentGeneration, keyGeneration = this.keyGenerations.get(rawKey) ?? 0;
    const current = () => this.current(rawKey, generation, keyGeneration);
    return this.serial<Record<string, unknown> | null>(null, async () => {
      if (!current() || this.needsClear) return null;
      const id = await this.sha256(rawKey);
      if (!current() || this.needsClear) return null;
      await this.trim();
      const bytes = await this.backend.read(id, this.maxEntryBytes);
      if (!current() || !bytes) return null;
      try {
        const value = await this.decode(bytes, scope, key);
        return current() ? value : null;
      } catch { await this.backend.remove(id); return null; }
    });
  }
  write(scope: string, key: string, value: Record<string, unknown>): Promise<void> {
    try { return this.writeEncoded(scope, key, JSON.stringify(value)); } catch { return Promise.resolve(); }
  }
  writeEncoded(scope: string, key: string, valueJson: string, expectedGeneration?: number): Promise<void> {
    if (!scope || !key || valueJson.length > this.maxEntryBytes ||
        (expectedGeneration !== undefined && expectedGeneration !== this.currentGeneration)) return Promise.resolve();
    const rawKey = this.key(scope, key), generation = this.currentGeneration, keyGeneration = this.keyGenerations.get(rawKey) ?? 0;
    const savedAtMs = this.now(), current = () => this.current(rawKey, generation, keyGeneration);
    return this.serial(undefined, async () => {
      if (!current()) return;
      const [id, scopeHash, keyHash, valueHash] = await Promise.all([
        this.sha256(rawKey), this.sha256(scope), this.sha256(key), this.sha256(valueJson),
      ]);
      const decoded: unknown = JSON.parse(valueJson);
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return;
      const header = JSON.stringify({ schema: 1, scope: scopeHash, key: keyHash, saved_at_ms: savedAtMs, sha256: valueHash });
      const bytes = new TextEncoder().encode(`{"value":${valueJson},\n${header.substring(1)}`);
      if (bytes.length > this.maxEntryBytes || !current()) return;
      if (this.needsClear) { await this.backend.clear(); if (!current()) return; this.needsClear = false; }
      await this.trim(id, bytes.length);
      if (current()) await this.backend.write(id, bytes, savedAtMs);
    });
  }
  private async decode(bytes: Uint8Array, scope: string, key: string): Promise<Record<string, unknown>> {
    if (bytes.length > this.maxEntryBytes) throw new Error('Oversized snapshot');
    const encoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes), prefix = '{"value":', boundary = encoded.lastIndexOf('\n');
    if (!encoded.startsWith(prefix) || boundary <= prefix.length || encoded[boundary - 1] !== ',') throw new Error('Invalid snapshot envelope');
    const header: unknown = JSON.parse(`{${encoded.substring(boundary + 1)}`);
    if (!header || typeof header !== 'object' || Array.isArray(header)) throw new Error('Invalid snapshot metadata');
    const fields = header as Record<string, unknown>;
    const [scopeHash, keyHash] = await Promise.all([this.sha256(scope), this.sha256(key)]);
    if (fields.schema !== 1 || fields.scope !== scopeHash || fields.key !== keyHash ||
        !Number.isInteger(fields.saved_at_ms) || typeof fields.sha256 !== 'string') throw new Error('Invalid snapshot metadata');
    const age = this.now() - (fields.saved_at_ms as number);
    if (age < 0 || age >= this.maxAgeMs) throw new Error('Expired snapshot');
    const valueJson = encoded.substring(prefix.length, boundary - 1);
    if (await this.sha256(valueJson) !== fields.sha256) throw new Error('Corrupt snapshot');
    const value: unknown = JSON.parse(valueJson);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Snapshot must be an object');
    return value as Record<string, unknown>;
  }
  private async trim(incomingId?: string, incomingBytes = 0): Promise<void> {
    const now = this.now(), entries = await this.backend.entries(), retained: ProductionSnapshotStoredEntry[] = [];
    for (const entry of entries) {
      const age = now - entry.savedAtMs;
      if (entry.bytes > this.maxEntryBytes || age < 0 || age >= this.maxAgeMs) await this.backend.remove(entry.id);
      else if (entry.id !== incomingId) retained.push(entry);
    }
    retained.sort((a, b) => a.savedAtMs - b.savedAtMs);
    let count = retained.length + (incomingId === undefined ? 0 : 1);
    let bytes = retained.reduce((sum, entry) => sum + entry.bytes, incomingBytes);
    for (const entry of retained) {
      if (count <= this.maxEntries && bytes <= this.maxTotalBytes) break;
      await this.backend.remove(entry.id); count--; bytes -= entry.bytes;
    }
  }
  remove(scope: string, key: string): Promise<void> {
    const rawKey = this.key(scope, key);
    if (!this.keyGenerations.has(rawKey) && this.keyGenerations.size >= this.maxEntries * 4) {
      this.currentGeneration++; this.keyGenerations.clear();
    }
    this.keyGenerations.set(rawKey, (this.keyGenerations.get(rawKey) ?? 0) + 1);
    return this.serial(undefined, async () => { await this.backend.remove(await this.sha256(rawKey)); });
  }
  clear(): Promise<void> {
    this.currentGeneration++; this.keyGenerations.clear(); this.needsClear = true;
    return this.serial(undefined, async () => { await this.backend.clear(); this.needsClear = false; });
  }
  flush(): Promise<void> { return this.tail; }
}

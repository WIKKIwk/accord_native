export type OrderImageDiskStore = {
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, bytes: Uint8Array): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
};
type Entry = { bytes: Uint8Array; etag: string | null; storedAt: number };
type ImageResponse = { status: number; bytes: Uint8Array; etag: string | null; cacheControl: string };
type LoadOptions = { key: string; thumbnail: boolean; immutable: boolean; isCurrent?: () => boolean;
  fetch: (etag: string | null) => Promise<ImageResponse> };

class DownloadPool {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly limit: number) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await task(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}

function encode(entry: Entry): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify({ etag: entry.etag, at: entry.storedAt }));
  const data = new Uint8Array(4 + header.length + entry.bytes.length);
  new DataView(data.buffer).setUint32(0, header.length);
  data.set(header, 4); data.set(entry.bytes, 4 + header.length);
  return data;
}
function decode(data: Uint8Array | null): Entry | null {
  if (!data || data.length < 5 || data.length > 9 * 1024 * 1024) return null;
  const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
  if (length > 4096 || 4 + length >= data.length) return null;
  const header: unknown = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + length)));
  if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
  const value = header as Record<string, unknown>;
  if (!Number.isInteger(value.at) || (value.etag != null && typeof value.etag !== 'string')) return null;
  return { bytes: data.subarray(4 + length), etag: value.etag as string | null, storedAt: value.at as number };
}
async function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('cache timeout')), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export class OrderImageCache {
  private memory = new Map<string, Entry>();
  private sourceDigests = new Map<string, string>();
  private inflight = new Map<string, Promise<Uint8Array | null>>();
  private missingUntil = new Map<string, number>();
  private thumbnails = new DownloadPool(4);
  private full = new DownloadPool(2);
  private generation = 0;
  constructor(private readonly disk: OrderImageDiskStore, private readonly digest: (key: string) => Promise<string>,
    private readonly now: () => number = Date.now, private readonly maxMemoryBytes = 24 * 1024 * 1024) {}

  async load(options: LoadOptions): Promise<Uint8Array | null> {
    const generation = this.generation;
    const key = await this.digest(options.key);
    if (generation !== this.generation || !(options.isCurrent?.() ?? true)) return null;
    this.sourceDigests.delete(options.key); this.sourceDigests.set(options.key, key);
    while (this.sourceDigests.size > 512) this.sourceDigests.delete(this.sourceDigests.keys().next().value!);
    if ((this.missingUntil.get(key) ?? 0) > this.now()) return null;
    this.missingUntil.delete(key);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const current = () => generation === this.generation && (options.isCurrent?.() ?? true);
    const pending = this.loadEntry(key, options, current).finally(() => {
      if (this.inflight.get(key) === pending) this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  peek(key: string, immutable: boolean, isCurrent?: () => boolean): Uint8Array | null {
    if (!(isCurrent?.() ?? true)) return null;
    const digest = this.sourceDigests.get(key);
    if (!digest || (this.missingUntil.get(digest) ?? 0) > this.now()) return null;
    const entry = this.memory.get(digest);
    if (!entry) return null;
    const age = this.now() - entry.storedAt, ttl = immutable ? 86_400_000 : 30_000;
    return age >= 0 && age < ttl ? entry.bytes : null;
  }

  private remember(key: string, entry: Entry): void {
    this.memory.delete(key); this.memory.set(key, entry);
    let size = [...this.memory.values()].reduce((sum, value) => sum + value.bytes.length, 0);
    while (size > this.maxMemoryBytes || this.memory.size > 256) {
      const oldest = this.memory.keys().next().value!;
      size -= this.memory.get(oldest)!.bytes.length; this.memory.delete(oldest);
    }
  }

  private async loadEntry(key: string, options: LoadOptions, current: () => boolean): Promise<Uint8Array | null> {
    let entry = this.memory.get(key) ?? null;
    this.memory.delete(key);
    if (!entry) {
      try { entry = decode(await timeout(this.disk.read(key), 250)); } catch { /* optional cache */ }
    }
    if (!current()) return null;
    const age = entry ? this.now() - entry.storedAt : -1, ttl = options.immutable ? 86_400_000 : 30_000;
    if (entry && age >= 0 && age < ttl) { this.remember(key, entry); return entry.bytes; }
    return (options.thumbnail ? this.thumbnails : this.full).run(async () => {
      if (!current()) return null;
      const response = await options.fetch(entry?.etag ?? null);
      if (!current()) return null;
      if ([401, 403, 404].includes(response.status)) {
        this.memory.delete(key);
        if (response.status === 404) {
          this.missingUntil.set(key, this.now() + 15_000);
          while (this.missingUntil.size > 512) this.missingUntil.delete(this.missingUntil.keys().next().value!);
        }
        try { await this.disk.remove(key); } catch { /* optional cache */ }
        return null;
      }
      let bytes: Uint8Array;
      if (response.status === 304 && entry) bytes = entry.bytes;
      else if (response.status === 200 && response.bytes.length) bytes = response.bytes;
      else throw new Error(`Order image HTTP ${response.status}`);
      const updated: Entry = { bytes, etag: response.etag ?? (response.status === 304 ? entry?.etag ?? null : null), storedAt: this.now() };
      if (response.cacheControl.toLowerCase().includes('no-store')) {
        this.memory.delete(key); try { await this.disk.remove(key); } catch { /* optional cache */ }
        return bytes;
      }
      if (current() && bytes.length <= 8 * 1024 * 1024) {
        this.remember(key, updated);
        void this.disk.write(key, encode(updated)).catch(() => {});
      }
      return bytes;
    });
  }

  async clear(): Promise<void> {
    this.generation++; this.inflight.clear(); this.memory.clear(); this.sourceDigests.clear(); this.missingUntil.clear();
    try { await timeout(this.disk.clear(), 2000); } catch { /* optional cache */ }
  }
}

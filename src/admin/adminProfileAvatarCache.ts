const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode(bytes: Uint8Array): string {
  const chunks: string[] = []; let part = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    part += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : alphabet[c & 63]);
    if (part.length >= 32768) { chunks.push(part); part = ''; }
  }
  chunks.push(part); return chunks.join('');
}
type Entry = { uri: string; size: number };
/** Completed public results only. No in-flight promise is shared between avatar owners. */
export class AdminProfileAvatarCache {
  private readonly values = new Map<string, Entry>(); private bytes = 0; private generation = 0;
  constructor(private readonly maxEntries = 1000, private readonly maxBytes = 100 * 1024 * 1024) {}
  get revision(): number { return this.generation; }
  private key(scope: string, url: string): string { return JSON.stringify([scope, url]); }
  get(scope: string, url: string): string | null {
    const key = this.key(scope, url), value = this.values.get(key); if (!value) return null;
    this.values.delete(key); this.values.set(key, value); return value.uri;
  }
  remember(scope: string, url: string, data: Uint8Array, mime: string, revision: number): string | null {
    if (revision !== this.generation || !data.length) return null;
    const uri = `data:${/^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : 'image/jpeg'};base64,${encode(data)}`;
    const key = this.key(scope, url); this.forget(scope, url);
    // Entry budget matches Flutter's default counts/bytes; this cache counts encoded URI storage,
    // while Flutter's ImageCache accounts decoded images. Active views may still display oversize images.
    const size = uri.length * 2;
    if (this.maxEntries > 0 && size <= this.maxBytes) {
      while (this.values.size >= this.maxEntries || this.bytes + size > this.maxBytes) {
        const oldest = this.values.keys().next().value; if (oldest === undefined) break;
        this.bytes -= this.values.get(oldest)!.size; this.values.delete(oldest);
      }
      this.values.set(key, { uri, size }); this.bytes += size;
    }
    return uri;
  }
  forget(scope: string, url: string, expected?: string): void {
    const key = this.key(scope, url), value = this.values.get(key);
    if (value && (expected === undefined || value.uri === expected)) { this.bytes -= value.size; this.values.delete(key); }
  }
  clear(): void { this.generation++; this.bytes = 0; this.values.clear(); }
}

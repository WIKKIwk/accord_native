import { isProfileSessionCurrent, type ProfileSessionGuard } from './profileSessionGuard';
type Account = { baseUrl: string; profile: Record<string, unknown> };
type Cached = { url: string; uri: string };
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encode(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    result += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) +
      (c === undefined ? '=' : alphabet[c & 63]);
  }
  return result;
}

/** @v2 ProfileAvatarCache */
export class ProfileAvatarCache {
  private readonly values = new Map<string, Cached>();
  private readonly inflight = new Map<string, Promise<string | null>>();
  private generation = 0;
  private key(account: Account): string {
    return JSON.stringify([account.baseUrl, account.profile.role, account.profile.ref]);
  }
  private url(account: Account): string { return String(account.profile.avatar_url ?? '').trim(); }
  get(account: Account): string | null {
    const value = this.values.get(this.key(account));
    return value?.url === this.url(account) ? value.uri : null;
  }
  remember(account: Account, bytes: Uint8Array, mime = 'image/jpeg'): string | null {
    if (!String(account.profile.ref ?? '').trim() || !bytes.length) return null;
    const safeMime = /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : 'image/jpeg';
    const uri = `data:${safeMime};base64,${encode(bytes)}`;
    this.values.set(this.key(account), { url: this.url(account), uri });
    return uri;
  }
  async refresh(account: Account, download: () => Promise<{ bytes: Uint8Array; mime?: string } | null>, isCurrent?: ProfileSessionGuard): Promise<string | null> {
    if (!this.url(account)) return null;
    const generation = this.generation;
    try {
      const image = await download();
      if (generation !== this.generation || !isProfileSessionCurrent(isCurrent)) return null;
      return image ? this.remember(account, image.bytes, image.mime) ?? this.get(account) : this.get(account);
    } catch { return isProfileSessionCurrent(isCurrent) ? this.get(account) : null; }
  }
  async ensure(account: Account, download: () => Promise<{ bytes: Uint8Array; mime?: string } | null>): Promise<string | null> {
    if (!this.url(account)) return null;
    const existing = this.get(account);
    if (existing) return existing;
    const key = `${this.key(account)}|${this.url(account)}`;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const request = this.refresh(account, download);
    this.inflight.set(key, request);
    try { return await request; }
    finally { if (this.inflight.get(key) === request) this.inflight.delete(key); }
  }
  clear(): void { this.generation++; this.values.clear(); this.inflight.clear(); }
}

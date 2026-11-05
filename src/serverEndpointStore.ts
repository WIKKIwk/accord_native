import type { AccountStorage } from './savedAccountStore';

export const DEFAULT_SERVER_URL = 'https://mini-rs-erp-test.wspace.sbs';
const activeKey = 'active_server_endpoint';
const savedKey = 'saved_server_endpoints_v1';
export type SavedServerEndpoint = { base_url: string; last_used_at: string };

export function normalizeServerEndpoint(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (!value.includes('://')) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash ||
        (url.pathname !== '/' && url.pathname !== '')) return null;
    return url.origin;
  } catch { return null; }
}

export class ServerEndpointStore {
  private active: string;
  private runtimeOverride = false;
  private readonly saved = new Map<string, SavedServerEndpoint>();

  constructor(private readonly preferences: AccountStorage, private readonly compiledBaseUrl = DEFAULT_SERVER_URL) {
    const initial = normalizeServerEndpoint(compiledBaseUrl);
    if (!initial) throw new TypeError('MOBILE_API_BASE_URL must use HTTPS');
    this.active = initial;
  }

  get baseUrl(): string { return this.active; }
  get isRuntimeOverride(): boolean { return this.runtimeOverride; }
  get savedEndpoints(): SavedServerEndpoint[] { return [...this.saved.values()].sort((a, b) => b.last_used_at.localeCompare(a.last_used_at)); }

  async load(): Promise<void> {
    this.saved.clear();
    const encoded = await this.preferences.getItem(savedKey);
    if (encoded?.trim()) {
      try {
        const entries: unknown = JSON.parse(encoded);
        if (Array.isArray(entries)) for (const raw of entries) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
          const value = raw as Record<string, unknown>;
          const base = normalizeServerEndpoint(value.base_url == null ? '' : String(value.base_url));
          const time = Date.parse(value.last_used_at == null ? '' : String(value.last_used_at));
          if (base && !Number.isNaN(time)) this.saved.set(base, { base_url: base, last_used_at: new Date(time).toISOString() });
        }
      } catch { /* Ignore invalid saved endpoint metadata. */ }
    }
    const stored = normalizeServerEndpoint((await this.preferences.getItem(activeKey)) ?? '');
    if (stored == null) {
      await this.preferences.removeItem(activeKey);
      this.active = normalizeServerEndpoint(this.compiledBaseUrl)!;
      this.runtimeOverride = false;
    } else {
      this.active = stored;
      this.runtimeOverride = true;
    }
    this.upsert(this.active, false);
    await this.persistSaved();
  }

  async saveEndpoint(raw: string): Promise<SavedServerEndpoint> {
    const normalized = this.required(raw);
    const endpoint = this.upsert(normalized, false);
    await this.persistSaved();
    return endpoint;
  }

  async setBaseUrl(raw: string): Promise<string> {
    const normalized = this.required(raw);
    this.active = normalized;
    this.runtimeOverride = true;
    await this.preferences.setItem(activeKey, normalized);
    this.upsert(normalized, true);
    await this.persistSaved();
    return normalized;
  }

  async clearOverride(): Promise<void> {
    this.active = normalizeServerEndpoint(this.compiledBaseUrl)!;
    this.runtimeOverride = false;
    await this.preferences.removeItem(activeKey);
    this.upsert(this.active, false);
    await this.persistSaved();
  }

  private required(raw: string): string {
    const value = normalizeServerEndpoint(raw);
    if (!value) throw new TypeError('Serverning HTTPS manzilini path/query siz kiriting');
    return value;
  }
  private upsert(base: string, touch: boolean): SavedServerEndpoint {
    const existing = this.saved.get(base);
    if (existing && !touch) return existing;
    const endpoint = { base_url: base, last_used_at: new Date().toISOString() };
    this.saved.set(base, endpoint);
    return endpoint;
  }
  private async persistSaved(): Promise<void> { await this.preferences.setItem(savedKey, JSON.stringify(this.savedEndpoints)); }
}

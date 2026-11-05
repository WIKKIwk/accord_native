type Profile = Record<string, unknown>;

export interface AccountStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SavedAccount {
  id: string;
  base_url: string;
  profile: Profile;
  last_used_at: string;
}

export interface SavedAccountSession {
  account: SavedAccount;
  token: string;
  phone: string;
  code: string;
}

const accountsKey = 'saved_accounts_v1';
const activeKey = 'saved_accounts_active_id_v1';
const pendingKey = 'saved_account_pending_secret_deletions_v1';
const object = (value: unknown): Profile | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Profile : null;

function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new TypeError('Saved account endpoint must be an HTTPS origin'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')) throw new TypeError('Saved account endpoint must be an HTTPS origin');
  return url.origin;
}

export function savedAccountId(baseUrl: string, profile: Profile): string {
  const role = typeof profile.role === 'string' ? profile.role : '';
  const ref = typeof profile.ref === 'string' ? profile.ref.trim() : '';
  if (!role || !ref) throw new TypeError('Saved account profile is invalid');
  return `${normalizeBaseUrl(baseUrl)}|${role}|${ref}`;
}

function accountFromJson(raw: unknown): SavedAccount {
  const value = object(raw), profile = object(value?.profile);
  if (!value || !profile || typeof value.base_url !== 'string' || typeof value.last_used_at !== 'string') {
    throw new TypeError('Saved account is invalid');
  }
  const base = normalizeBaseUrl(value.base_url), id = savedAccountId(base, profile);
  if (value.id != null && String(value.id).trim() && String(value.id).trim() !== id) throw new TypeError('Saved account id is invalid');
  const time = Date.parse(value.last_used_at);
  if (Number.isNaN(time)) throw new TypeError('Saved account date is invalid');
  return { id, base_url: base, profile, last_used_at: new Date(time).toISOString() };
}

export class SavedAccountStore {
  private readonly values = new Map<string, SavedAccount>();
  private activeId: string | null = null;
  private operationInProgress = false;

  constructor(private readonly preferences: AccountStorage, private readonly secrets: AccountStorage,
    private readonly sha256: (value: string) => Promise<string>) {}

  get activeAccountId(): string | null { return this.activeId; }
  get accounts(): SavedAccount[] { return [...this.values.values()].sort((a, b) => b.last_used_at.localeCompare(a.last_used_at)); }

  async runAccountOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.operationInProgress) throw new Error('An account operation is already in progress');
    this.operationInProgress = true;
    try { return await operation(); } finally { this.operationInProgress = false; }
  }

  async load(): Promise<void> {
    this.values.clear();
    const encoded = await this.preferences.getItem(accountsKey);
    if (encoded?.trim()) {
      try {
        const rows: unknown = JSON.parse(encoded);
        if (Array.isArray(rows)) for (const row of rows) {
          try { const account = accountFromJson(row); this.values.set(account.id, account); } catch { /* Skip invalid rows. */ }
        }
      } catch { /* Ignore malformed stored metadata. */ }
    }
    const active = (await this.preferences.getItem(activeKey))?.trim() ?? '';
    this.activeId = this.values.has(active) ? active : null;
    await this.retryPendingSecretDeletions();
  }

  accountsForEndpoint(baseUrl: string): SavedAccount[] {
    const normalized = normalizeBaseUrl(baseUrl);
    return this.accounts.filter(account => account.base_url === normalized);
  }

  async upsertAuthenticated(input: { baseUrl: string; profile: Profile; token: string; phone: string; code: string;
    makeActive: boolean; lastUsedAt?: Date }): Promise<SavedAccount> {
    const base = normalizeBaseUrl(input.baseUrl), id = savedAccountId(base, input.profile), token = input.token.trim();
    if (!token) throw new TypeError('Saved account token is empty');
    const account: SavedAccount = { id, base_url: base, profile: input.profile,
      last_used_at: (input.lastUsedAt ?? new Date()).toISOString() };
    const key = await this.secretKey(id), previousSecret = await this.secrets.getItem(key);
    const previousAccount = this.values.get(id), previousActive = this.activeId;
    await this.secrets.setItem(key, JSON.stringify({ token, phone: input.phone.trim(), code: input.code.trim() }));
    this.values.set(id, account);
    if (input.makeActive) this.activeId = id;
    try { await this.persistMetadata(); }
    catch (error) {
      if (previousAccount) this.values.set(id, previousAccount); else this.values.delete(id);
      this.activeId = previousActive;
      const failures: unknown[] = [];
      try { await this.persistMetadata(); } catch (failure) { failures.push(failure); }
      try {
        if (previousSecret == null) await this.secrets.removeItem(key);
        else await this.secrets.setItem(key, previousSecret);
      } catch (failure) { failures.push(failure); }
      if (failures.length) throw new Error(`Saved account upsert failed and rollback was incomplete: ${String(error)}; ${failures.map(String).join('; ')}`);
      throw error;
    }
    return account;
  }

  async sessionFor(id: string): Promise<SavedAccountSession | null> {
    const account = this.values.get(id);
    if (!account) return null;
    const encoded = await this.secrets.getItem(await this.secretKey(id));
    if (!encoded?.trim()) return null;
    try {
      const data = object(JSON.parse(encoded));
      const token = data?.token == null ? '' : String(data.token).trim();
      if (!token) return null;
      return { account, token, phone: data?.phone == null ? '' : String(data.phone).trim(), code: data?.code == null ? '' : String(data.code).trim() };
    } catch { return null; }
  }

  async activate(id: string, usedAt = new Date()): Promise<void> {
    const account = this.values.get(id);
    if (!account) throw new TypeError('Saved account does not exist');
    const previousActive = this.activeId;
    this.values.set(id, { ...account, last_used_at: usedAt.toISOString() });
    this.activeId = id;
    try { await this.persistMetadata(); }
    catch (error) {
      this.values.set(id, account);
      this.activeId = previousActive;
      await this.rollbackMetadata(error);
    }
  }

  async clearActive(): Promise<void> {
    const previous = this.activeId;
    if (previous == null) return;
    this.activeId = null;
    try { await this.persistMetadata(); }
    catch (error) { this.activeId = previous; await this.rollbackMetadata(error); }
  }

  async updateProfile(id: string, profile: Profile): Promise<void> {
    const account = this.values.get(id);
    if (!account || savedAccountId(account.base_url, profile) !== id) throw new TypeError('Saved account identity changed');
    this.values.set(id, { ...account, profile });
    try { await this.persistMetadata(); }
    catch (error) { this.values.set(id, account); await this.rollbackMetadata(error); }
  }

  async remove(id: string): Promise<void> {
    const account = this.values.get(id);
    if (!account) return;
    const previousActive = this.activeId, key = await this.secretKey(id);
    this.values.delete(id);
    if (this.activeId === id) this.activeId = null;
    try { await this.persistMetadata(); }
    catch (error) {
      this.values.set(id, account);
      this.activeId = previousActive;
      const failures: unknown[] = [];
      try { await this.persistMetadata(); } catch (failure) { failures.push(failure); }
      try { await this.secrets.removeItem(key); } catch (failure) { failures.push(failure); }
      if (failures.length) throw new Error(`Saved account removal failed and cleanup was incomplete: ${String(error)}; ${failures.map(String).join('; ')}`);
      throw error;
    }
    try { await this.secrets.removeItem(key); }
    catch {
      try { const pending = await this.pendingDeletions(); pending[id] = key; await this.savePendingDeletions(pending); }
      catch { /* Metadata is already disconnected from the secret. */ }
    }
  }

  private async secretKey(id: string): Promise<string> { return `saved_account_secret_v1:${await this.sha256(id)}`; }
  private async persistMetadata(): Promise<void> {
    await this.preferences.setItem(accountsKey, JSON.stringify(this.accounts));
    if (this.activeId == null) await this.preferences.removeItem(activeKey);
    else await this.preferences.setItem(activeKey, this.activeId);
  }
  private async rollbackMetadata(error: unknown): Promise<never> {
    try { await this.persistMetadata(); }
    catch (failure) { throw new Error(`Saved account metadata rollback failed after ${String(error)}: ${String(failure)}`); }
    throw error;
  }
  private async pendingDeletions(): Promise<Record<string, string>> {
    const raw = await this.preferences.getItem(pendingKey);
    try {
      const parsed = object(raw ? JSON.parse(raw) : null);
      return Object.fromEntries(Object.entries(parsed ?? {}).map(([key, value]) => [key, String(value)])
        .filter(([key, value]) => key.trim() && value.trim()));
    } catch { return {}; }
  }
  private async savePendingDeletions(pending: Record<string, string>): Promise<void> {
    if (!Object.keys(pending).length) await this.preferences.removeItem(pendingKey);
    else await this.preferences.setItem(pendingKey, JSON.stringify(pending));
  }
  private async retryPendingSecretDeletions(): Promise<void> {
    const pending = await this.pendingDeletions();
    let changed = false;
    for (const [id, key] of Object.entries(pending)) {
      if (this.values.has(id)) continue;
      try { await this.secrets.removeItem(key); delete pending[id]; changed = true; } catch { /* Retry on a later load. */ }
    }
    if (changed) await this.savePendingDeletions(pending);
  }
}

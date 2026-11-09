import { savedAccountId, type SavedAccountSession, type SavedAccountStore } from '../savedAccountStore';

type Profile = Record<string, unknown>;
type SwitchInput = { baseUrl: string; profile: Profile; token: string; phone: string; code: string;
  werkaHomeBootstrap?: Record<string, unknown> | null };
type RefreshedAccount = { token: string; profile: Profile; werkaHomeBootstrap?: Record<string, unknown> | null };
export interface AccountSwitchEnvironment {
  /** Optional observer for clients that must invalidate work from the old account immediately. */
  beginSessionTransition?(): () => void;
  current(): { token: string; profile: Profile } | null;
  snapshot(): unknown;
  restore(snapshot: unknown): Promise<void>;
  activate(session: SavedAccountSession, werkaHomeBootstrap?: Record<string, unknown> | null): Promise<void>;
  clear(): Promise<void>;
  reauthenticate?(session: SavedAccountSession): Promise<RefreshedAccount>;
  unregisterCurrentPush?(): Promise<void>;
  syncCurrentPush?(): Promise<void>;
  unlockAfterSwitch?(): Promise<void>;
  logoutSavedSession?(session: SavedAccountSession): Promise<void>;
  clearAfterLogout?(): Promise<void>;
}
const operations = new WeakSet<SavedAccountStore>();
async function bestEffort(action?: () => Promise<void>) {
  if (action) try { await action(); } catch { /* V2 treats these hooks as best effort. */ }
}

/** @v2 AccountSwitchController */
export class AccountSwitchController {
  constructor(private readonly store: SavedAccountStore, private readonly environment: AccountSwitchEnvironment) {}
  get switching(): boolean { return operations.has(this.store); }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    const endTransition = this.environment.beginSessionTransition?.();
    try {
      const pending = this.store.runAccountOperation(async () => {
        operations.add(this.store);
        try { return await action(); } finally { operations.delete(this.store); }
      });
      if (endTransition) void pending.then(endTransition, endTransition);
      return pending;
    } catch (error) { endTransition?.(); throw error; }
  }

  async addAndSwitch(input: SwitchInput): Promise<Profile> {
    return this.exclusive(async () => {
      const saved = await this.store.upsertAuthenticated({ ...input, makeActive: false });
      return this.switchUnlocked(saved.id, false, input.werkaHomeBootstrap);
    });
  }

  async switchTo(accountId: string): Promise<Profile> {
    return this.exclusive(() => this.switchUnlocked(accountId, true));
  }

  private async switchUnlocked(accountId: string, reauthenticate: boolean,
    bootstrap?: Record<string, unknown> | null): Promise<Profile> {
    let target = await this.store.sessionFor(accountId);
    if (!target) throw new Error('Saved account session is unavailable');
    const previousId = this.store.activeAccountId, current = this.environment.current();
    if (previousId === accountId && current && current.token === target.token && current.profile.ref === target.account.profile.ref) {
      return target.account.profile;
    }
    if (reauthenticate && this.environment.reauthenticate) {
      const refreshed = await this.environment.reauthenticate(target);
      if (savedAccountId(target.account.base_url, refreshed.profile) !== accountId) throw new Error('Refreshed account identity does not match target');
      const account = await this.store.upsertAuthenticated({ baseUrl: target.account.base_url, profile: refreshed.profile,
        token: refreshed.token, phone: target.phone, code: target.code, makeActive: false });
      target = { account, token: refreshed.token, phone: target.phone, code: target.code };
      bootstrap = refreshed.werkaHomeBootstrap;
    }
    const snapshot = this.environment.snapshot();
    try {
      await bestEffort(() => this.environment.unregisterCurrentPush?.() ?? Promise.resolve());
      await this.store.activate(accountId);
      await this.environment.activate(target, bootstrap);
      await bestEffort(() => this.environment.unlockAfterSwitch?.() ?? Promise.resolve());
      await bestEffort(() => this.environment.syncCurrentPush?.() ?? Promise.resolve());
      return target.account.profile;
    } catch (error) {
      const failures: unknown[] = [];
      try {
        if (previousId == null) await this.store.clearActive();
        else if (this.store.activeAccountId !== previousId) await this.store.activate(previousId);
      } catch (failure) { failures.push(failure); }
      try { await this.environment.restore(snapshot); } catch (failure) { failures.push(failure); }
      if (failures.length) throw new Error(`Account switch failed and rollback was incomplete: ${String(error)}; ${failures.map(String).join('; ')}`);
      throw error;
    }
  }

  async logoutCurrent(): Promise<void> {
    await this.exclusive(async () => {
      let operationError: unknown;
      try {
        const id = this.store.activeAccountId, saved = id == null ? null : await this.store.sessionFor(id);
        await bestEffort(() => this.environment.unregisterCurrentPush?.() ?? Promise.resolve());
        if (saved) await bestEffort(() => this.environment.logoutSavedSession?.(saved) ?? Promise.resolve());
        if (id != null) await this.store.remove(id);
      } catch (error) { operationError = error; }
      await bestEffort(() => this.environment.clearAfterLogout?.() ?? Promise.resolve());
      try { await this.environment.clear(); }
      catch (error) {
        if (operationError === undefined) throw error;
        throw new Error(`Logout failed and AppSession cleanup also failed: ${String(operationError)}; ${String(error)}`);
      }
      if (operationError !== undefined) throw operationError;
    });
  }
}

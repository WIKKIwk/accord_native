import type { AccountStorage } from '../savedAccountStore';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminUserKinds, type AdminUserKind } from './adminUsersModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 AdminUsersRoleStore.preferenceKey; source deliberately keeps a cross-profile default selection. */
export function adminUsersRolePreferenceKey(profileRef = ''): string {
  return `admin.users.selected_role.${dartTrim(profileRef) || 'default'}`;
}
/** @v2 AdminUsersRoleStore.parseKind; stored enum names differ from wire role names. */
export function parseAdminUserKind(value: string | null): AdminUserKind | null {
  if (value === null) return null;
  const normalized = dartPartialLower(dartTrim(value));
  return adminUserKinds.find(kind => dartPartialLower(kind) === normalized) ?? null;
}

/** @v2 AdminUsersRoleStore; pending I/O retains its original captured profile and guard. */
export class AdminUsersRoleStore {
  private cached: AdminUserKind | null = null;
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly storage: AccountStorage) {}
  get cachedRole(): AdminUserKind | null { return this.cached; }
  clearCache(): void { this.cached = null; this.generation++; }
  /** Retire pending operations on a runtime reset without deleting V2's remembered choice. */
  invalidatePending(): void { this.generation++; }
  private check(generation: number, guard?: () => void): void {
    if (generation !== this.generation) throw new Error('Admin users selection changed');
    guard?.();
    if (generation !== this.generation) throw new Error('Admin users selection changed');
  }
  async loadSavedRole(profileRef = '', guard?: () => void): Promise<AdminUserKind | null> {
    const check = checkedAdminGuard(guard), generation = this.generation;
    const ref = dartTrim(profileRef); this.check(generation, check);
    try {
      let raw = await this.storage.getItem(adminUsersRolePreferenceKey(ref)); this.check(generation, check);
      if ((raw === null || !dartTrim(raw)) && ref) {
        raw = await this.storage.getItem(adminUsersRolePreferenceKey('default')); this.check(generation, check);
      }
      const kind = parseAdminUserKind(raw);
      this.check(generation, check);
      if (kind !== null) this.cached = kind;
      return this.cached;
    } catch { this.check(generation, check); return this.cached; }
  }
  async saveRole(kind: AdminUserKind, profileRef = '', guard?: () => void): Promise<void> {
    const check = checkedAdminGuard(guard); check?.();
    if (!adminUserKinds.includes(kind)) throw new TypeError('Invalid admin user kind');
    const ref = dartTrim(profileRef), generation = ++this.generation;
    this.cached = kind;
    const write = this.writes.then(async () => {
      this.check(generation, check);
      try {
        await this.storage.setItem(adminUsersRolePreferenceKey(ref), kind); this.check(generation, check);
        await this.storage.setItem(adminUsersRolePreferenceKey('default'), kind); this.check(generation, check);
      } catch { this.check(generation, check); }
    });
    this.writes = write.then(() => {}, () => {});
    await write;
  }
}

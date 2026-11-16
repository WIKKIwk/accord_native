import type { AdminRoleAssignment, AdminUserKind, AdminUserListEntry } from './adminUsersModel';

export type AdminUsersCacheEntry = Readonly<{ readScope: string; revision: number; items: readonly AdminUserListEntry[];
  assignments: readonly AdminRoleAssignment[]; has_more: boolean; offset: number; query: string; selectedKind: AdminUserKind | null }>;
/** @v2 _AdminSuppliersCache, _restoreCache, _saveCache and _usersChanged. One scoped snapshot, no disk data cache. */
export class AdminUsersCache {
  private entry: AdminUsersCacheEntry | null = null;
  private readonly listeners = new Set<() => void>();
  read(readScope: string, revision: number): AdminUsersCacheEntry | null {
    if (this.entry && (this.entry.readScope !== readScope || this.entry.revision !== revision)) this.entry = null;
    return this.entry;
  }
  save(entry: AdminUsersCacheEntry, guard: () => void): void {
    guard();
    const value = Object.freeze({ ...entry, items: Object.freeze([...entry.items]), assignments: Object.freeze([...entry.assignments]) });
    guard(); this.entry = value;
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  invalidate(): void {
    this.entry = null;
    for (const listener of [...this.listeners]) listener();
  }
}

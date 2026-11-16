import type { AccountStorage } from '../savedAccountStore';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 AdminWarehouseFilterStore.preferenceKey */
export function adminWarehouseFilterPreferenceKey(profileRef: string): string {
  return `admin.warehouses.selected_warehouse.${dartTrim(profileRef) || 'default'}`;
}
export type AdminWarehouseFilterMemory = { warehouse: string | null; revision: number };
export type AdminWarehouseFilterWriteQueue = { pending: Promise<void> };
export type AdminWarehouseFilterSharedState = { memory: AdminWarehouseFilterMemory; queue: AdminWarehouseFilterWriteQueue };
/** One original Warehouse owner. Saved ref/default keys remain compatible with V2. */
export class AdminWarehouseFilterStore {
  private readonly shared: AdminWarehouseFilterSharedState;
  constructor(private readonly storage: AccountStorage, private readonly profileRef: string, private readonly isCurrent: () => boolean, shared?: AdminWarehouseFilterSharedState) {
    this.shared = shared ?? { memory: { warehouse: null, revision: 0 }, queue: { pending: Promise.resolve() } };
  }
  get cachedWarehouse(): string | null { return this.shared.memory.warehouse; }
  private current(operation: () => boolean): boolean {
    return isSynchronouslyTrue(this.isCurrent) && isSynchronouslyTrue(operation) && isSynchronouslyTrue(this.isCurrent);
  }
  async loadSavedWarehouse(operation: () => boolean = this.isCurrent): Promise<string | null> {
    const memory = this.shared.memory, revision = memory.revision;
    if (!this.current(operation)) return null;
    try {
      let saved = await this.storage.getItem(adminWarehouseFilterPreferenceKey(this.profileRef));
      if (!this.current(operation)) return null;
      if (!dartTrim(saved ?? '') && dartTrim(this.profileRef)) {
        saved = await this.storage.getItem(adminWarehouseFilterPreferenceKey('default'));
        if (!this.current(operation)) return null;
      }
      if (revision !== memory.revision) return memory.warehouse;
      const normalized = dartTrim(saved ?? ''); if (normalized) memory.warehouse = normalized;
    } catch { if (!this.current(operation)) return null; }
    return memory.warehouse;
  }
  saveWarehouse(warehouse: string, operation: () => boolean = this.isCurrent): Promise<void> {
    if (!this.current(operation)) return Promise.resolve();
    const memory = this.shared.memory, normalized = dartTrim(warehouse), revision = ++memory.revision; memory.warehouse = normalized || null;
    const valid = () => revision === memory.revision && this.current(operation);
    const write = async () => {
      try {
        for (const key of [adminWarehouseFilterPreferenceKey(this.profileRef), adminWarehouseFilterPreferenceKey('default')]) {
          if (!valid()) return;
          if (normalized) await this.storage.setItem(key, normalized); else await this.storage.removeItem(key);
          if (!valid()) return;
        }
      } catch { /* V2 keeps the in-memory preference if local storage fails. */ }
    };
    const pending = this.shared.queue.pending.then(write, write); this.shared.queue.pending = pending; return pending;
  }
  resolveWarehouse(warehouses: Iterable<string>, preferred?: string | null): string | null {
    const target = dartPartialLower(dartTrim(preferred ?? this.cachedWarehouse ?? '')); if (!target) return null;
    for (const warehouse of warehouses) if (dartPartialLower(dartTrim(warehouse)) === target) return dartTrim(warehouse);
    return null;
  }
  clearCache(operation: () => boolean = this.isCurrent): void { if (this.current(operation)) { this.shared.memory.revision++; this.shared.memory.warehouse = null; } }
}

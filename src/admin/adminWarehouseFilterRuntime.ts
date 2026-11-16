import { registerSessionResetHook } from '../auth';
import type { AccountStorage } from '../savedAccountStore';
import type { AdminWarehouseFilterMemory, AdminWarehouseFilterSharedState, AdminWarehouseFilterWriteQueue } from './adminWarehouseFilterStore';

let caches = new WeakMap<AccountStorage, Map<string, AdminWarehouseFilterMemory>>();
const memories = new Set<AdminWarehouseFilterMemory>();
// A reset invalidates warm data, but never lets a newer owner's write overtake an older in-flight write.
const queues = new WeakMap<AccountStorage, AdminWarehouseFilterWriteQueue>();
let registered = false;

/** Same storage + original read scope can reuse V2's warm selection on screen re-entry. */
export function adminWarehouseFilterRuntime(storage: AccountStorage, scope: string): AdminWarehouseFilterSharedState {
  if (!registered) {
    registered = true;
    registerSessionResetHook(async () => {
      for (const memory of memories) { memory.revision++; memory.warehouse = null; }
      memories.clear(); caches = new WeakMap();
    });
  }
  let byScope = caches.get(storage); if (!byScope) { byScope = new Map(); caches.set(storage, byScope); }
  let memory = byScope.get(scope); if (!memory) { memory = { warehouse: null, revision: 0 }; byScope.set(scope, memory); memories.add(memory); }
  let queue = queues.get(storage); if (!queue) { queue = { pending: Promise.resolve() }; queues.set(storage, queue); }
  return { memory, queue };
}

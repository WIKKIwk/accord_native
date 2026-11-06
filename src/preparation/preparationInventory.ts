import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { inventoryViewRuntimeFor } from '../shared/inventoryViewRuntime';
import type { InventoryViewStore } from '../shared/inventoryViewStore';

/** Reuse the shared inventory live windows for the preparation movements route. */
export function preparationInventoryStore(session: Session): InventoryViewStore {
  if (session.profile.role !== 'tayyorlov_masteri' || !canOpenRoute(session, appRoutes.inventoryMovements))
    throw new Error('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.');
  return inventoryViewRuntimeFor(session);
}

export function preparationInventoryAssets(store: InventoryViewStore, warehouseId: string, query: string) {
  return store.assets({ warehouseId, query, assetKind: 'raw_material', includeOrderAssignment: true });
}

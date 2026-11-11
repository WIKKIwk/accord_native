import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, sessionWitnessVersion, subscribeSessionWitness, type Session } from '../auth';
import { appPreferences } from '../appPreferences';
import { inventoryAssets } from '../inventoryReadApi';
import { inventoryRelocate } from '../inventoryRelocateApi';
import { sessionReadScope } from '../sessionReadScope';
import { inventoryCreateTransfer } from '../preparation/preparationInventoryTransfers';
import { inventoryViewRuntimeFor } from '../shared/inventoryViewRuntime';
import { InventoryMovementController } from '../shared/inventoryMovementController';
import { inventoryRelocateBatch } from '../shared/inventoryMovementApi';
import { movementIdempotencyKey } from '../shared/inventoryMovementModel';

export function useWorkerInventoryKey(session: Session) {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return JSON.stringify([sessionReadScope(session), version]);
}

export function useWorkerInventory(session: Session) {
  const scope = sessionReadScope(session);
  const owner = useMemo(() => {
    const witness = captureSessionWitness(session);
    const current = () => !!activeSessionToken(session) && sessionReadScope(session) === scope && isSessionWitnessCurrent(witness) && session.capabilities.includes('inventory.movement.manage');
    const assertCurrent = () => { if (!current()) throw new Error('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.'); };
    const store = inventoryViewRuntimeFor(session);
    const preference = `inventory_movements.selected_warehouse.${String(session.profile.ref ?? '').trim() || 'default'}`;
    return new InventoryMovementController(session, { store, current,
      restore: () => appPreferences.getItem(preference), save: value => appPreferences.setItem(preference, value),
      lookup: barcode => { assertCurrent(); return inventoryAssets(session, { query: barcode, limit: 100 }); },
      relocate: (asset, location, key) => { assertCurrent(); return inventoryRelocate(session, { asset_kind: asset.kind as 'raw_material' | 'finished_goods' | 'qolip', asset_ref: asset.asset_ref, physical_location_id: location.id, idempotency_key: key }); },
      relocateBatch: (assets, location, key) => inventoryRelocateBatch(session, { assets, physicalLocationId: location.id, idempotencyKey: key }, assertCurrent),
      transfer: (asset, location, key) => inventoryCreateTransfer(session, { sourceWarehouseId: asset.custody_warehouse_id,
        destinationWarehouseId: location.warehouse_id, assets: [asset], idempotencyKey: key }, assertCurrent),
      key: movementIdempotencyKey,
    });
  }, [session, scope]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useEffect(() => {
    const store = owner.dependencies.store;
    store.configure(AppState.currentState == null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', value => store.configure(value === 'active'));
    owner.mount();
    return () => { subscription.remove(); owner.unmount(); };
  }, [owner]);
  return { owner, state, scope, valid: owner.current() };
}

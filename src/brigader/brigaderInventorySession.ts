import { activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { appPreferences } from '../appPreferences';
import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import { inventoryAssets, inventoryLocations, inventoryTransfers, type InventoryAssetsOptions } from '../inventoryReadApi';
import { inventoryRelocate } from '../inventoryRelocateApi';
import { inventoryCreateTransfer } from '../preparation/preparationInventoryTransfers';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { InventoryMovementController } from '../shared/inventoryMovementController';
import { inventoryRelocateBatch } from '../shared/inventoryMovementApi';
import { InventoryViewStore } from '../shared/inventoryViewStore';
import { brigaderMayEnter } from './brigaderAccess';
import { subscribeBrigaderInventoryLive } from './brigaderInventoryLive';

/** Brigader is an Admin-component user in V2; no synthetic admin role/grant is added. */
export function createBrigaderInventorySession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; }
    checking = true;
    try {
      const original = () => witness.session === session && isSessionWitnessCurrent(witness) && !!activeSessionToken(session) &&
        sessionReadScope(session) === scope && brigaderMayEnter(session) && canOpenRoute(session, appRoutes.inventoryMovements);
      if (!original() || !isSynchronouslyTrue(isCurrent) || !original()) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const guard = () => { if (!current()) throw new Error('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.'); };
  const store = new InventoryViewStore({
    scopeReader: () => current() ? scope : `${scope}:expired`, tokenReader: () => current() ? activeSessionToken(session) : null,
    liveEnabled: current,
    snapshotLoader: async query => {
      guard(); const p = query.parameters;
      if (query.kind === 'locations') return inventoryLocations(session, guard, current);
      if (query.kind === 'assets') return inventoryAssets(session, { warehouse_id: p.warehouse_id, query: p.query,
        asset_kind: p.asset_kind as InventoryAssetsOptions['asset_kind'], current_user_states_only: p.current_user_states_only === 'true',
        include_order_assignment: p.include_order_assignment === 'true', limit: Number(p.limit), offset: Number(p.offset ?? 0) }, guard, current);
      return inventoryTransfers(session, { direction: p.direction, status: p.status, limit: Number(p.limit), offset: Number(p.offset ?? 0) }, guard, current);
    },
    liveLoader: (query, version, handlers) => { guard(); return subscribeBrigaderInventoryLive(session, query, version, current, handlers); },
  });
  const preference = `inventory_movements.selected_warehouse.${String(session.profile.ref ?? '').trim() || 'default'}`;
  const owner = new InventoryMovementController(session, { store, current,
    restore: async () => { guard(); const value = await appPreferences.getItem(preference); guard(); return value; },
    save: async value => { guard(); await appPreferences.setItem(preference, value.trim()); guard(); },
    lookup: barcode => { guard(); return inventoryAssets(session, { query: barcode, limit: 100, include_order_assignment: false }, guard, current); },
    relocate: (asset, location, key) => { guard(); return inventoryRelocate(session, {
      asset_kind: asset.kind as 'raw_material' | 'finished_goods' | 'qolip', asset_ref: asset.asset_ref,
      physical_location_id: location.id, idempotency_key: key,
    }, guard); },
    relocateBatch: (assets, location, key) => { guard(); return inventoryRelocateBatch(session, { assets, physicalLocationId: location.id, idempotencyKey: key }, guard, guard); },
    transfer: async (asset, location, key) => {
      guard(); const result = await inventoryCreateTransfer(session, { sourceWarehouseId: asset.custody_warehouse_id,
        destinationWarehouseId: location.warehouse_id, assets: [asset], idempotencyKey: key }, guard, guard); guard(); return result;
    },
    key: action => { guard(); return `mobile:${action}:${nativeEpochMicroseconds()}`; },
  });
  const retire = () => { retired = true; store.resetAuthorization(); owner.dispose(); };
  let mounts = 0;
  return { owner, store, current, scope, retire,
    mount() { mounts++; owner.mount(); },
    unmount() { mounts--; owner.unmount(); queueMicrotask(() => { if (!mounts) retire(); }); },
  };
}

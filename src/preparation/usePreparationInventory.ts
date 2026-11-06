import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { registerSessionResetHook, type Session } from '../auth';
import { appPreferences } from '../appPreferences';
import type { InventoryViewLease, InventoryViewStore } from '../shared/inventoryViewStore';
import { preparationInventoryAssets, preparationInventoryStore, type PreparationInventoryLocation } from './preparationInventory';

function useLease(acquire: () => InventoryViewLease) {
  const [current, setCurrent] = useState<{ acquire: () => InventoryViewLease; lease: InventoryViewLease } | null>(null);
  const [, update] = useState(0);
  useEffect(() => {
    let active = true;
    const next = acquire(), changed = () => update(value => value + 1);
    next.addListener(changed);
    void Promise.resolve().then(() => { if (active) setCurrent({ acquire, lease: next }); });
    return () => { active = false; next.removeListener(changed); next.dispose(); };
  }, [acquire]);
  return current?.acquire === acquire ? current.lease : null;
}

export function usePreparationInventory(session: Session) {
  const store = useMemo(() => preparationInventoryStore(session), [session]);
  const [warehouse, setWarehouse] = useState(''), [query, setQuery] = useState(''), [invalidated, setInvalidated] = useState(false);
  const [restored, setRestored] = useState(false);
  const key = `inventory_movements.selected_warehouse.${String(session.profile.ref ?? '').trim() || 'default'}`;
  useEffect(() => {
    let active = true;
    void appPreferences.getItem(key).then(value => { if (active) setWarehouse(value?.trim() ?? ''); })
      .catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    store.configure(AppState.currentState == null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', value => store.configure(value === 'active'));
    const unregister = registerSessionResetHook(async () => { setInvalidated(true); });
    return () => { unregister(); subscription.remove(); store.configure(false); };
  }, [store]);
  const locations = useLease(useCallback(() => store.locations(), [store]));
  const assets = useLease(useCallback(() => preparationInventoryAssets(store, warehouse, query), [store, warehouse, query]));
  const incoming = useLease(useCallback(() => store.transfers({ direction: 'incoming' }), [store]));
  const outgoing = useLease(useCallback(() => store.transfers({ direction: 'outgoing' }), [store]));
  const warehouses = useMemo(() => ((locations?.rows ?? []) as PreparationInventoryLocation[])
    .filter(item => item.kind === 'warehouse' && item.active), [locations?.rows]);
  useEffect(() => {
    let active = true;
    if (restored && locations?.rows && warehouse && !warehouses.some(item => item.warehouse_id === warehouse))
      void Promise.resolve().then(() => { if (active) setWarehouse(''); });
    return () => { active = false; };
  }, [restored, locations?.rows, warehouse, warehouses]);
  const selectWarehouse = (value: string) => { setWarehouse(value); void appPreferences.setItem(key, value.trim()).catch(() => {}); };
  return { store: store as InventoryViewStore, locations, assets, incoming, outgoing, warehouses, warehouse, selectWarehouse, query, setQuery, invalidated };
}

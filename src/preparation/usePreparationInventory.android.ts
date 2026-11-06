import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { appPreferences } from '../appPreferences';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { inventoryAssets } from '../inventoryReadApi';
import { sessionReadScope } from '../sessionReadScope';
import type { InventoryViewLease } from '../shared/inventoryViewStore';
import { preparationInventoryAssets, preparationInventoryStore } from './preparationInventory';
import { preparationCanTransfer, preparationInventoryBarcode, preparationInventoryQrMatches, preparationInventoryTransfersFor,
  type PreparationInventoryAsset, type PreparationInventoryLocation, type PreparationInventoryTransfer } from './preparationInventoryLogic';
import { inventoryCreateTransfer } from './preparationInventoryTransfers';

type Window<T> = { rows: readonly T[] | null; loading: boolean; error: string | null; refresh: () => Promise<void> };
function useWindow<T>(key: string, acquire: () => InventoryViewLease, enabled = true): Window<T> {
  const [snapshot, setSnapshot] = useState<{ key: string; rows: readonly T[] | null; loading: boolean; error: string | null }>
    ({ key: '', rows: null, loading: true, error: null });
  const current = useRef<InventoryViewLease | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const lease = acquire(); current.current = lease;
    const update = () => setSnapshot({ key, rows: lease.rows as readonly T[] | null, loading: lease.loading, error: lease.error });
    lease.addListener(update); update();
    return () => { lease.removeListener(update); lease.dispose(); if (current.current === lease) current.current = null; };
  }, [acquire, enabled, key]);
  const value = snapshot.key === key ? snapshot : { rows: null, loading: true, error: null };
  return { ...value, refresh: () => current.current?.refresh() ?? Promise.resolve() };
}

export function usePreparationInventory(session: Session, assignedWarehouses: readonly string[]) {
  const store = useMemo(() => preparationInventoryStore(session), [session]);
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const active = useRef(true), focused = useRef(false);
  const current = () => active.current && !!activeSessionToken(session) && sessionReadScope(session) === scope;
  const [tab, setTab] = useState<'assets' | 'incoming' | 'outgoing'>('assets');
  const [warehouse, setWarehouse] = useState(''), [restored, setRestored] = useState(false), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [qrAssets, setQrAssets] = useState<PreparationInventoryAsset[]>([]), [qrError, setQrError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const preferenceKey = `inventory_movements.selected_warehouse.${String(session.profile.ref ?? '').trim() || 'default'}`;
  useEffect(() => {
    active.current = true;
    const unregister = registerSessionResetHook(async () => { active.current = false; setQrAssets([]); setQrError(null); });
    void appPreferences.getItem(preferenceKey).then(value => { if (current()) { setWarehouse(value?.trim() ?? ''); setRestored(true); } },
      () => { if (current()) setRestored(true); });
    return () => { active.current = false; unregister(); };
    // Session and key are stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, preferenceKey]);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  useFocusEffect(useCallback(() => {
    focused.current = true; store.configure(AppState.currentState === 'active');
    return () => { focused.current = false; store.configure(false); };
  }, [store]));
  useEffect(() => { const listener = AppState.addEventListener('change', state => store.configure(focused.current && state === 'active')); return () => listener.remove(); }, [store]);
  const locations = useWindow<PreparationInventoryLocation>('locations', useCallback(() => store.locations(), [store]), restored);
  const warehouses = (locations.rows ?? []).filter(location => location.active && location.kind === 'warehouse');
  const selectedWarehouse = locations.rows && warehouse && !warehouses.some(item => item.warehouse_id === warehouse) ? '' : warehouse;
  const assets = useWindow<PreparationInventoryAsset>(JSON.stringify(['assets', selectedWarehouse, search]),
    useCallback(() => preparationInventoryAssets(store, selectedWarehouse, search), [store, selectedWarehouse, search]), restored && tab === 'assets');
  const transfers = useWindow<PreparationInventoryTransfer>(tab, useCallback(() => store.transfers({ direction: tab }), [store, tab]), restored && tab !== 'assets');
  const selectedName = warehouses.find(item => item.warehouse_id === selectedWarehouse)?.name ?? '';
  const visibleAssets = (assets.rows ?? []).filter(asset => asset.physical_location.kind === 'warehouse' && asset.status.trim().toLowerCase() !== 'deleted' &&
    (!selectedWarehouse || warehouses.some(location => location.warehouse_id === selectedWarehouse && location.id === asset.physical_location.id)));
  const visibleTransfers = preparationInventoryTransfersFor(transfers.rows ?? [], selectedName, tab === 'incoming' ? 'incoming' : 'outgoing', search);
  const chooseWarehouse = (value: string) => { setWarehouse(value); void appPreferences.setItem(preferenceKey, value).catch(() => {}); };
  const lookup = async (raw: string) => {
    const barcode = preparationInventoryBarcode(raw);
    if (!barcode || busyRef.current || !current()) return;
    busyRef.current = true; setBusy(true); setQrError(null);
    try {
      const rows = await inventoryAssets(session, { query: barcode, asset_kind: 'raw_material', include_order_assignment: true, limit: 100 });
      if (!current()) return;
      const matches = preparationInventoryQrMatches(rows, barcode);
      if (!matches.length) { setQrError('Bu QR bo‘yicha mahsulot topilmadi'); return; }
      setQrAssets(previous => [...new Map([...previous, ...matches].map(asset => [`${asset.kind}:${asset.asset_ref}`, asset])).values()]);
    } catch (error) { if (current()) setQrError(error instanceof Error ? error.message : String(error)); }
    finally { busyRef.current = false; if (current()) setBusy(false); }
  };
  const transfer = async (asset: PreparationInventoryAsset, destination: PreparationInventoryLocation) => {
    if (busyRef.current || !current() || !preparationCanTransfer(asset, assignedWarehouses) || !destination.active ||
        destination.kind !== 'warehouse' || destination.warehouse_id === asset.custody_warehouse_id) return null;
    busyRef.current = true; setBusy(true);
    try {
      const result = await inventoryCreateTransfer(session, { sourceWarehouseId: asset.custody_warehouse_id, destinationWarehouseId: destination.warehouse_id,
        assets: [asset], idempotencyKey: `mobile:transfer:${Date.now() * 1000}` }, () => {
        if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      });
      if (current()) await store.reconcileAfterWrite();
      return result;
    } finally { busyRef.current = false; if (current()) setBusy(false); }
  };
  return { tab, setTab, warehouse: selectedWarehouse, chooseWarehouse, warehouses, query, setQuery, locations, assets, transfers,
    visibleAssets, visibleTransfers, qrAssets, qrError, busy, lookup, transfer, clearQr: () => { setQrAssets([]); setQrError(null); },
    canTransfer: (asset: PreparationInventoryAsset) => preparationCanTransfer(asset, assignedWarehouses), current };
}

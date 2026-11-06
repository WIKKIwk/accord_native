import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { appPreferences } from '../appPreferences';
import { loadSession, logout, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../printing/nativePrinter';
import { PrintService } from '../printing/printService';
import { localizedGetter, localizedMethod, uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { MobileApiException } from '../shared/mobileApiException';
import { createGScaleCatalogRuntime } from './gscaleCatalogRuntime';
import { gscaleControlViewModel } from './gscaleControlViewModel';
import type { DiscoveredServer } from './gscaleDiscovery';
import { formatCompactKg } from './gscalePreparation';
import { GScaleOrderSelectionStore, gscaleOrderLabel } from './gscaleOrderSelection';
import { createGScaleOperatorStore, materialAssignedWarehouseNames } from './gscaleOperatorRuntime';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import { MaterialWarehousePreferences } from './gscalePreferences';
import { gscalePhotoRemoteQueries, gscalePickerRelevance } from './gscalePhotoSearch';
import { pickGScalePhotoSearch } from './gscalePhotoSearchRuntime';
import type { GScaleModeArgs } from './gscaleRouteArgs';

export type GScalePickerChoice = { key: string; title: string; subtitle?: string; select(): void };
export type GScalePickerSpec = { title: string; hint: string; pageSize: number; photoSearch?: boolean;
  load(query: string, offset: number, limit: number): Promise<GScalePickerChoice[]> };

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useGScaleText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return (value: string) => uiText(value, locale);
}

export function useGScaleSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void loadSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);
  const signOut = () => {
    if (!session) return;
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => setSession(null));
  };
  return { session, signOut };
}

function createScreenGroup(session: Session, args: GScaleModeArgs) {
  const operator = createGScaleOperatorStore(session, args);
  const catalog = createGScaleCatalogRuntime(session, () => materialAssignedWarehouseNames(session));
  const order = new GScaleOrderSelectionStore(args.order ?? null, true, catalog.orders, selected => operator.setOrder(selected));
  const lifecycle = { mounts: 0, started: false };
  return { operator, catalog, order, mount() {
    lifecycle.mounts++;
    if (!lifecycle.started) {
      lifecycle.started = true;
      operator.start();
      if (['material_taminotchi', 'tayyorlov_masteri'].includes(String(session.profile.role))) void order.load();
    }
    return () => { lifecycle.mounts--; queueMicrotask(() => { if (!lifecycle.mounts) { order.dispose(); operator.dispose(); } }); };
  } };
}

export function useGScaleScreen(session: Session, args: GScaleModeArgs) {
  const group = useMemo(() => createScreenGroup(session, args), [session, args]);
  const state = useSyncExternalStore(group.operator.subscribe, group.operator.getSnapshot, group.operator.getSnapshot);
  const order = useSyncExternalStore(group.order.subscribe, group.order.getSnapshot, group.order.getSnapshot);
  const role = String(session.profile.role ?? ''), controlOnly = ['material_taminotchi', 'tayyorlov_masteri'].includes(role);
  const usesOrder = controlOnly && (role === 'material_taminotchi' || args.freshForm === true);
  const orderLocked = !state.batch.resolved || state.presetLoading || state.batch.batch?.active === true || state.actionLoading ||
    state.batch.loading || state.manualPrintLoading || state.simpleLoading || state.requestInFlight;
  useEffect(() => group.mount(), [group]);
  useEffect(() => { group.order.setDisabled(orderLocked); }, [group, orderLocked]);
  const preferredAttempted = useRef(false);
  const draftWarehouseChecked = useRef(false);
  const preferenceKey = JSON.stringify([session.baseUrl, role, session.profile.ref]);
  useEffect(() => {
    if (preferredAttempted.current || role !== 'material_taminotchi' || !session.profile.ref || !state.draftRestored || !state.batch.resolved ||
        state.batch.batch?.active || state.draft.warehouse || args.warehouse) return;
    preferredAttempted.current = true;
    let active = true;
    void group.catalog.warehouses('', '', true).then(async warehouses => {
      const name = await new MaterialWarehousePreferences(appPreferences, preferenceKey).preferred(warehouses.map(value => value.warehouse));
      const current = group.operator.getSnapshot();
      if (active && name && !current.draft.warehouse && !current.batch.batch?.active) group.operator.editDraft({ warehouse: name, warehouse_mode: 'manual' });
    }).catch(() => {});
    return () => { active = false; };
  }, [args.warehouse, group, preferenceKey, role, session.profile.ref, state.draftRestored, state.batch.resolved, state.batch.batch?.active, state.draft.warehouse]);
  useEffect(() => {
    if (draftWarehouseChecked.current || !state.draftRestored) return;
    draftWarehouseChecked.current = true;
    const item = state.draft.item_code, warehouse = state.draft.warehouse;
    if (!item || !warehouse) return;
    let active = true;
    void group.catalog.warehouses(controlOnly ? warehouse : '', item, controlOnly).then(values => {
      const current = group.operator.getSnapshot();
      if (active && values.length && !values.some(value => value.warehouse === warehouse) &&
          current.draft.item_code === item && current.draft.warehouse === warehouse) group.operator.editDraft({ warehouse: '' });
    }).catch(() => {});
    return () => { active = false; };
  }, [controlOnly, group, state.draftRestored, state.draft.item_code, state.draft.warehouse]);
  const selected = state.device.selection;
  const control = gscaleControlViewModel({ controlOnly, freshForm: args.freshForm === true, role,
    linkedOrderWidthMm: group.operator.currentArgs().order?.width_mm ?? null, materialWarehouses: state.materialWarehouses,
    transport: state.device.transport, hasServer: selected?.transport === 'wifi', hasOfflinePrinter: selected?.transport === 'offline',
    hasBluetoothPrinter: selected?.transport === 'bluetooth', batchResolved: state.batch.resolved, batch: state.batch.batch,
    batchContextEditing: state.contextEditing, draftContextSaved: state.draft.context_saved, usesReceiptOrderContext: usesOrder,
    preparationPresetLoading: state.presetLoading, manualPrintLoading: state.manualPrintLoading, batchActionLoading: state.actionLoading,
    simpleReceiptLoading: state.simpleLoading, requestInFlight: state.requestInFlight, draft: state.draft, snapshot: state.monitor });

  function orderPicker(): GScalePickerSpec {
    return { title: 'Order tanlang', hint: 'Qidirish', pageSize: 50,
      load: async (query, offset, limit) => group.order.page(query, offset, limit).map(value => ({ key: value.id,
        title: gscaleOrderLabel(value), subtitle: `${value.order_kg} kg`, select: () => group.order.select(value) })) };
  }
  function itemPicker(): GScalePickerSpec {
    group.operator.openMaterialPicker();
    const orderId = group.operator.currentArgs().order?.id ?? '';
    return { title: 'Mahsulot tanlang', hint: 'Mahsulot qidiring', pageSize: 50, photoSearch: true,
      load: async (query, offset, limit) => (await group.catalog.materialChoices(query, offset, limit, orderId, args.freshForm === true))
        .map(({ item, micron }) => ({ key: `${item.code}:${micron}`, title: `${item.name || item.code}${micron == null ? '' : ` — ${formatCompactKg(micron)} mkm`}`,
          subtitle: item.code, select: () => {
            if ((group.operator.currentArgs().order?.id ?? '') !== orderId) return;
            group.operator.selectMaterialChoice({ code: item.code, name: item.name || item.code, requiresDimensions: item.requires_dimensions }, micron);
          } })) };
  }
  function warehousePicker(): GScalePickerSpec {
    const item = state.draft.item_code, independent = controlOnly;
    return { title: 'Ombor tanlang', hint: 'Ombor qidiring', pageSize: 200,
      load: async (query, offset, limit) => (await group.catalog.warehouses(query, item, independent)).slice(offset, offset + limit)
        .map(value => ({ key: value.warehouse, title: value.warehouse, subtitle: value.company ?? undefined,
          select: () => {
            const current = group.operator.getSnapshot();
            if (!independent && current.draft.item_code !== item) return;
            group.operator.editDraft({ warehouse: value.warehouse, warehouse_mode: 'manual' });
            if (role === 'material_taminotchi' && session.profile.ref) {
              void new MaterialWarehousePreferences(appPreferences, preferenceKey).record(value.warehouse);
            }
          } })) };
  }
  function defaultWarehousePicker(): GScalePickerSpec {
    return { title: 'Standart ombor tanlang', hint: 'Ombor qidiring', pageSize: 200,
      load: async (query, offset, limit) => (await group.catalog.warehouses(query, '', true)).slice(offset, offset + limit)
        .map(value => ({ key: value.warehouse, title: value.warehouse, subtitle: value.company ?? undefined,
          select: () => group.operator.setWarehouseSetup('default', value.warehouse) })) };
  }
  return { ...group, session, orderStore: group.order, state, order, role, controlOnly, usesOrder, orderLocked, control,
    orderPicker, itemPicker, warehousePicker, defaultWarehousePicker };
}

export function useGScalePicker(spec: GScalePickerSpec, session: Session) {
  const [search, setSearch] = useState<{ query: string; background: string[] }>({ query: '', background: [] });
  const [photoLoading, setPhotoLoading] = useState(false), [photoError, setPhotoError] = useState('');
  const [state, setState] = useState<{ items: GScalePickerChoice[]; loading: boolean; error: string; more: boolean }>(
    { items: [], loading: true, error: '', more: false });
  const request = useRef(0), alive = useRef(true);
  useEffect(() => { const current = alive; current.current = true; return () => { current.current = false; }; }, []);
  const load = useCallback(async (offset: number) => {
    const id = ++request.current;
    setState(previous => ({ ...previous, loading: true, error: '', ...(offset ? {} : { items: [] }) }));
    try {
      const effective = search.background.length ? search.background : search.query.trim() ? [search.query.trim()] : [];
      const remote = gscalePhotoRemoteQueries(effective);
      const pages = remote.length <= 1 ? [await spec.load(remote[0] ?? '', offset, spec.pageSize)]
        : await Promise.all(remote.map(query => spec.load(query, 0, spec.pageSize)));
      const unique = new Map<string, { item: GScalePickerChoice; rank: number; matches: number; index: number }>();
      for (const [rank, page] of pages.entries()) for (const item of page) {
        const key = `${item.title}|${item.subtitle ?? ''}`.toLowerCase().trim(), prior = unique.get(key);
        if (prior) prior.matches++; else unique.set(key, { item, rank, matches: 1, index: unique.size });
      }
      const score = (item: GScalePickerChoice) => Math.max(0, ...effective.map(query => gscalePickerRelevance(query, item.title, item.subtitle)));
      const merged = [...unique.values()].sort((left, right) => {
        return score(right.item) - score(left.item) || right.matches - left.matches || left.rank - right.rank || left.index - right.index;
      }).map(value => value.item);
      const items = remote.length <= 1 ? pages[0] : merged;
      if (id === request.current) setState(previous => {
        const combined = offset ? [...previous.items, ...items] : items;
        return { items: effective.length ? combined.slice().sort((left, right) => score(right) - score(left)) : combined,
          loading: false, error: '', more: remote.length <= 1 && items.length >= spec.pageSize };
      });
    } catch (error) {
      if (id === request.current) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : String(error), more: false }));
    }
  }, [spec, search]);
  useEffect(() => {
    const currentRequest = request, timer = setTimeout(() => { void load(0); }, 220);
    return () => { clearTimeout(timer); currentRequest.current++; };
  }, [load]);
  const setQuery = (query: string) => setSearch(previous => previous.query === query ? previous : { query, background: [] });
  const photoSearch = async (source: 'camera' | 'library') => {
    if (photoLoading) return null;
    setPhotoLoading(true); setPhotoError('');
    try {
      const suggestion = await pickGScalePhotoSearch(session, source);
      if (!alive.current) return null;
      if (suggestion) setSearch({ query: suggestion.displayQuery, background: suggestion.backgroundQueries });
      return suggestion?.displayQuery ?? null;
    } catch (error) {
      const code = error instanceof MobileApiException ? error.code : error instanceof Error ? error.message : '';
      const locale = localeController.locale;
      const message = code === 'not_configured' ? localizedGetter('aiSearchNotConfigured', locale)
        : code === 'no_result' ? localizedGetter('aiSearchNoResult', locale)
          : code === 'image_pick_failed' || code === 'invalid_image' ? localizedGetter('imagePickFailed', locale)
            : localizedMethod('aiSearchFailed', locale, { error: error instanceof Error ? error.message : String(error) });
      if (alive.current) setPhotoError(message); return null;
    } finally { if (alive.current) setPhotoLoading(false); }
  };
  return { ...state, query: search.query, setQuery, photoLoading, photoError, photoSearch, retry: () => void load(0),
    photoLabels: { take: localizedGetter('aiSearchTakePhoto', localeController.locale),
      choose: localizedGetter('aiSearchChoosePhoto', localeController.locale) },
    loadMore: () => { if (!state.loading && state.more) void load(state.items.length); } };
}

export function useGScaleDevicePicker(operator: GScaleOperatorStore, close: () => void) {
  const device = useSyncExternalStore(operator.subscribe, operator.getSnapshot, operator.getSnapshot).device;
  const [printers, setPrinters] = useState<BluetoothPrinterProfile[]>([]), [scanning, setScanning] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);
  const [error, setError] = useState(''), [address, setAddress] = useState('http://gscale.local:39117');
  useEffect(() => { operator.selectConnection(null); }, [operator]);
  useEffect(() => {
    if (device.connection !== 'bluetooth') return;
    let active = true, stop: (() => void) | undefined;
    void NativeBluetoothPrinter.discoverPrinters(event => {
      if (!active) return;
      if (event.completed) setScanning(false);
      if (event.printer) { const printer = event.printer; setPrinters(old => old.some(value => value.address === printer.address) ? old : [...old, printer]); }
    }).then(dispose => { if (active) stop = dispose; else dispose(); })
      .catch(reason => { if (active) { setScanning(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; stop?.(); };
  }, [operator, device.connection, scanVersion]);
  const selectServer = async (server: DiscoveredServer) => { await operator.selectDevice({ transport: 'wifi', server }); close(); };
  const selectBluetooth = async (printer: BluetoothPrinterProfile) => { await operator.selectDevice({ transport: 'bluetooth', bluetoothPrinter: printer }); close(); };
  const selectUsb = async () => {
    setError(''); setScanning(true);
    try { const offlinePrinter = await PrintService.detectOfflinePrinter(); await operator.selectDevice({ transport: 'offline', offlinePrinter }); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setScanning(false); }
  };
  const checkAddress = async () => { const server = await operator.checkDeviceAddress(address); if (server) await selectServer(server); };
  return { device, printers, scanning, error, address, setAddress, selectServer, selectBluetooth, selectUsb, checkAddress,
    choose: (connection: 'wifi' | 'bluetooth' | 'usb' | null) => {
      setError(''); setScanning(connection === 'bluetooth'); if (connection === 'bluetooth') setPrinters([]);
      operator.selectConnection(connection);
    },
    rescanBluetooth: () => { setError(''); setPrinters([]); setScanning(true); setScanVersion(value => value + 1); },
    scan: () => void operator.scanDevices() };
}

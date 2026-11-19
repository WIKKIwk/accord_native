import { useIsFocused } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { Keyboard } from 'react-native';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { OrdersListScrollMetrics } from '../shared/orders/OrdersList.types';
import { adminWarehouseMainCanEditStock } from './adminWarehouseMainModel';
import { createAdminWarehouseMainSession } from './adminWarehouseMainSession';
import { adminWarehouseMainItemRow, adminWarehouseMainQolipRow, adminWarehouseMainRawRow, adminWarehouseMainReservationRows, type AdminWarehouseMainRow } from './AdminWarehouseMainRows';
import type { AdminWarehouseMainActionContext, AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';
import { AdminWarehouseMainViewState } from './AdminWarehouseMainViewState';
import { dartTrim } from './dartJsonString';
import { useAdminWarehouseLive } from './useAdminWarehouseLive';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminWarehouseMain(props: AdminWarehouseMainScreenProps) {
  const focused = useIsFocused(), { session, witness, isCurrent } = props;
  const { owner, view } = useMemo(() => {
    let view: AdminWarehouseMainViewState;
    const owner = createAdminWarehouseMainSession(session, witness, isCurrent, { canInteract: () => view.canInteract() });
    view = new AdminWarehouseMainViewState(owner.current); return { owner, view };
  }, [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  const presentation = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { view.attach(false); owner.activate(); return () => { view.detach(); owner.deactivate(); }; }, [owner, view]); // Focus does not reconstruct the read owner.
  useLayoutEffect(() => view.setFocused(focused), [focused, view]);
  useLayoutEffect(() => { view.synchronizeText(state.search); if (state.summaryPhase === 'ready') view.markSummaryReady(); else if (state.summaryPhase === 'error') view.markSummaryError(); }, [view, state.search, state.summaryPhase]);
  useAdminWarehouseLive(session, witness, owner.current, owner.refreshInPlace);
  const a = useMemo(() => (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), [locale]);
  const p = useMemo(() => (key: string, values?: Record<string, unknown>) => productionText(key, locale, values), [locale]);
  const t = useMemo(() => (key: string) => localizedGetter(key, locale), [locale]);
  const scope = session.profile.role === 'material_taminotchi' ? 'material' : session.profile.role === 'werka' ? 'werka' : 'admin';
  const scopeMatches = props.scope === scope, current = owner.current, interactive = useMemo(() => view.capture(presentation.generation), [view, presentation.generation]);
  const mountedCurrent = useMemo(() => view.captureMounted(presentation.mountGeneration), [view, presentation.mountGeneration]);
  const controller = owner.controller;
  // The getter reads these immutable controller slices. Preserve row tickets through header-only updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const products = useMemo(() => controller.productsView, [controller, state.detail, state.warehouse, state.summary, state.items, state.qolipProducts]), canQr = scope === 'material' || owner.flags.adminScoped;
  const availableGroups = useMemo(() => {
    const groups: AdminWarehouseMainRow[][] = [];
    if (products.qolip) { if (products.groups.length) groups.push(products.groups.map((group, index) => adminWarehouseMainQolipRow(group, index, a))); }
    else if (state.items.length) groups.push(state.items.map((item, index) => adminWarehouseMainItemRow(item, index, a)));
    if (products.availableRawStock.length) groups.push(products.availableRawStock.map((stock, index) => adminWarehouseMainRawRow(stock, index, a, canQr, scope === 'material' && adminWarehouseMainCanEditStock(stock, state.detail?.reservations ?? []))));
    return groups;
  }, [products.qolip, products.groups, products.availableRawStock, state.items, state.detail?.reservations, a, canQr, scope]);
  const reservedGroups = useMemo(() => state.detail?.reservations.length ? [adminWarehouseMainReservationRows(state.detail.reservations, state.detail.rawStock, state.detail.apparatus, a, p, canQr)] : products.reservedRawStock.length ? [products.reservedRawStock.map((stock, index) => adminWarehouseMainRawRow(stock, index, a, canQr, false))] : [],
    [state.detail, products.reservedRawStock, a, p, canQr]);
  useLayoutEffect(() => view.setRows(state.pageTab !== 'products' ? [] : (state.stockTab === 'available' ? availableGroups : reservedGroups).flat()), [view, availableGroups, reservedGroups, state.pageTab, state.stockTab]);
  const material = props.scope === 'material' ? props.materialStates : null;
  const changed = useCallback(async () => {
    if (!mountedCurrent()) return;
    // V2 starts MaterialStateLocationsTab.reload first and the parent summary/detail reload next.
    const states = material?.reload(); await Promise.all([states, owner.onChanged()]);
  }, [mountedCurrent, owner, material]);
  const context = useCallback((valid: () => boolean): AdminWarehouseMainActionContext => ({ isCurrent: valid, onChanged: async () => { if (valid()) await changed(); } }), [changed]);
  const setSearch = useCallback((text: string) => { if (!interactive() || view.getSnapshot().dialog) return; view.typed(text); controller.search(text); material?.search(text); }, [interactive, view, controller, material]);
  const clearSearch = useCallback(() => { if (!interactive() || view.getSnapshot().dialog) return; view.synchronizeText(''); controller.clearSearchText(); material?.search(''); }, [interactive, view, controller, material]);
  const setSearchFocused = useCallback((value: boolean) => { if (interactive()) view.setSearchFocused(value); }, [interactive, view]);
  const closeSearch = useCallback(() => { if (interactive() && !view.getSnapshot().dialog) { view.setSearchFocused(false); Keyboard.dismiss(); } }, [interactive, view]);
  const onItemRolls = props.onItemRolls;
  const openRow = useCallback((row: AdminWarehouseMainRow) => {
    if (!interactive() || row.kind === 'item' && (!dartTrim(row.item.warehouse) || !dartTrim(row.item.code))) return; Keyboard.dismiss(); const dialog = view.openRow(row);
    if (dialog?.kind === 'item' && row.kind === 'item') {
      const valid = () => view.dialogCurrent(dialog.id);
      void (async () => { try { if (valid()) await onItemRolls(row.item, context(valid)); } finally { view.close(dialog.id); } })().catch(() => {});
    }
  }, [interactive, view, onItemRolls, context]);
  const runDetailAction = useCallback((id: number, action: 'qr' | 'edit') => {
    if (!interactive()) return; const dialog = view.getSnapshot().dialog;
    if (dialog?.id !== id || dialog.kind !== 'details') return;
    const row = dialog.row, stock = row.kind === 'raw' || row.kind === 'reservation' ? row.stock : null;
    if (!stock || (action === 'qr' ? !('canQr' in row) || !row.canQr || !dartTrim(stock.barcode) || props.scope === 'werka' : row.kind !== 'raw' || !row.canEdit || props.scope !== 'material')) return;
    const ticket = view.beginAction(id); if (!ticket) return;
    void (async () => {
      try {
        if (!ticket.current()) return;
        if (action === 'qr' && props.scope !== 'werka') await props.onRawStockQr(stock, dartTrim(row.orderId) ? row.orderId : stock.reserved_order_id, context(ticket.current));
        else if (action === 'edit' && props.scope === 'material') await props.onRawStockEdit(stock, context(ticket.current));
      } finally { ticket.finish(); }
    })().catch(() => {});
  }, [interactive, view, props, context]);
  const dialog = presentation.dialog;
  const dialogCurrent = useMemo(() => dialog ? () => view.dialogCurrent(dialog.id) : () => false, [dialog, view]);
  const closeDialog = useCallback(() => { if (dialog) view.close(dialog.id); }, [dialog, view]);
  const beginDismissDialog = useCallback(() => { if (dialog) view.beginDismiss(dialog.id); }, [dialog, view]);
  const created = useCallback(async () => { if (dialogCurrent()) await owner.onCreated(); }, [dialogCurrent, owner]);
  const openCreate = useCallback(() => { if (interactive() && !owner.flags.warehouseScoped) { Keyboard.dismiss(); view.openCreate(); } }, [interactive, owner, view]);
  const actions = useMemo(() => [{ id: 'warehouse-create', label: a('warehouse.create'), icon: { ios: 'building.2' as const, android: 'warehouse' as const }, onPress: openCreate }], [a, openCreate]);
  const filterNames = state.summary.sections.map(row => row.warehouse);
  const settingsCanInteract = useCallback(() => view.canInteract() && controller.getSnapshot().pageTab === 'settings' && !view.getSnapshot().dialog, [view, controller]);
  const summaryScreen = state.summaryPhase === 'error' ? 'error' : (state.summaryPhase === 'idle' || state.summaryPhase === 'loading') && !presentation.summarySeen ? 'loading' : 'content';
  const loadMore = () => interactive() && controller.getSnapshot().pageTab === 'products' && controller.getSnapshot().stockTab === 'available' && !view.getSnapshot().dialog ? controller.loadMoreItems() : Promise.resolve();
  return { state, presentation, scope, focused, locale, a, t, current, interactive, controller, products, availableGroups, reservedGroups, filterNames, dialog, dialogCurrent, closeDialog, beginDismissDialog, created,
    valid: state.valid && scopeMatches && current(), searchHint: a(scope === 'admin' ? 'warehouse.products_search' : 'warehouse.location_products_search'), bottomPaddingOffset: scope === 'material' || owner.flags.adminScoped ? 128 : 24, summaryScreen, actions, hasSearchText: !!dartTrim(state.search), setSearch, clearSearch, setSearchFocused, closeSearch, openRow, runDetailAction,
    back: () => { if (interactive() && !view.getSnapshot().dialog) props.onBack(); },
    profile: () => props.renderProfileAction({ isCurrent: current, canInteract: () => interactive() && !view.getSnapshot().dialog }),
    setPageTab: (tab: 'products' | 'settings') => { if (interactive() && !view.getSnapshot().dialog) controller.setPageTab(tab); },
    setStockTab: (tab: 'available' | 'reserved') => { if (interactive() && !view.getSnapshot().dialog) controller.setStockTab(tab); },
    toggleFilter: () => { if (interactive() && !view.getSnapshot().dialog) controller.toggleFilter(); },
    selectWarehouse: (name: string) => { if (interactive() && !view.getSnapshot().dialog && controller.getSnapshot().summary.sections.some(row => row.warehouse === name)) controller.selectWarehouse(name); },
    reload: () => interactive() && !view.getSnapshot().dialog ? changed().catch(() => {}) : Promise.resolve(),
    retryItems: () => interactive() && controller.getSnapshot().pageTab === 'products' && !view.getSnapshot().dialog ? controller.retryItems() : Promise.resolve(),
    loadMore,
    onItemsScroll: ({ contentHeight, offset, viewportHeight }: OrdersListScrollMetrics) => {
      if (contentHeight - offset - viewportHeight <= 420) void loadMore();
    },
    detailOrder: dialog?.kind === 'details' && dartTrim(dialog.row.orderId) ? props.renderReservedOrderDetails(dialog.row.orderId, context(dialogCurrent)) : null,
    materialStates: props.scope === 'material' ? props.materialStates.render({ query: state.search, onAssetReturned: changed, isCurrent: mountedCurrent }) : null,
    settings: { session, witness, isCurrent: current, canInteract: settingsCanInteract, summaries: state.summary.sections, warehouse: state.warehouse, filterExpanded: state.filterExpanded,
      onFilterToggle: () => { if (settingsCanInteract()) controller.toggleFilter(); }, onWarehouseChanged: (name: string) => { if (settingsCanInteract() && controller.getSnapshot().summary.sections.some(row => row.warehouse === name)) controller.selectWarehouse(name); }, onChanged: changed, onDeleted: owner.onDeleted },
  };
}
export type AdminWarehouseMainModel = ReturnType<typeof useAdminWarehouseMain>;

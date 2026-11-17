import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { MobileApiException } from '../shared/mobileApiException';
import { extensionText } from '../shared/localization';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { qolipProducts } from '../qolipProductsApi';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { QolipCatalogForm } from './QolipCatalogForm';
import { QolipCatalogDialog } from './QolipCatalogDialog';
import { QolipCatalogConfirm } from './QolipCatalogConfirm';
import type { QolipCatalogConfirmation } from './qolipCatalogConfirmation';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { qolipBlocksData } from './qolipBlocksApi';
import { parseQolipBatchCode } from './qolipCode';
import { qolipErrorMessage } from './qolipErrorMessage';
import type { QolipCatalogEditorActions, QolipCatalogEditorRequest, QolipCatalogEditorState } from './qolipCatalogEditorTypes';
import { qolipSaveProductSpecsBatch } from './qolipProductActionsApi';
import { qolipCreateSet, qolipManagedSets, qolipResolveSet, qolipReuseSet, type QolipManagedSet, type QolipSharedSet, type QolipMoldDraft } from './qolipSetsApi';
import { searchQolipSets } from './qolipSetSearch';
import type { QolipCatalogProduct } from './qolipProductsState';
import { trimDart } from './qolipApiCommon';
import { useQolipPrinting } from './useQolipPrinting';
import { qolipLimitGraphemes } from './qolipGraphemes';
import { QolipCatalogSpecSheet } from './QolipCatalogSpecSheet';
import { qolipCatalogEditorCanSave, qolipCatalogInteger, qolipCatalogIntegerDecimal } from './qolipCatalogEditorLogic';
import { qolipPantonNumber } from './qolipCatalogEditorTypes';
class QolipCatalogValidationError extends Error {}

export function useQolipCatalogEditors() {
  const role = useQolipRole(), { locale, text: t } = useQolipText(), printing = useQolipPrinting();
  const [state, setState] = useState<QolipCatalogEditorState | null>(null), stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const [confirmation, setConfirmation] = useState<QolipCatalogConfirmation | null>(null);
  const confirmationResolver = useRef<((value: boolean) => void) | null>(null);
  const mounted = useRef(true), serial = useRef(0), searchSerial = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolver = useRef<((value: unknown) => void) | null>(null), setsCache = useRef<Promise<QolipManagedSet[]> | null>(null);
  const pickerCandidates = useRef<readonly QolipManagedSet[] | null>(null);
  const pickerRows = useRef<readonly QolipManagedSet[]>([]), pickerLimit = useRef(50), pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const m = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipManagementText', key, locale, values);
  const shared = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipSharedSetText', key, locale, values);
  const current = (id = serial.current) => mounted.current && role.isCurrent() && id === serial.current;
  const patch = (value: Partial<QolipCatalogEditorState>) => { if (current()) setState(previous => previous ? { ...previous, ...value } : null); };
  const finish = (value: unknown = null) => { serial.current++; searchSerial.current++; if (timer.current) clearTimeout(timer.current); if (pickerTimer.current) clearTimeout(pickerTimer.current); setState(null); const resolve = resolver.current; resolver.current = null; resolve?.(value); };
  const retireSerial = () => { serial.current++; };
  useEffect(() => {
    mounted.current = true;
    const stop = role.boundary.subscribe(() => { if (!role.isCurrent()) { finish(); confirmationResolver.current?.(false); } });
    return () => { mounted.current = false; retireSerial(); if (timer.current) clearTimeout(timer.current); if (pickerTimer.current) clearTimeout(pickerTimer.current); stop(); resolver.current?.(null); resolver.current = null; confirmationResolver.current?.(false); };
  }, [role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const confirm = (input: Omit<QolipCatalogConfirmation, 'resolve'>) => new Promise<boolean>(resolve => {
    if (!current()) { resolve(false); return; }
    const settle = (value: boolean) => { if (confirmationResolver.current !== settle) return; confirmationResolver.current = null;
      if (mounted.current) setConfirmation(null); resolve(current() && value); };
    confirmationResolver.current?.(false); confirmationResolver.current = settle;
    setConfirmation({ ...input, resolve: settle });
  });
  const loadSets = () => setsCache.current ??= qolipManagedSets(role.session, role.isCurrent).catch(error => { setsCache.current = null; throw error; });
  const warehouses = async () => {
    const id = serial.current; patch({ warehouseLoading: true, warehouseFailed: false, warehouse: null });
    try { const data = await qolipBlocksData(role.session, () => current(id)); if (!current(id)) return;
      const values = [...new Set(data.warehouses.map(trimDart).filter(Boolean))]; patch({ warehouses: values, warehouse: values.length === 1 ? values[0] : null });
    } catch { if (current(id)) patch({ warehouseFailed: true }); }
    finally { if (current(id)) patch({ warehouseLoading: false }); }
  };
  const open = <T,>(request: QolipCatalogEditorRequest): Promise<T | null> => {
    if (!role.isCurrent() || resolver.current) return Promise.resolve(null);
    serial.current++;
    const initial = request.initialProduct, color = request.initialColor ?? (request.kind === 'edit' ? initial?.color : '') ?? '';
    const panton = request.availablePantonNumber === undefined ? 1 : request.availablePantonNumber;
    setState({ request, code: request.kind === 'edit' ? initial?.qolip_code ?? '' : '', size: request.initialSize ? String(request.initialSize) : request.kind === 'edit' && initial?.size ? String(initial.size) : '',
      colors: color ? [color] : [], pantons: request.kind === 'edit' && qolipPantonNumber(color) ? [qolipPantonNumber(color)!] : panton ? [panton] : [], existing: false, product: initial ?? null,
      warehouse: null, warehouses: [], warehouseLoading: request.kind === 'spec' || request.kind === 'set', warehouseFailed: false,
      picker: request.pickerOnly ? 'set' : null, pickerQuery: '', pickerLoading: !!request.pickerOnly, pickerHasMore: false, products: [], sets: [], suggestions: [], suggestionsLoading: false, suggestionsFailed: false, saving: false, error: null, expandedCodes: false, saved: [] });
    pickerCandidates.current = null;
    const promise = new Promise<T | null>(resolve => { resolver.current = value => resolve(value as T | null); });
    if (request.kind === 'spec' || request.kind === 'set') queueMicrotask(() => void warehouses());
    if (request.pickerOnly) { const id = serial.current; void loadSets().then(sets => { if (current(id)) { pickerRows.current = sets; pickerLimit.current = 50; patch({ sets: sets.slice(0, 50), pickerHasMore: sets.length > 50, pickerLoading: false }); } }).catch(error => { if (current(id)) patch({ error: qolipErrorMessage(error, locale), pickerLoading: false }); }); }
    return promise;
  };
  const reuse = async (set: QolipSharedSet, product: QolipCatalogProduct, name?: string): Promise<QolipCatalogProduct[] | null> => {
    let entry = set, changed = false;
    while (current()) {
      const body = shared('body', { code: name ? `${name} (${entry.id})` : entry.id, products: entry.product_labels.join(', '), count: entry.members.length,
        members: entry.members.map(member => `${member.qolip_code} · ${member.color || '—'} · ${member.size}`).join('\n'), target: `${product.name} (${product.code})` });
      const accepted = await confirm({ title: shared('title'), message: `${changed ? `${shared('changed')}\n\n` : ''}${body}`, confirm: shared('yes'), cancel: shared('no'), dismissible: false });
      if (!accepted || !current()) return null;
      try { const saved = await qolipReuseSet(role.session, entry, product, role.isCurrent); return current() ? saved : null; }
      catch (error) {
        if (!(error instanceof MobileApiException) || error.code !== 'qolip_set_changed') throw error;
        const refreshed = await qolipResolveSet(role.session, entry.id, role.isCurrent);
        if (!current()) return null; if (!refreshed?.members.length) throw error; entry = refreshed; changed = true;
      }
    }
    return null;
  };
  const saveProducts = (products: QolipCatalogProduct[], code: string) => {
    const s = stateRef.current; if (!s || !current()) return;
    if (!products.length) throw new Error('empty_qolip_set');
    if (s.request.kind === 'mold') { finish(true); return; }
    qolipDataRevision.notifyLocationsChanged();
    if (s.request.closeAfterSave) finish(products);
    else patch({ saved: products, code, size: String(products[0].size), warehouse: products[0].warehouse,
      colors: products.map(product => trimDart(product.color).toUpperCase()).filter(Boolean), picker: null });
  };
  const reuseInput = async (s: QolipCatalogEditorState, includeMoldCodes: boolean): Promise<boolean> => {
    if (!s.product) return false;
    const values = await loadSets(); if (!current()) return true;
    const needle = trimDart(s.code).toLowerCase(), moldMatches = values.filter(entry => entry.set.members.some(mold => mold.qolip_code.toLowerCase() === needle));
    if (!includeMoldCodes && moldMatches.length) return false;
    let matches = values.filter(entry => entry.set.id.toLowerCase() === needle);
    if (!matches.length && includeMoldCodes) matches = moldMatches;
    if (!matches.length) { const name = trimDart(s.code).replace(/\s+/g, ' ').toLowerCase(); matches = values.filter(entry => entry.name && entry.name.toLowerCase() === name); }
    if (!matches.length) matches = await searchQolipSets(values, s.code, { includeMoldCodes, isCurrent: current });
    if (!current()) return true;
    if (!matches.length) {
      if (!includeMoldCodes) return false;
      const legacy = await qolipResolveSet(role.session, s.code, role.isCurrent); if (!current()) return true;
      if (!legacy) return false; const saved = await reuse(legacy, s.product); if (saved) saveProducts(saved, legacy.id); return true;
    }
    if (matches.length > 1) { pickerCandidates.current = matches; pickerRows.current = matches; pickerLimit.current = 50; patch({ picker: 'set', pickerQuery: '', sets: matches.slice(0, 50), pickerHasMore: matches.length > 50, saving: false }); return true; }
    const saved = await reuse(matches[0].set, s.product, matches[0].name); if (saved) saveProducts(saved, matches[0].set.id); return true;
  };
  const save = async () => {
    const s = stateRef.current; if (!s || !current() || s.saving || s.saved.length) return;
    const id = serial.current; patch({ saving: true, error: null });
    try {
      if ((s.request.kind === 'spec' || s.request.kind === 'mold') && await reuseInput(s, s.request.kind === 'spec')) return;
      if (!current(id)) return;
      const code = trimDart(s.code), size = qolipCatalogInteger(s.size) ?? 0;
      if (s.request.kind === 'edit') { if (!s.product || !code || size <= 0) return; finish({ code, size, sizeDecimal: qolipCatalogIntegerDecimal(s.size), color: s.colors[0] ?? '' }); return; }
      if (!code) throw new QolipCatalogValidationError(m('code_required'));
      if (s.request.kind === 'mold') {
        if (!s.existing && (!(size > 0 && size <= 2147483647) || !s.colors.length)) throw new QolipCatalogValidationError(m(size > 0 && size <= 2147483647 ? 'color_required' : 'size_required'));
        await s.request.onSave?.({ code, existingOnly: s.existing, size: s.existing ? 0 : size, color: s.existing ? '' : s.colors[0] });
        if (current(id)) finish(true); return;
      }
      if (!s.warehouse || s.warehouseLoading || s.warehouseFailed) throw new QolipCatalogValidationError(shared('warehouse'));
      if (!(size > 0 && size <= 2147483647)) throw new QolipCatalogValidationError(t('home.size_invalid'));
      const draft = parseQolipBatchCode(code); if (!draft) throw new QolipCatalogValidationError(t('home.code_range'));
      if ((draft.count > 1 || s.request.kind === 'set') && s.colors.length !== draft.count) throw new QolipCatalogValidationError(t('home.colors_required', { count: draft.count }));
      if (draft.count === 1 && s.colors.length > 1) throw new QolipCatalogValidationError(t('home.one_color'));
      const specs = draft.codes.map((qolipCode, i) => ({ qolipCode, size, qolipColor: s.colors[i] ?? '' }));
      if (s.request.kind === 'set') {
        const created = await qolipCreateSet(role.session, { warehouse: s.warehouse, members: specs.map(spec => ({ code: spec.qolipCode, size, color: spec.qolipColor })) }, role.isCurrent);
        if (current(id)) finish(created); return;
      }
      if (!s.product) return;
      let saved: QolipCatalogProduct[];
      try { saved = await qolipSaveProductSpecsBatch(role.session, { warehouse: s.warehouse, product: s.product, specs }, role.isCurrent); }
      catch (error) { if (error instanceof MobileApiException && error.code === 'qolip_code_conflict' && await reuseInput(s, true)) return; throw error; }
      if (!current(id)) return; if (saved.length !== specs.length) throw new Error(t('home.batch_response')); saveProducts(saved, draft.input);
    } catch (error) {
      if (current(id)) {
        const message = error instanceof QolipCatalogValidationError ? error.message : qolipErrorMessage(error, locale, t('home.save_failed'));
        if (s.request.kind === 'spec' || s.request.kind === 'set') await confirm({ title: t('home.save_failed'), message, confirm: 'OK', dismissible: true });
        else patch({ error: message });
      }
    } finally { if (current(id)) patch({ saving: false }); }
  };
  const pickerSearch = async (query: string, mode?: 'product' | 'set') => {
    const s = stateRef.current; if (!s || !current()) return;
    const generation = ++searchSerial.current; pickerLimit.current = 50; patch({ pickerQuery: query, pickerLoading: true, pickerHasMore: false, products: [], sets: [], error: null });
    try {
      if ((mode ?? s.picker) === 'product') { const products = await qolipProducts(role.session, { query, limit: 80 }, role.isCurrent); if (current() && generation === searchSerial.current) patch({ products }); }
      else { const all = pickerCandidates.current ?? await loadSets(), sets = await searchQolipSets(all, query, { isCurrent: current }); if (current() && generation === searchSerial.current) { pickerRows.current = sets; patch({ sets: sets.slice(0, 50), pickerHasMore: sets.length > 50 }); } }
    } catch (error) { if (current() && generation === searchSerial.current) patch({ error: qolipErrorMessage(error, locale) }); }
    finally { if (current() && generation === searchSerial.current) patch({ pickerLoading: false }); }
  };
  const actions: QolipCatalogEditorActions = {
    setCode: raw => { const s = stateRef.current; if (!s || s.saving) return; const code = s.request.kind === 'mold' ? qolipLimitGraphemes(raw, 512) : raw, draft = parseQolipBatchCode(code);
      patch({ code, error: null, suggestions: [], suggestionsFailed: false, suggestionsLoading: !!s.product && !!trimDart(code) && s.request.kind !== 'set' && s.request.kind !== 'edit', colors: s.colors.slice(0, s.request.kind === 'mold' || s.request.kind === 'edit' ? 1 : draft?.count ?? 0) });
      if (timer.current) clearTimeout(timer.current); const generation = ++searchSerial.current;
      if (s.product && s.request.kind !== 'set' && s.request.kind !== 'edit' && trimDart(code)) timer.current = setTimeout(() => {
        void loadSets().then(values => searchQolipSets(values, code, { includeMoldCodes: s.request.kind !== 'mold', isCurrent: current })).then(suggestions => {
          if (current() && generation === searchSerial.current) patch({ suggestions, suggestionsLoading: false });
        }).catch(() => { if (current() && generation === searchSerial.current) patch({ suggestionsFailed: true, suggestionsLoading: false }); });
      }, 200); else patch({ suggestions: [] });
    },
    setSize: size => { const kind = stateRef.current?.request.kind; patch({ size: kind === 'spec' || kind === 'set' ? size.replace(/[^0-9]/g, '') : size, error: null }); }, setExisting: existing => patch({ existing, error: null }),
    chooseColor: color => { const s = stateRef.current; if (!s || s.saving) return;
      if (s.request.kind === 'mold' || s.request.kind === 'edit') { patch({ colors: [color] }); return; }
      const colors = [...s.colors], index = colors.indexOf(color), max = parseQolipBatchCode(s.code)?.count ?? 0;
      if (index >= 0) colors.splice(index, 1); else if (colors.length < max) colors.push(color); patch({ colors }); },
    addPanton: () => { const s = stateRef.current; if (!s || s.saving) return; const next = (s.pantons.at(-1) ?? 0) + 1;
      if (next <= 100 && s.pantons.length < (parseQolipBatchCode(s.code)?.count ?? 0)) patch({ pantons: [...s.pantons, next] }); },
    setWarehouse: warehouse => patch({ warehouse }), loadWarehouses: () => { void warehouses(); },
    chooseProduct: () => { patch({ picker: 'product', pickerQuery: '', products: [] }); void pickerSearch('', 'product'); },
    chooseSet: () => { pickerCandidates.current = null; patch({ picker: 'set', pickerQuery: '', sets: [] }); void pickerSearch('', 'set'); },
    pickerQuery: query => { if (pickerTimer.current) clearTimeout(pickerTimer.current); searchSerial.current++; patch({ pickerQuery: query }); pickerTimer.current = setTimeout(() => { pickerTimer.current = null; void pickerSearch(query); }, 220); },
    pickerMore: () => { const s = stateRef.current; if (!s || s.picker !== 'set' || s.pickerLoading || !s.pickerHasMore || !current()) return; pickerLimit.current += 50; patch({ sets: pickerRows.current.slice(0, pickerLimit.current), pickerHasMore: pickerRows.current.length > pickerLimit.current }); },
    retryPicker: () => { const s = stateRef.current; if (s) void pickerSearch(s.pickerQuery); },
    pickProduct: product => { if (current()) patch({ product, picker: null, size: product.size > 0 ? String(product.size) : '', colors: trimDart(product.color) ? [trimDart(product.color).toUpperCase()] : [] }); },
    reuseSet: entry => { const s = stateRef.current; if (!s?.product || s.saving) return; patch({ saving: true, picker: null });
      void reuse(entry.set, s.product, entry.name).then(saved => { if (saved) saveProducts(saved, entry.set.id); else if (s.request.pickerOnly && current()) finish(); }).catch(error => { if (current()) { if (s.request.pickerOnly) { role.notice(qolipErrorMessage(error, locale)); finish(); } else patch({ error: qolipErrorMessage(error, locale) }); } })
        .finally(() => { if (current()) patch({ saving: false }); }); },
    closePicker: () => { searchSerial.current++; if (pickerTimer.current) clearTimeout(pickerTimer.current); if (stateRef.current?.request.pickerOnly) finish(); else patch({ picker: null, error: null }); }, toggleCodes: () => patch({ expandedCodes: !stateRef.current?.expandedCodes }),
    allSuggestions: () => { const s = stateRef.current; if (!s) return; pickerCandidates.current = s.suggestions; pickerRows.current = s.suggestions; pickerLimit.current = 50; patch({ picker: 'set', pickerQuery: '', sets: s.suggestions.slice(0, 50), pickerHasMore: s.suggestions.length > 50 }); },
    retrySuggestions: () => { if (stateRef.current) actions.setCode(stateRef.current.code); },
    save: () => { void save(); }, close: () => { const s = stateRef.current; if (!s) return; if (!s.saving || s.request.kind === 'spec') finish(s.saved.length ? s.saved : null); },
    printSaved: () => { const s = stateRef.current; if (!s?.saved.length || s.saving) return; patch({ saving: true });
      void printing.printMolds(s.saved.map(p => ({ qolip_code: p.qolip_code, qolip_color: p.color, customer_name: p.customer_names.join(', ') })), { stopOnFailure: true }).then(result => {
        if (current() && result && result.failed === 0) { role.notice(t('home.qr_printed', { count: s.saved.length })); finish(s.saved); }
      }).catch(error => { if (current()) role.notice(qolipErrorMessage(error, locale, t('home.qr_print_failed'))); }).finally(() => patch({ saving: false })); },
  };
  let content: ReactNode = null;
  if (state && role.isCurrent()) {
    const body = <QolipCatalogForm state={{ ...state, picker: null }} actions={actions} canSave={qolipCatalogEditorCanSave(state)} />;
    const base = state.request.pickerOnly ? null : state.request.kind === 'mold' || state.request.kind === 'edit'
      ? <QolipCatalogDialog close={actions.close} preventDismiss={state.saving} dismissOnOutside={state.request.kind !== 'mold'}>{body}</QolipCatalogDialog>
      : <QolipCatalogSpecSheet standalone={state.request.kind === 'set'} saving={state.saving} close={actions.close}>{body}</QolipCatalogSpecSheet>;
    content = <>{base}{state.picker && <WorkerOrderSheet dismissible onClose={actions.closePicker} heightFraction={0.66}><ScrollView keyboardShouldPersistTaps="handled" scrollEventThrottle={100} onScroll={event => { const e = event.nativeEvent; if (e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y <= 240) actions.pickerMore(); }}><QolipCatalogForm state={state} actions={actions} canSave={false} /></ScrollView></WorkerOrderSheet>}</>;
  }
  return { content: <>{content}<QolipCatalogConfirm value={confirmation} /></>,
    openSpec: (input: { initialProduct?: QolipCatalogProduct; lockProduct?: boolean; closeAfterSave?: boolean } = {}) => open<QolipCatalogProduct[]>({ kind: 'spec', ...input }),
    openSet: () => open<QolipManagedSet>({ kind: 'set' }),
    openSetPicker: (product: QolipCatalogProduct) => open<QolipCatalogProduct[]>({ kind: 'spec', initialProduct: product, lockProduct: true, closeAfterSave: true, pickerOnly: true }),
    openMold: (input: Omit<QolipCatalogEditorRequest, 'kind'>) => open<boolean>({ kind: 'mold', ...input }),
    openEdit: (product: QolipCatalogProduct, availablePantonNumber: number | null, set?: QolipSharedSet | null) => open<QolipMoldDraft>({ kind: 'edit', initialProduct: product, initialSize: product.size, initialColor: product.color, availablePantonNumber,
      scope: [set ? shared('edit', { products: set.product_labels.join(', ') }) : '', shared('qr')].filter(Boolean).join('\n\n') }),
    confirm, reuseSet: reuse };
}

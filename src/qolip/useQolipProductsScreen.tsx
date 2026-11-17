import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { extensionText, adminText } from '../shared/localization';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { createQolipCatalogReaders } from './qolipCatalogReadApi';
import { qolipContainerCatalogProduct, qolipContainerKey, type QolipProductContainer } from './qolipProductContainer';
import { QolipProductsState, type QolipCatalogProduct } from './qolipProductsState';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { useQolipFab } from './QolipFabContext';
import { useQolipCatalogEditors } from './useQolipCatalogEditors';
import { qolipAddProductMold, qolipRemoveProductMolds, qolipResolveSet } from './qolipSetsApi';
import { qolipErrorMessage } from './qolipErrorMessage';
import { qolipPantonNumber } from './qolipCatalogEditorTypes';
import { newQolipReworkRequestId } from './qolipReworkRequestId';
import { qolipSendToRework } from './qolipReworkApi';
import { useQolipPrinting } from './useQolipPrinting';
import { shareQolipProductPdf } from './qolipProductPdf';
import { qolipRoleCatalogRuntimeFor } from './qolipRoleCatalogRuntime';
import { qolipSaveProductSpec } from './qolipProductActionsApi';

export function useQolipProductsScreen() {
  const role = useQolipRole(), { locale, text: t } = useQolipText(), editor = useQolipCatalogEditors(), printing = useQolipPrinting();
  const readers = useMemo(() => createQolipCatalogReaders(role.session, role.boundary), [role.session, role.boundary]);
  const catalog = useMemo(() => qolipRoleCatalogRuntimeFor(role.session, role.boundary), [role.session, role.boundary]);
  const controller = useMemo(() => new QolipProductsState(role.boundary, readers, catalog), [role.boundary, readers, catalog]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const [busy, setBusy] = useState(false), locked = useRef(false), [qrProduct, setQrProduct] = useState<QolipCatalogProduct | null>(null), [imageId, setImageId] = useState<string | null>(null);
  const reworkRetry = useRef<{ signature: string; id: string } | null>(null), [sharing, setSharing] = useState<string | null>(null);
  const [addProduct, setAddProduct] = useState<QolipCatalogProduct | null>(null);
  const m = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipManagementText', key, locale, values);
  const rw = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipReworkText', key, locale, values);
  const current = () => controller.current() && role.isCurrent();
  const notifyError = (error: unknown, fallback?: string) => { if (current()) role.notice(qolipErrorMessage(error, locale, fallback)); };
  const command = async (action: () => Promise<void>) => {
    if (!current() || locked.current) return; locked.current = true; setBusy(true);
    try { await action(); } catch (error) { notifyError(error); }
    finally { locked.current = false; if (current()) setBusy(false); }
  };
  const copy = async (code: string, set = false) => { if (!current()) return; await Clipboard.setStringAsync(code); if (current()) role.notice(set ? extensionText('qolipSharedSetText', 'copied', locale) : adminText('detail.code_copied', locale)); };
  const reloadMutation = async (expanded: string | null = null) => { if (current()) await controller.reload(false, expanded); };
  const availablePanton = (product: QolipCatalogProduct) => {
    const used = new Set(state.containers.flatMap(row => row.children).filter(row => row.set_id === product.set_id && row.qolip_code.trim().toLowerCase() !== product.qolip_code.trim().toLowerCase()).map(row => qolipPantonNumber(row.color)));
    return Array.from({ length: 100 }, (_, i) => i + 1).find(number => !used.has(number)) ?? null;
  };
  const edit = (product: QolipCatalogProduct) => command(async () => {
    if (product.is_in_use) return;
    const shared = await qolipResolveSet(role.session, product.set_id, role.isCurrent); if (!current()) return;
    const draft = await editor.openEdit(product, availablePanton(product), shared);
    if (!draft || !current()) return;
    try { await qolipSaveProductSpec(role.session, { product, qolipCode: draft.code, size: draft.sizeDecimal ? BigInt(draft.sizeDecimal) : draft.size ?? 0, qolipColor: draft.color, previousQolipCode: product.qolip_code }, role.isCurrent);
      if (current()) { qolipDataRevision.notifyLocationsChanged(); await reloadMutation(state.expanded); }
    } catch (error) { notifyError(error, t('products.edit_failed')); }
  });
  const addMold = (product: QolipCatalogProduct) => command(async () => {
    const existing = state.containers.flatMap(row => row.children).filter(row => row.code.toLowerCase() === product.code.toLowerCase());
    const used = new Set(existing.map(row => qolipPantonNumber(row.color))), panton = Array.from({ length: 100 }, (_, i) => i + 1).find(n => !used.has(n)) ?? null;
    const saved = await editor.openMold({ scope: `${product.name}\n${m('product_scope')}`, initialProduct: product,
      allowExisting: true, initialSize: existing[0]?.size ?? 0, availablePantonNumber: panton,
      onSave: draft => qolipAddProductMold(role.session, product, draft, role.isCurrent) });
    if (saved && current()) { qolipDataRevision.notifyLocationsChanged(); await reloadMutation(state.expanded); }
  });
  const spec = (product?: QolipCatalogProduct) => command(async () => { await editor.openSpec({ initialProduct: product, lockProduct: !!product }); if (current()) { qolipDataRevision.notifyLocationsChanged(); await reloadMutation(state.expanded); } });
  const remove = () => command(async () => {
    const products = controller.selectedProducts(); if (!products.length || products.some(product => product.is_in_use)) return;
    if (!await editor.confirm({ title: t('products.delete_title'), message: m('local_delete', { count: products.length }), cancel: t('action.cancel'), confirm: t('action.delete'), dismissible: true, vertical: true }) || !current()) return;
    try { const count = await qolipRemoveProductMolds(role.session, products, role.isCurrent); if (!current()) return; qolipDataRevision.notifyLocationsChanged(); role.notice(t('products.deleted', { count })); }
    catch (error) { notifyError(error, t('products.delete_failed')); }
    if (current()) await reloadMutation();
  });
  const sendRework = () => command(async () => {
    const products = controller.selectedProducts(), codes = [...new Map(products.map(p => [p.qolip_code.trim().toLowerCase(), p.qolip_code.trim()])).values()].sort();
    if (!codes.length) return;
    if (!await editor.confirm({ title: rw(state.selectionMode === 'containers' ? 'send_sets' : 'send_molds'), message: rw('send_confirm', { count: codes.length, codes: codes.join(', ') }),
      cancel: t('action.cancel'), confirm: rw('send'), dismissible: true }) || !current()) return;
    const signature = codes.map(code => code.toLowerCase()).join('\u0000');
    if (reworkRetry.current?.signature !== signature) { const id = await newQolipReworkRequestId(); if (!current()) return; reworkRetry.current = { signature, id }; }
    try {
      const rows = await qolipSendToRework(role.session, { requestId: reworkRetry.current!.id, qolipCodes: codes }, role.isCurrent);
      if (!current()) return; controller.reworkAccepted(rows); reworkRetry.current = null; qolipDataRevision.notifyLocationsChanged(); role.notice(rw('sent', { count: codes.length }));
    } catch (error) { notifyError(error, rw('failed')); }
  });
  const printSelected = () => command(async () => {
    const products = controller.selectedProducts(); if (!products.length) return;
    const result = await printing.printMolds(products.map(product => ({ qolip_code: product.qolip_code, qolip_color: product.color, customer_name: product.customer_names.join(', ') })));
    if (current() && result) role.notice(result.failed ? t('products.printed_partial', result) : t('products.printed', { count: products.length }));
  });
  const navigate = (page: string) => { if (current()) router.replace(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-qolip/${page}` as Href); };
  const selected = controller.selectedProducts(), productCodes = new Set(selected.map(product => product.code.trim().toLowerCase())), oneProduct = productCodes.size === 1 ? selected[0] : undefined;
  useQolipFab(state.selectedCodes.size ? [
    { id: 'add', label: t('products.add'), icon: 'inventory_2', symbol: 'shippingbox' },
    { id: 'rework', label: rw(state.selectionMode === 'containers' ? 'send_sets' : 'send_molds'), icon: 'build', symbol: 'wrench.and.screwdriver' },
  ] : [
    { id: 'sets', label: m('title'), icon: 'layers', symbol: 'square.stack.3d.up' },
    { id: 'add', label: t('products.add'), icon: 'inventory_2', symbol: 'shippingbox' },
    { id: 'checkouts', label: t('products.ledger'), icon: 'menu_book', symbol: 'book' },
  ], id => { if (id === 'add') { if (oneProduct) void addMold(oneProduct); else void spec(); } else if (id === 'rework') void sendRework(); else navigate(id); }, !busy && !addProduct);
  const share = async (row: QolipProductContainer) => {
    const key = qolipContainerKey(row); if (!current() || sharing) return; setSharing(key);
    try { const molds = await readers.molds(row.code, current); if (!current()) return; if (!molds.length) throw new Error('Missing product molds');
      await shareQolipProductPdf({ productCode: row.code, productName: molds[0].name, molds, locale }, current); }
    catch { if (current()) role.notice(extensionText('qolipProductPdfText', 'error', locale)); }
    finally { if (current()) setSharing(null); }
  };
  const addChoices = async (row: QolipProductContainer) => {
    const resolved = await controller.ensureDetails(row); if (!resolved || !current()) return;
    const product = qolipContainerCatalogProduct(resolved);
    // Source menu has three independent actions; a role-local presentation owns their dismissal.
    setAddProduct(product);
  };
  return { role, locale, t, m, rw, controller, state, busy, sharing, imageId, setImageId, qrProduct, setQrProduct, addProduct, setAddProduct,
    editor, copy, edit, addMold, spec, remove, sendRework, printSelected, share, addChoices,
    chooseSet: async (product: QolipCatalogProduct) => { setAddProduct(null); await editor.openSetPicker(product); if (current()) await reloadMutation(state.expanded); },
    cancel: () => { if (!busy) controller.cancelSelection(); }, toggleContainer: (row: QolipProductContainer) => { if (!busy) void controller.toggleContainer(row); },
    toggleMold: (product: QolipCatalogProduct) => { if (!busy) controller.toggleMold(product); },
    toggleExpanded: (row: QolipProductContainer) => { if (state.selectionMode === 'containers') { if (!busy) void controller.toggleContainer(row); } else if (!busy) void controller.toggleExpanded(row); },
  };
}

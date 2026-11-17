import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { qolipProducts } from '../qolipProductsApi';
import { extensionText, localizedMethod, productionText } from '../shared/localization';
import { MobileApiException } from '../shared/mobileApiException';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { QolipCatalogConfirm } from './QolipCatalogConfirm';
import { QolipHomePicker } from './QolipHomePicker';
import { QolipQrScannerScreen } from './QolipQrScanner';
import { useQolipRole } from './QolipRoleContext';
import type { QolipCatalogConfirmation } from './qolipCatalogConfirmation';
import { qolipTransferProducts } from './qolipProductActionsApi';
import { QolipProductTransferState, type QolipTransferProduct } from './qolipProductTransferState';
import { qolipScanQr } from './qolipQrApi';
import { qolipTransferRequestId } from './qolipTransferRequestId';
import { qolipErrorMessage } from './qolipErrorMessage';
import { useQolipPresentation } from './useQolipPresentation';
import { useQolipText } from './useQolipText';

const normalized = (value: string) => value.trim().toLowerCase();
export function useQolipProductTransfer() {
  const role = useQolipRole(), { text, locale } = useQolipText(), presentation = useQolipPresentation();
  const [confirmation, setConfirmation] = useState<QolipCatalogConfirmation | null>(null), [scrollRequest, setScrollRequest] = useState<{ code: string; sequence: number } | null>(null);
  const live = useRef({ role, text, locale, presentation });
  useLayoutEffect(() => { live.current = { role, text, locale, presentation }; }, [role, text, locale, presentation]);
  const pending = useRef(new Set<() => void>());
  const showProduct = (title: string, loadPage: (query: string, offset: number, limit: number) => Promise<QolipTransferProduct[]>, candidate = false) => new Promise<QolipTransferProduct | null>(resolve => {
    const env = live.current; if (!env.role.isCurrent() || env.presentation.isOpen()) { resolve(null); return; }
    let result: QolipTransferProduct | null = null, finished = false;
    const finish = () => { if (finished) return; finished = true; pending.current.delete(finish); resolve(env.role.isCurrent() ? result : null); };
    pending.current.add(finish);
    env.presentation.open(<QolipHomePicker<QolipTransferProduct> boundary={env.role.boundary} title={title} hint={env.text('home.product_customer_search')}
      loadPage={loadPage} itemKey={item => normalized(item.code)} itemTitle={item => item.name}
      itemSubtitle={item => candidate ? item.code : [item.code, ...item.customer_names, item.item_group].filter(value => value.trim()).join(' • ')}
      close={() => env.presentation.close()} select={items => { result = items[0]; env.presentation.close(); }} />, { onDismiss: finish });
  });
  // The constructor stores event callbacks; it does not read these refs while rendering.
  // eslint-disable-next-line react-hooks/refs
  const controller = useMemo(() => new QolipProductTransferState({
    current: role.isCurrent,
    products: input => qolipProducts(role.session, input, role.isCurrent),
    transfer: input => qolipTransferProducts(role.session, input, role.isCurrent),
    requestId: qolipTransferRequestId,
    confirm: (from, to, codes, displayed) => new Promise<boolean>(resolve => {
      const env = live.current;
      const finish = (value: boolean) => { pending.current.delete(cancel); setConfirmation(null); resolve(value && env.role.isCurrent()); };
      const cancel = () => finish(false); pending.current.add(cancel);
      setConfirmation({ title: env.text('product_transfer.title'), message: env.text('product_transfer.confirm', { from: `${from.name} (${from.code})`, to: `${to.name} (${to.code})`, codes: displayed.join(', '), count: codes.length }),
        confirm: env.text('product_transfer.confirm_action'), cancel: env.text('action.cancel'), dismissible: true, resolve: finish });
    }),
    scan: () => new Promise<string | null>(resolve => {
      const env = live.current; if (!env.role.isCurrent() || env.presentation.isOpen()) { resolve(null); return; }
      let result: string | null = null, finished = false;
      const finish = () => { if (finished) return; finished = true; pending.current.delete(finish); resolve(env.role.isCurrent() ? result : null); }; pending.current.add(finish);
      env.presentation.open(<QolipQrScannerScreen session={env.role.session} boundary={env.role.boundary} mode="raw" onClose={() => env.presentation.close()}
        onResult={value => { if (typeof value === 'string') result = value; env.presentation.close(); }} />, { presentation: 'page', onDismiss: finish });
    }),
    lookup: code => qolipScanQr(role.session, code, role.isCurrent),
    pickCandidate: candidates => showProduct(live.current.text('product_transfer.source'), async (query, offset, limit) => candidates.filter(item => `${item.code} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(offset, offset + limit), true),
    notice: (key, values) => {
      const env = live.current;
      env.role.notice(key === 'in_use' ? productionText('qolip.error.in_use', env.locale) : key === 'unknown' ? extensionText('qolipSharedSetText', 'transfer', env.locale) : env.text(`product_transfer.${key}`, values));
    },
    error: (error, fallback) => {
      const env = live.current;
      env.role.notice(error instanceof MobileApiException ? error.code === 'qolip_product_transfer_conflict' ? env.text('product_transfer.conflict')
        : qolipErrorMessage(error, env.locale, env.text(`product_transfer.${fallback}`)) : env.text(`product_transfer.${fallback}`));
    },
    changed: () => qolipDataRevision.notifyLocationsChanged(),
    scrollTo: product => setScrollRequest(previous => ({ code: normalized(product.code), sequence: (previous?.sequence ?? 0) + 1 })),
  }), [role.session, role.isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate(); void controller.reload();
    const outstanding = pending.current;
    const stop = role.boundary.subscribe(() => { if (!role.isCurrent()) { controller.suspend(); presentation.close(); for (const finish of outstanding) finish(); outstanding.clear(); } });
    return () => { controller.suspend(); stop(); for (const finish of outstanding) finish(); outstanding.clear(); };
  }, [controller, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickProduct = async (source: boolean) => {
    if (!controller.current() || state.saving || state.scanning) return;
    const product = await showProduct(text(source ? 'product_transfer.source' : 'product_transfer.target'), controller.productPicker(source));
    if (product && controller.current()) controller.selectProduct(source, product);
  };
  const subtitle = (item: QolipTransferProduct) => [item.is_extension ? extensionText('qolipSharedSetText', 'extensions', locale) : '', item.size > 0 ? String(item.size) : '',
    item.color.trim() ? localizedMethod('qolipColorName', locale, { raw: item.color }) : '', item.is_in_use ? productionText('qolip.error.in_use', locale) : ''].filter(Boolean).join(' • ');
  return { ...state, controller, text, scrollRequest, pickProduct: (source: boolean) => { void pickProduct(source); }, subtitle,
    content: <QolipCatalogConfirm value={confirmation} /> };
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { localizedGetter, localizedMethod, uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { refreshHub } from '../shared/notificationStoresRuntime';
import type { SupplierStatusKind } from './supplierApi';
import type { SupplierStore } from './supplierStore';
import { supplierDismissTooltip, supplierMenuTooltip } from './supplierMaterialText';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useSupplierText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return { menuTooltip: supplierMenuTooltip(locale), dismissTooltip: supplierDismissTooltip(locale),
    t: (source: string) => uiText(source, locale), l: (key: string) => localizedGetter(key, locale),
    lm: (key: string, values: Record<string, unknown>) => localizedMethod(key, locale, values) };
}
export function useSupplierStore(store: SupplierStore): SupplierStore {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return store;
}
export function useSupplierRootRefresh(store: SupplierStore, mode: 'home' | 'history'): void {
  useEffect(() => {
    if (mode === 'home') { void store.bootstrapSummary(); void store.bootstrapHistory(); }
    else void store.bootstrapHistory();
    let lastVersion = 0;
    const reload = () => { if (mode === 'home') void store.refreshAll(); else void store.refreshHistory(); };
    const unsubscribe = refreshHub.subscribe(() => {
      if (refreshHub.topic !== 'supplier' || refreshHub.version === lastVersion) return;
      lastVersion = refreshHub.version; reload();
    });
    const app = AppState.addEventListener('change', state => { if (state === 'active') reload(); });
    return () => { unsubscribe(); app.remove(); };
  }, [store, mode]);
}
export function useSupplierBreakdown(store: SupplierStore, kind: SupplierStatusKind): boolean {
  const [ready, setReady] = useState<SupplierStatusKind | null>(null);
  useEffect(() => {
    let active = true;
    const breakdown = store.bootstrapBreakdown(kind);
    const visible = kind === 'pending' || kind === 'submitted' ? store.bootstrapHistory() : breakdown;
    void visible.finally(() => { if (active) setReady(kind); });
    return () => { active = false; };
  }, [store, kind]);
  return ready === kind;
}
export function useSupplierCategory(store: SupplierStore): void {
  useEffect(() => { void store.bootstrapHistory(); }, [store]);
}
export function useSupplierStatusDetail(store: SupplierStore, kind: SupplierStatusKind, itemCode: string): boolean {
  const key = `${kind}:${itemCode}`, [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void store.bootstrapDetail(kind, itemCode).finally(() => { if (active) setReady(key); });
    return () => { active = false; };
  }, [store, kind, itemCode, key]);
  return ready === key;
}

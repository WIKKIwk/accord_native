import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { notificationHiddenStore, notificationUnreadStore, refreshHub } from '../shared/notificationStoresRuntime';
import { SupplierNotificationsController } from './supplierNotificationsController';
import type { SupplierNotificationsProps } from './supplierNotificationsTypes';

export function useSupplierNotifications(props: SupplierNotificationsProps) {
  const [callback] = useState(() => {
    let current = props.onReceipt;
    const open = (id: string) => {
      if (!current) throw new Error('Supplier receipt destination is unavailable');
      current(id);
    };
    return { set: (next?: (id: string) => void) => { current = next; }, open, initial: current ? open : undefined };
  });
  const controller = useMemo(() => new SupplierNotificationsController(props.session, props.store,
    notificationHiddenStore, notificationUnreadStore, callback.initial), [props.session, props.store, callback]);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
  useEffect(() => { callback.set(props.onReceipt); controller.setOnOpenReceipt(props.onReceipt ? callback.open : undefined); },
    [callback, controller, props.onReceipt]);
  useEffect(() => {
    void props.store.bootstrapHistory();
    controller.start();
    let lastVersion = 0;
    const unsubscribe = refreshHub.subscribe(() => {
      if (refreshHub.topic !== 'supplier' || refreshHub.version === lastVersion) return;
      lastVersion = refreshHub.version; void controller.reload();
    });
    const app = AppState.addEventListener('change', state => { if (state === 'active') void controller.reload(); });
    return () => { unsubscribe(); app.remove(); controller.stop(); };
  }, [controller, props.store]);
  return { controller, items: controller.visibleItems, highlighted: controller.highlightedIds, store: props.store };
}

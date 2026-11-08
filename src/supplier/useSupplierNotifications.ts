import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { notificationHiddenStore, notificationUnreadStore, refreshHub } from '../shared/notificationStoresRuntime';
import { SupplierNotificationsController } from './supplierNotificationsController';
import type { SupplierNotificationsProps } from './supplierNotificationsTypes';

const notReady = () => { throw new Error('Supplier notification navigation is not ready'); };
export function useSupplierNotifications(props: SupplierNotificationsProps) {
  const controller = useMemo(() => new SupplierNotificationsController(props.session, props.store,
    notificationHiddenStore, notificationUnreadStore, notReady), [props.session, props.store]);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
  useEffect(() => { controller.setOnOpenReceipt(props.onReceipt); }, [controller, props.onReceipt]);
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

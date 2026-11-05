import { currentSession, registerSessionResetHook } from '../auth';
import { appPreferences } from '../appPreferences';
import { NotificationHiddenStore, NotificationUnreadStore, RefreshHub } from './notificationStores';
import { CustomerDeliveryRuntimeStore, SupplierRuntimeStore, WerkaRuntimeStore } from './dispatchRuntimeStores';

export const notificationHiddenStore = new NotificationHiddenStore(appPreferences, currentSession);
export const notificationUnreadStore = new NotificationUnreadStore(appPreferences, currentSession);
export const refreshHub = new RefreshHub();
export const customerDeliveryRuntimeStore = new CustomerDeliveryRuntimeStore();
export const supplierRuntimeStore = new SupplierRuntimeStore();
export const werkaRuntimeStore = new WerkaRuntimeStore();

registerSessionResetHook(async () => {
  customerDeliveryRuntimeStore.clear();
  supplierRuntimeStore.clear();
  werkaRuntimeStore.clear();
  await notificationUnreadStore.clearAll();
  await notificationHiddenStore.clearAll();
});

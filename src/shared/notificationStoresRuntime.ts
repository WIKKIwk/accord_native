import { currentSession, registerSessionResetHook } from '../auth';
import { appPreferences } from '../appPreferences';
import { NotificationHiddenStore, NotificationUnreadStore, RefreshHub } from './notificationStores';

export const notificationHiddenStore = new NotificationHiddenStore(appPreferences, currentSession);
export const notificationUnreadStore = new NotificationUnreadStore(appPreferences, currentSession);
export const refreshHub = new RefreshHub();

registerSessionResetHook(async () => {
  await notificationUnreadStore.clearAll();
  await notificationHiddenStore.clearAll();
});

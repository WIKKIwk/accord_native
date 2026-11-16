import { registerSessionResetHook } from '../auth';
import { appPreferences } from '../appPreferences';
import { AdminUsersCache } from './adminUsersCache';
import { AdminUsersRoleStore } from './adminUsersRoleStore';

export const adminUsersCache = new AdminUsersCache();
export const adminUsersRoleStore = new AdminUsersRoleStore(appPreferences);
registerSessionResetHook(async () => {
  adminUsersRoleStore.invalidatePending();
  adminUsersCache.invalidate();
});

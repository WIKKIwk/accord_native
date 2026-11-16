import { registerSessionResetHook } from '../auth';
import { AdminItemCreateMemoryCache } from './adminItemCreateCache';

export const adminItemCreateMemoryCache = new AdminItemCreateMemoryCache();
registerSessionResetHook(async () => { adminItemCreateMemoryCache.reset(); });
/** Call only for the original successful customer-create owner's captured namespace. */
export function clearAdminItemCreateCustomerCache(namespace: string) { adminItemCreateMemoryCache.clearCustomers(namespace); }

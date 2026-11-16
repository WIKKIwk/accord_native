import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminSettingsFromJson, type AdminSettings } from './adminSettings';

/** @v2 adminRegenerateWerkaCode */
export async function adminRegenerateWerkaCode(session: Session, guard?: () => void): Promise<AdminSettings> {
  const check = checkedAdminGuard(guard); check?.();
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/werka/code/regenerate', { method: 'POST' }, check);
    check?.();
    if (response.status !== 200) throw new Error('Admin werka code regenerate failed');
    const value: unknown = await response.json(); check?.();
    try { return adminSettingsFromJson(value); } finally { check?.(); }
  } catch (error) { check?.(); throw error; }
}

import type { Session } from '../auth';
import { apparatusFromJson, type AdminApparatus } from '../apparatusApi';
import { authorizedFetch } from '../authorizedFetch';
import { adminApiError } from './adminApiError';
import { checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';
import { dartUriComponent } from './dartUri';

/** Partial f119 live read; Worker projection, error and session/redirect parity remain open. */
export async function adminCanonicalApparatus(session: Session, id: string, guard?: AdminRequestGuard): Promise<AdminApparatus> {
  const check = checkedAdminGuard(guard); check?.();
  const path = `/v1/mobile/admin/apparatus/${dartUriComponent(dartTrim(id))}`;
  let response: Response;
  try { response = await authorizedFetch(session, path, undefined, check); }
  catch (error) { check?.(); throw error; }
  check?.();
  if (response.status !== 200) {
    const error = await adminApiError(response, 'apparatus_load_failed', 'Aparat ma’lumotlari yuklanmadi');
    check?.(); throw error;
  }
  let value: unknown;
  try { value = await response.json(); } catch (error) { check?.(); throw error; }
  check?.();
  return apparatusFromJson(value);
}

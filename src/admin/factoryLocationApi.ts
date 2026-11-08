import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { adminApiError } from './adminApiError';
import { adminFactoryLocationFromJson, type AdminFactoryLocation } from './factoryLocationModel';

const path = '/v1/mobile/admin/factory-locations';
function normalizeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.map(id => id.trim()).filter(id => id && !seen.has(id) && !!seen.add(id));
}
async function decodeMutation(response: Response, code: string, message: string): Promise<AdminFactoryLocation> {
  if (response.status !== 200) throw await adminApiError(response, code, message);
  return adminFactoryLocationFromJson(await response.json());
}
/** @v2 adminFactoryLocations */
export async function adminFactoryLocations(session: Session): Promise<AdminFactoryLocation[]> {
  const response = await authorizedFetch(session, path);
  if (response.status !== 200) throw await adminApiError(response, 'factory_locations_load_failed', 'State’lar yuklanmadi');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid factory locations list');
  return value.filter(item => item !== null && typeof item === 'object' && !Array.isArray(item)).map(adminFactoryLocationFromJson);
}
/** @v2 adminCreateFactoryLocation */
export async function adminCreateFactoryLocation(session: Session, name: string, apparatusIds: readonly string[] = []): Promise<AdminFactoryLocation> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new MobileApiException({ code: 'state_name_required', message: 'State nomini kiriting' });
  const response = await authorizedFetch(session, path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: normalizedName, apparatus_ids: normalizeIds(apparatusIds) }) });
  return decodeMutation(response, 'factory_location_create_failed', 'State yaratilmadi');
}
/** @v2 adminUpdateFactoryLocation */
export async function adminUpdateFactoryLocation(session: Session, id: string,
  options: { name?: string | null; active?: boolean | null } = {}): Promise<AdminFactoryLocation> {
  const normalizedId = id.trim(), name = options.name?.trim(), active = options.active;
  if (!normalizedId || (options.name == null && active == null)) {
    throw new MobileApiException({ code: 'factory_location_update_invalid', message: 'State o‘zgarishi topilmadi' });
  }
  if (options.name != null && !name) throw new MobileApiException({ code: 'state_name_required', message: 'State nomini kiriting' });
  const response = await authorizedFetch(session, `${path}/${encodeURIComponent(normalizedId)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(name != null ? { name } : {}), ...(active != null ? { active } : {}) }),
  });
  return decodeMutation(response, 'factory_location_update_failed', 'State yangilanmadi');
}
/** @v2 adminReplaceFactoryLocationApparatus */
export async function adminReplaceFactoryLocationApparatus(session: Session, id: string,
  apparatusIds: readonly string[]): Promise<AdminFactoryLocation> {
  const normalizedId = id.trim(), ids = normalizeIds(apparatusIds);
  if (!normalizedId) throw new MobileApiException({ code: 'state_not_found', message: 'State topilmadi' });
  const response = await authorizedFetch(session, `${path}/${encodeURIComponent(normalizedId)}/apparatus`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apparatus_ids: ids }),
  });
  return decodeMutation(response, 'factory_location_apparatus_update_failed', 'State apparatlari yangilanmadi');
}

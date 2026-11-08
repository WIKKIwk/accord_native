import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { adminApiError } from './adminApiError';
import { dartJsonString, dartTrim } from './dartJsonString';

const path = '/v1/mobile/admin/apparatus-collections';

/** @v2 AdminApparatusCollection */
export type AdminApparatusCollection = {
  id: string; name: string; apparatusIds: readonly string[]; revision: number;
};
export function adminApparatusCollectionFromJson(value: unknown): AdminApparatusCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid apparatus collection');
  const row = value as Record<string, unknown>;
  const id = row.id == null ? '' : dartTrim(dartJsonString(row.id));
  const name = row.name == null ? '' : dartTrim(dartJsonString(row.name));
  const rawRevision = row.revision;
  if (rawRevision != null && typeof rawRevision !== 'number') throw new TypeError('Invalid apparatus collection revision');
  const revision = rawRevision == null ? 0 : Math.trunc(rawRevision as number);
  if (!/^apparatus-collection:[0-9a-f]{32}$/.test(id) || !name || revision < 1 || !Array.isArray(row.apparatus_ids)) {
    throw new TypeError('Invalid apparatus collection');
  }
  const ids: string[] = [], seen = new Set<string>();
  for (const value of row.apparatus_ids) {
    const item = dartTrim(dartJsonString(value));
    if (!isCanonicalApparatusId(item)) throw new TypeError('Invalid collection apparatus id');
    if (!seen.has(item)) { ids.push(item); seen.add(item); }
  }
  return { id, name, apparatusIds: Object.freeze(ids), revision };
}
function normalizeName(value: string): string {
  const name = dartTrim(value);
  if (!name) throw new MobileApiException({ code: 'apparatus_collection_name_required', message: 'Aparat guruhi nomi kiritilmadi' });
  if ([...name].length > 80) throw new MobileApiException({ code: 'apparatus_collection_name_too_long', message: 'Aparat guruhi nomi juda uzun' });
  return name;
}
function normalizeIds(values: readonly string[]): string[] {
  if (values.length > 500) throw new MobileApiException({ code: 'apparatus_collection_too_many_apparatus', message: 'Aparat guruhida juda ko‘p aparat bor' });
  const ids = new Set<string>();
  for (const value of values) {
    const id = dartTrim(value);
    if (!isCanonicalApparatusId(id)) throw new MobileApiException({ code: 'apparatus_id_invalid', message: 'Canonical apparat ID noto‘g‘ri' });
    ids.add(id);
  }
  return [...ids].sort();
}
function collectionPath(collection: AdminApparatusCollection): string {
  return `${path}/${encodeURIComponent(dartTrim(collection.id))}`;
}
async function mutationResult(response: Response, code: string, message: string): Promise<AdminApparatusCollection> {
  if (response.status !== 200) throw await adminApiError(response, code, message);
  return adminApparatusCollectionFromJson(await response.json());
}
/** @v2 adminApparatusCollections */
export async function adminApparatusCollections(session: Session): Promise<AdminApparatusCollection[]> {
  const response = await authorizedFetch(session, path);
  if (response.status === 404) return [];
  if (response.status !== 200) throw await adminApiError(response, 'apparatus_collections_list_failed', 'Aparat guruhlari yuklanmadi');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid apparatus collections list');
  return value.map(adminApparatusCollectionFromJson);
}
/** @v2 adminCreateApparatusCollection */
export async function adminCreateApparatusCollection(session: Session, name: string, apparatusIds: readonly string[]): Promise<AdminApparatusCollection> {
  const normalizedName = normalizeName(name), ids = normalizeIds(apparatusIds);
  const response = await authorizedFetch(session, path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: normalizedName, apparatus_ids: ids }) });
  return mutationResult(response, 'apparatus_collection_create_failed', 'Aparat guruhi yaratilmadi');
}
/** @v2 adminUpdateApparatusCollection */
export async function adminUpdateApparatusCollection(session: Session, collection: AdminApparatusCollection,
  name: string, apparatusIds: readonly string[]): Promise<AdminApparatusCollection> {
  const normalizedName = normalizeName(name), ids = normalizeIds(apparatusIds);
  const response = await authorizedFetch(session, collectionPath(collection), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_revision: collection.revision, name: normalizedName, apparatus_ids: ids }) });
  return mutationResult(response, 'apparatus_collection_update_failed', 'Aparat guruhi saqlanmadi');
}
/** @v2 adminDeleteApparatusCollection */
export async function adminDeleteApparatusCollection(session: Session, collection: AdminApparatusCollection): Promise<void> {
  const response = await authorizedFetch(session, collectionPath(collection), { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_revision: collection.revision }) });
  if (response.status !== 204) throw await adminApiError(response, 'apparatus_collection_delete_failed', 'Aparat guruhi o‘chirilmadi');
}

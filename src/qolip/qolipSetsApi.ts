import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { qolipCatalogRuntimeFor } from '../shared/qolipCatalogRuntime';
import { dartQuery, dartString, jsonObject, optionalText, qolipApiResponseError, trimDart } from './qolipApiCommon';

type Product = ReturnType<typeof qolipProductFromJson>;
/** @v2 QolipMoldDraft */
export type QolipMoldDraft = { code: string; size?: number; color?: string; existingOnly?: boolean };
/** @v2 QolipSharedSet */
export type QolipSharedSet = { id: string; fingerprint: string; members: Product[]; product_labels: string[] };
/** @v2 QolipManagedSet */
export type QolipManagedSet = { set: QolipSharedSet; source: Product; name: string; display_name: string };

function changed(): MobileApiException {
  return new MobileApiException({ code: 'qolip_set_changed', message: 'qolip_set_changed' });
}

export function qolipSharedSetFromJson(value: unknown): QolipSharedSet {
  const row = jsonObject(value);
  if (!row || !Array.isArray(row.members) || !Array.isArray(row.products)) throw new TypeError('Invalid Qolip set');
  const id = optionalText(row.set_id);
  const members = row.members.map(value => {
    const spec = jsonObject(value);
    if (!spec) throw new TypeError('Invalid Qolip set member');
    return qolipProductFromJson({ ...spec, qolip_set_id: id, code: spec.item_code, name: spec.item_name, has_qolip_spec: true });
  });
  if (!id || members.some(member => !member.qolip_code || member.set_id !== id)) throw changed();
  return { id, fingerprint: optionalText(row.fingerprint), members, product_labels: row.products.map(value => {
    const product = jsonObject(value);
    if (!product) throw new TypeError('Invalid Qolip set product');
    return `${dartString(product.name)} (${dartString(product.code)})`;
  }) };
}

export function qolipManagedSetFromJson(value: unknown): QolipManagedSet {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid managed Qolip set');
  const set = qolipSharedSetFromJson(row), name = trimDart(optionalText(row.name));
  const source = qolipProductFromJson({ warehouse: row.warehouse, code: row.item_code, name: row.item_name, item_group: row.item_group });
  return { set, source, name, display_name: name || set.id };
}

function draftJson(draft: QolipMoldDraft) {
  return { qolip_code: trimDart(draft.code), size: draft.size ?? 0, color: trimDart(draft.color ?? ''),
    existing_only: draft.existingOnly === true };
}

async function send(session: Session, path: string, body?: Record<string, unknown>): Promise<Response> {
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  return authorizedFetch(session, path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function dataFrom(response: Response): Promise<Record<string, unknown>> {
  const data = jsonObject(await response.json());
  if (!data) throw new TypeError('Expected JSON object');
  return data;
}
function applyCatalogIfCurrent(session: Session, scope: string, data: Record<string, unknown>): void {
  if (activeSessionToken(session) && scope === sessionReadScope(session)) {
    qolipCatalogRuntimeFor(session).applyResponse(data, scope);
  }
}

/** @v2 qolipCreateSet */
export async function qolipCreateSet(session: Session, input: { warehouse: string; members: QolipMoldDraft[] }): Promise<QolipManagedSet> {
  const response = await send(session, '/v1/mobile/qolip/sets/create', {
    warehouse: trimDart(input.warehouse), members: input.members.map(draftJson),
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_save_failed', 'Komplekt saqlanmadi');
  return qolipManagedSetFromJson((await dataFrom(response)).set);
}

/** @v2 qolipManagedSets */
export async function qolipManagedSets(session: Session): Promise<QolipManagedSet[]> {
  const response = await send(session, '/v1/mobile/qolip/sets');
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_load_failed', 'Komplektlar yuklanmadi');
  const data = await dataFrom(response);
  if (!Array.isArray(data.sets)) throw new TypeError('Invalid Qolip sets');
  return data.sets.map(qolipManagedSetFromJson);
}

/** @v2 qolipRenameSet */
export async function qolipRenameSet(session: Session, setId: string, name: string): Promise<QolipManagedSet> {
  const normalized = trimDart(name).replace(/\s+/g, ' ');
  if (!normalized || [...normalized].length > 160 || /[\x00-\x1f\x7f-\x9f]/.test(normalized)) {
    throw new MobileApiException({ code: 'qolip_set_name_invalid', message: 'qolip_set_name_invalid' });
  }
  const response = await send(session, '/v1/mobile/qolip/sets/rename', { set_id: setId, name: normalized });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_rename_failed', 'Komplekt nomi saqlanmadi');
  const saved = qolipManagedSetFromJson((await dataFrom(response)).set);
  if (saved.set.id !== setId) throw changed();
  return saved;
}

/** @v2 qolipEditSet */
export async function qolipEditSet(session: Session, input: {
  current: QolipManagedSet; add?: QolipMoldDraft[]; remove?: string[];
}): Promise<QolipManagedSet> {
  const scope = sessionReadScope(session);
  const response = await send(session, '/v1/mobile/qolip/sets', {
    set_id: input.current.set.id, fingerprint: input.current.set.fingerprint,
    add: (input.add ?? []).map(draftJson), remove: input.remove ?? [],
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_save_failed', 'Komplekt saqlanmadi');
  const data = await dataFrom(response);
  applyCatalogIfCurrent(session, scope, data);
  return qolipManagedSetFromJson(data.set);
}

/** @v2 qolipResolveSet */
export async function qolipResolveSet(session: Session, identifier: string): Promise<QolipSharedSet | null> {
  const query = dartQuery({ identifier: trimDart(identifier) });
  const response = await send(session, `/v1/mobile/qolip/shared-sets?${query}`);
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_load_failed', 'Qolip komplekti yuklanmadi');
  const data = await dataFrom(response);
  return data.set == null ? null : qolipSharedSetFromJson(data.set);
}

function sharedMoldForProduct(mold: Product, product: Product): Product {
  return { ...mold, is_extension: false, qolip_set_id: mold.set_id, set_id: mold.set_id,
    code: product.code, name: product.name, item_group: product.item_group, customer_names: product.customer_names,
    first_qolip_code: product.first_qolip_code || mold.qolip_code, has_qolip_spec: true,
    is_in_rework: false, is_in_use: mold.is_in_use, order_image_order_id: '' };
}

/** @v2 qolipReuseSet */
export async function qolipReuseSet(session: Session, set: QolipSharedSet, product: Product): Promise<Product[]> {
  const scope = sessionReadScope(session);
  if (!set.members.length) throw changed();
  const response = await send(session, '/v1/mobile/qolip/shared-sets', {
    set_id: set.id, item_code: product.code, fingerprint: set.fingerprint,
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_save_failed', 'Qolip komplekti ulanmagan');
  const data = await dataFrom(response), saved = qolipSharedSetFromJson(data.set);
  if (saved.id !== set.id || saved.fingerprint !== set.fingerprint) throw changed();
  applyCatalogIfCurrent(session, scope, data);
  return saved.members.map(mold => sharedMoldForProduct(mold, product));
}

async function editProductMolds(session: Session, changes: Record<string, unknown>[]): Promise<void> {
  const scope = sessionReadScope(session), response = await send(session, '/v1/mobile/qolip/product-molds', { changes });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_set_save_failed', 'Mahsulot qoliplari saqlanmadi');
  applyCatalogIfCurrent(session, scope, await dataFrom(response));
}

/** @v2 qolipAddProductMold */
export async function qolipAddProductMold(session: Session, product: Product, draft: QolipMoldDraft): Promise<void> {
  await editProductMolds(session, [{ item_code: product.code, warehouse: product.warehouse, add: [draftJson(draft)] }]);
}

/** @v2 qolipRemoveProductMolds */
export async function qolipRemoveProductMolds(session: Session, molds: Product[]): Promise<number> {
  const groups = new Map<string, Set<string>>();
  for (const mold of molds) {
    let codes = groups.get(mold.code);
    if (!codes) { codes = new Set(); groups.set(mold.code, codes); }
    codes.add(mold.qolip_code);
  }
  await editProductMolds(session, [...groups].map(([itemCode, codes]) => ({ item_code: itemCode, remove: [...codes] })));
  return [...groups.values()].reduce((sum, codes) => sum + codes.size, 0);
}

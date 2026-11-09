import { MobileApiException } from '../shared/mobileApiException';
import { jsonObject, optionalText, trimDart } from './qolipApiCommon';
import { qolipSimpleLower } from './qolipSimpleLower';
import { qolipStorageMoldFromJson, type QolipArchiveEntry, type QolipPaddon, type QolipStorageMold } from './qolipStorageApi';

const lower = qolipSimpleLower;
const productKey = (code: string) => lower(trimDart(code));
const hasLinkedProduct = (mold: QolipStorageMold) => mold.products.some(product => !!trimDart(optionalText(product.code)));
export type QolipStorageProductGroup = Readonly<{ code: string; name: string; key: string; unlinked: boolean; visibleMolds: readonly QolipStorageMold[] }>;

/** @v2 _moldBelongsToProduct */
export function qolipStorageMoldBelongsToProduct(mold: QolipStorageMold, key: string): boolean {
  return key === 'unlinked' ? !hasLinkedProduct(mold) : mold.products.some(product => `product:${productKey(optionalText(product.code))}` === key);
}

/** @v2 _groupStorageProducts */
export function groupQolipStorageProducts(molds: Iterable<QolipStorageMold>, query = ''): readonly QolipStorageProductGroup[] {
  const groups = new Map<string, { code: string; name: string; key: string; unlinked: boolean; visibleMolds: QolipStorageMold[] }>();
  query = lower(trimDart(query));
  for (const mold of molds) {
    const codeMatches = !query || lower(mold.code).includes(query) || lower(mold.set_id).includes(query);
    const products = hasLinkedProduct(mold) ? mold.products.filter(product => !!trimDart(optionalText(product.code))) : [{}];
    for (const product of products) {
      const code = trimDart(optionalText(product.code)), name = trimDart(optionalText(product.name));
      if (!codeMatches && !lower(code).includes(query) && !lower(name).includes(query) && !(code === '' && lower(mold.name).includes(query))) continue;
      const key = code ? `product:${productKey(code)}` : 'unlinked';
      let group = groups.get(key);
      if (!group) { group = { code, name, key, unlinked: !code, visibleMolds: [] }; groups.set(key, group); }
      // V2 adds one occurrence per matching product, including repeated links to the same normalized code.
      group.visibleMolds.push(mold);
    }
  }
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return [...groups.values()].sort((a, b) => a.unlinked !== b.unlinked ? a.unlinked ? 1 : -1 : compare(lower(a.name), lower(b.name)) || compare(a.code, b.code));
}

/** Archive list identity map: distinct saved entries must not collapse just because a code repeats. */
export function qolipArchiveMolds(entries: readonly QolipArchiveEntry[]): ReadonlyMap<QolipStorageMold, QolipArchiveEntry> {
  const result = new Map<QolipStorageMold, QolipArchiveEntry>();
  for (const entry of entries) {
    const row = { ...(jsonObject(entry.snapshot.mold) ?? entry.snapshot) };
    if (row.qolip_code != null && typeof row.qolip_code !== 'string') throw new TypeError('Expected string');
    if (row.qolip_code == null || !trimDart(row.qolip_code)) row.qolip_code = entry.code;
    row.warehouse ??= entry.warehouse;
    result.set(qolipStorageMoldFromJson(row), entry);
  }
  return result;
}

/** @v2 _archivePaddonMoldCount */
export function qolipArchivePaddonMoldCount(entry: QolipArchiveEntry): number | null {
  if (Array.isArray(entry.snapshot.items)) return entry.snapshot.items.length;
  const count = jsonObject(entry.snapshot.paddon)?.item_count;
  if (typeof count !== 'number' || count < 0 || Number.isNaN(count)) return null;
  if (!Number.isFinite(count)) throw new RangeError();
  return Math.trunc(count) || 0;
}

/** @v2 _archivePaddonLocation */
export function qolipArchivePaddonLocation(entry: QolipArchiveEntry): string {
  const location = jsonObject(entry.snapshot.paddon)?.location;
  if (location == null) return '';
  if (typeof location !== 'string') throw new TypeError('Expected string');
  return location;
}

export function qolipPaddonStatusKey(paddon: QolipPaddon): string { return paddon.archived ? 'archived' : paddon.locked ? 'locked' : 'open'; }
export function qolipStorageMoldStatus(mold: QolipStorageMold, warehouse?: string | null): Readonly<{ key: string; code?: string }> {
  if ((warehouse != null && lower(mold.warehouse) !== lower(warehouse)) || mold.custody_mismatch) return { key: 'wrong_warehouse' };
  if (mold.archived) return { key: 'archived' };
  if (mold.in_use) return { key: 'in_use' };
  if (mold.in_rework) return { key: 'in_rework' };
  if (mold.transferring) return { key: 'transferring' };
  if (mold.paddon_code) return { key: 'in_paddon', code: mold.paddon_code };
  return { key: 'available' };
}

export function qolipStorageErrorKey(error: unknown): string {
  const code = error instanceof MobileApiException ? error.code : '';
  const keys: Readonly<Record<string, string>> = {
    session_scope_changed: 'session_changed', qolip_in_use: 'in_use', qolip_in_rework: 'in_rework', qolip_in_transfer: 'transferring',
    qolip_warehouse_mismatch: 'wrong_warehouse', qolip_storage_warehouse_changed: 'wrong_warehouse', qolip_paddon_locked: 'locked_error',
    qolip_archived: 'archived_error', qolip_in_paddon: 'in_paddon_error', qolip_paddon_empty: 'empty_error', qolip_paddon_not_empty: 'paddon_not_empty',
    qolip_storage_forbidden: 'forbidden_error', forbidden: 'forbidden_error', qolip_paddon_capacity: 'capacity_error',
    qolip_storage_too_many_items: 'capacity_error', qolip_storage_not_found: 'not_found',
  };
  return Object.hasOwn(keys, code) ? keys[code] : error instanceof MobileApiException && error.statusCode === 409 ? 'changed' : 'failed';
}

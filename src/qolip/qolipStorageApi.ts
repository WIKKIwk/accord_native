import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { qolipCatalogRuntimeFor } from '../shared/qolipCatalogRuntime';
import { dartQuery, dartString, jsonObject, optionalInteger, trimDart } from './qolipApiCommon';

type JsonObject = Record<string, unknown>;
/** @v2 QolipStoragePage */
export type QolipStoragePage<T> = { items: T[]; next_offset: number | null };
/** @v2 QolipPaddon */
export type QolipPaddon = { code: string; warehouse: string; location: string; note: string; archive_entry_id: string | null;
  locked: boolean; archived: boolean; revision: number; total_quantity: number; item_count: number; editable: boolean };
/** @v2 QolipStorageMold */
export type QolipStorageMold = { code: string; set_id: string; item_code: string; warehouse: string; name: string; color: string;
  size: number; quantity: number; paddon_code: string; archived: boolean; in_use: boolean; in_rework: boolean;
  transferring: boolean; custody_mismatch: boolean; products: JsonObject[]; available: boolean; product_names: string };
/** @v2 QolipPaddonDetail */
export type QolipPaddonDetail = { paddon: QolipPaddon; items: QolipStorageMold[]; history: JsonObject[]; inspection: JsonObject | null };
/** @v2 QolipArchiveEntry */
export type QolipArchiveEntry = { id: string; kind: string; code: string; warehouse: string; archived_at: string;
  restored_at: string | null; archived_by: string; restored_by: string; parent_paddon_code: string; note: string;
  snapshot: JsonObject; is_open: boolean };

function requiredObject(value: unknown): JsonObject {
  const result = jsonObject(value);
  if (!result) throw new TypeError('Expected JSON object');
  return result;
}
function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Expected string');
  return value;
}
function nullableString(value: unknown): string | null { return value == null ? null : requiredString(value); }
function requiredBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected boolean');
  return value;
}
function requiredInteger(value: unknown): number {
  const number = optionalInteger(value);
  if (number == null) throw new TypeError('Expected number');
  return number;
}
function mapList(value: unknown, optional = false): JsonObject[] {
  if (value == null && optional) return [];
  if (!Array.isArray(value)) throw new TypeError('Expected list');
  return value.map(item => ({ ...requiredObject(item) }));
}

export function qolipPaddonFromJson(value: unknown): QolipPaddon {
  const row = requiredObject(value), code = requiredString(row.code), warehouse = requiredString(row.warehouse);
  const locked = requiredBoolean(row.locked), archived = requiredBoolean(row.archived);
  const revision = requiredInteger(row.revision), count = requiredInteger(row.item_count);
  if (!code || !warehouse || revision < 0 || count < 0) throw new TypeError('Invalid mold pallet');
  return { code, warehouse, location: nullableString(row.location) ?? '', note: nullableString(row.note) ?? '',
    archive_entry_id: nullableString(row.archive_entry_id), locked, archived, revision,
    total_quantity: optionalInteger(row.total_quantity) ?? count, item_count: count, editable: !locked && !archived };
}

export function qolipStorageMoldFromJson(value: unknown): QolipStorageMold {
  const row = requiredObject(value), code = requiredString(row.qolip_code);
  if (!trimDart(code)) throw new TypeError('Invalid mold');
  const paddonCode = nullableString(row.paddon_code) ?? '', archived = row.archived === true, inUse = row.is_in_use === true;
  const inRework = row.is_in_rework === true, transferring = row.is_transferring === true, mismatch = row.is_custody_mismatch === true;
  const products = mapList(row.products, true), name = nullableString(row.item_name) ?? '';
  return { code, set_id: nullableString(row.qolip_set_id) ?? '', item_code: nullableString(row.item_code) ?? '',
    warehouse: nullableString(row.warehouse) ?? '', name, color: nullableString(row.color) ?? '',
    size: optionalInteger(row.size) ?? 0, quantity: optionalInteger(row.quantity) ?? 0, paddon_code: paddonCode,
    archived, in_use: inUse, in_rework: inRework, transferring, custody_mismatch: mismatch, products,
    available: !archived && !inUse && !inRework && !transferring && !mismatch && !paddonCode,
    product_names: products.length ? products.map(product => dartString(product.name)).join(', ') : name };
}

export function qolipPaddonDetailFromJson(value: unknown): QolipPaddonDetail {
  const row = requiredObject(value);
  if (!Array.isArray(row.items)) throw new TypeError('Expected pallet items');
  return { paddon: qolipPaddonFromJson(row.paddon), items: row.items.map(qolipStorageMoldFromJson),
    history: mapList(row.history, true), inspection: jsonObject(row.inspection) ? { ...jsonObject(row.inspection)! } : null };
}

export function qolipArchiveEntryFromJson(value: unknown): QolipArchiveEntry {
  const row = requiredObject(value), id = requiredString(row.id), kind = requiredString(row.kind);
  const parent = nullableString(row.parent_paddon_code) ?? '', restored = nullableString(row.restored_at);
  if (!id || !['qolip', 'paddon', 'paddon_mold'].includes(kind) || (kind === 'paddon_mold' && !parent)) {
    throw new TypeError('Invalid archive entry');
  }
  return { id, kind, code: requiredString(row.code), warehouse: requiredString(row.warehouse),
    archived_at: requiredString(row.archived_at), restored_at: restored, archived_by: nullableString(row.archived_by_name) ?? '',
    restored_by: nullableString(row.restored_by_name) ?? '', parent_paddon_code: parent, note: nullableString(row.note) ?? '',
    snapshot: { ...requiredObject(row.snapshot) }, is_open: restored === null };
}

function scopeGuard(session: Session, scope: string) {
  return () => {
    if (!activeSessionToken(session) || scope !== sessionReadScope(session)) {
      throw new MobileApiException({ code: 'session_scope_changed', message: 'Session changed' });
    }
  };
}

export async function storageRequest(session: Session, path: string, query: Record<string, string> = {}, body?: JsonObject): Promise<JsonObject> {
  const scope = sessionReadScope(session), guard = scopeGuard(session, scope), suffix = dartQuery(query);
  const target = `/v1/mobile/qolip/${path}${suffix ? `?${suffix}` : ''}`;
  guard();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  const response = await authorizedFetch(session, target, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(body),
  }, guard);
  guard();
  const raw = await response.text();
  guard();
  if (path === 'archive' && query.view === 'molds' && response.status === 400 &&
      (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/plain') &&
      raw.startsWith('Failed to deserialize query string:') && raw.includes('unknown field `view`')) {
    throw new MobileApiException({ code: 'qolip_archive_view_unsupported', message: 'Archive mold view is unsupported', statusCode: 400 });
  }
  const data = requiredObject(JSON.parse(raw));
  guard();
  if (response.status !== 200 || data.ok !== true) {
    throw new MobileApiException({ code: dartString(data.error ?? data.code ?? 'qolip_storage_failed'),
      message: dartString(data.message ?? data.error ?? 'Qolip storage failed'), statusCode: response.status });
  }
  if (body !== undefined && !path.endsWith('/qr/print') && activeSessionToken(session) && scope === sessionReadScope(session)) {
    qolipCatalogRuntimeFor(session).applyResponse(data, scope);
  }
  return data;
}

function page<T>(data: JsonObject, key: string, decode: (value: unknown) => T): QolipStoragePage<T> {
  const items = data[key];
  if (!Array.isArray(items)) throw new TypeError('Expected storage page items');
  return { items: items.map(decode), next_offset: data.has_more === true ? requiredInteger(data.next_offset) : null };
}

/** @v2 qolipPaddons */
export async function qolipPaddons(session: Session, input: { archived?: boolean; query?: string; offset?: number } = {}): Promise<QolipStoragePage<QolipPaddon>> {
  const data = await storageRequest(session, 'paddons', { archived: String(input.archived ?? false), q: input.query ?? '',
    limit: '100', offset: String(input.offset ?? 0) });
  return page(data, 'paddons', qolipPaddonFromJson);
}

/** @v2 qolipPaddonDetail */
export async function qolipPaddonDetail(session: Session, code: string): Promise<QolipPaddonDetail> {
  return qolipPaddonDetailFromJson(await storageRequest(session, 'paddons/detail', { code }));
}

/** @v2 qolipStorageMolds */
export async function qolipStorageMolds(session: Session, input: { query?: string; code?: string; offset?: number } = {}): Promise<QolipStoragePage<QolipStorageMold>> {
  const data = await storageRequest(session, 'paddons/molds', { ...(input.code ? { code: input.code } : {}),
    q: input.query ?? '', limit: '100', offset: String(input.offset ?? 0) });
  return page(data, 'molds', qolipStorageMoldFromJson);
}

/** @v2 qolipStorageSet */
export async function qolipStorageSet(session: Session, setId: string, warehouse?: string | null): Promise<QolipStorageMold[]> {
  const found = new Map<string, QolipStorageMold>(), scope = sessionReadScope(session), guard = scopeGuard(session, scope);
  let offset = 0;
  while (true) {
    const current = await qolipStorageMolds(session, { query: setId, offset });
    guard();
    for (const mold of current.items) if (mold.set_id === setId) found.set(mold.code.toLowerCase(), mold);
    if (current.next_offset === null) break;
    if (current.next_offset <= offset || current.next_offset >= 1000) {
      throw new MobileApiException({ code: 'qolip_storage_too_many_items', message: 'Set selection exceeds limit' });
    }
    offset = current.next_offset;
  }
  if (!found.size) throw new MobileApiException({ code: 'qolip_storage_not_found', message: 'Set not found' });
  const blocked = [...found.values()].filter(mold => !mold.available ||
    (warehouse != null && mold.warehouse.toLowerCase() !== warehouse.toLowerCase()));
  if (blocked.length) throw new MobileApiException({ code: 'qolip_set_unavailable',
    message: 'Some set members are unavailable', details: blocked.map(mold => mold.code) });
  return [...found.values()];
}

/** @v2 qolipPaddonAction */
export async function qolipPaddonAction(session: Session, body: JsonObject): Promise<QolipPaddonDetail> {
  return qolipPaddonDetailFromJson(await storageRequest(session, 'paddons/action', {}, body));
}

/** @v2 qolipDeletePaddon */
export async function qolipDeletePaddon(session: Session, body: JsonObject): Promise<void> {
  const data = await storageRequest(session, 'paddons/action', {}, body);
  if (data.deleted !== true || data.code !== body.code) throw new TypeError('Invalid pallet deletion response');
}

/** @v2 qolipStorageDate */
export function qolipStorageDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type ArchiveInput = { status?: string; view?: string; query?: string; offset?: number; warehouse?: string; from?: Date | null; to?: Date | null };
/** @v2 qolipArchive */
export async function qolipArchive(session: Session, input: ArchiveInput = {}): Promise<QolipStoragePage<QolipArchiveEntry>> {
  const scope = sessionReadScope(session), status = input.status ?? 'open', view = input.view ?? '', offset = input.offset ?? 0;
  const query = input.query ?? '', warehouse = input.warehouse ?? '';
  try {
    const data = await storageRequest(session, 'archive', { status, ...(view ? { view } : {}), ...(warehouse ? { warehouse } : {}),
      ...(input.from ? { from: qolipStorageDate(input.from) } : {}), ...(input.to ? { to: qolipStorageDate(input.to) } : {}),
      q: query, limit: '100', offset: String(offset) });
    return page(data, 'entries', qolipArchiveEntryFromJson);
  } catch (error) {
    if (view !== 'molds' || !(error instanceof MobileApiException) || error.code !== 'qolip_archive_view_unsupported') throw error;
    return legacyArchiveMolds(session, { status, query, offset, warehouse, from: input.from, to: input.to }, scope);
  }
}

async function legacyArchiveMolds(session: Session, input: Required<Pick<ArchiveInput, 'status' | 'query' | 'offset' | 'warehouse'>> &
  Pick<ArchiveInput, 'from' | 'to'>, scope: string): Promise<QolipStoragePage<QolipArchiveEntry>> {
  const guard = scopeGuard(session, scope), matches: QolipArchiveEntry[] = [], search = trimDart(input.query).toLowerCase();
  let sourceOffset = 0, seen = 0;
  while (true) {
    guard();
    const current = await qolipArchive(session, { status: input.status, query: input.query, offset: sourceOffset,
      warehouse: input.warehouse, from: input.from, to: input.to });
    guard();
    for (const entry of current.items) {
      const candidates: QolipArchiveEntry[] = [];
      if (entry.kind === 'qolip') candidates.push(entry);
      else if (entry.kind === 'paddon' && Array.isArray(entry.snapshot.items)) {
        for (const raw of entry.snapshot.items) {
          const mold = jsonObject(raw), code = mold?.qolip_code;
          if (!mold || typeof code !== 'string' || !trimDart(code)) continue;
          candidates.push(qolipArchiveEntryFromJson({ id: entry.id, kind: 'paddon_mold', code, warehouse: entry.warehouse,
            archived_at: entry.archived_at, restored_at: entry.restored_at, archived_by_name: entry.archived_by,
            restored_by_name: entry.restored_by, note: entry.note, parent_paddon_code: entry.code, snapshot: mold }));
        }
        candidates.sort((a, b) => {
          const first = a.code.toLowerCase(), second = b.code.toLowerCase();
          return first === second ? (a.code === b.code ? 0 : a.code < b.code ? -1 : 1) : first < second ? -1 : 1;
        });
      }
      for (const candidate of candidates) {
        if (search && !candidate.code.toLowerCase().includes(search) && !candidate.parent_paddon_code.toLowerCase().includes(search) &&
            !JSON.stringify(candidate.snapshot).toLowerCase().includes(search)) continue;
        if (seen++ < input.offset) continue;
        matches.push(candidate);
        if (matches.length > 100) return { items: matches.slice(0, 100), next_offset: input.offset + 100 };
      }
    }
    if (current.next_offset === null) return { items: matches, next_offset: null };
    if (current.next_offset <= sourceOffset || !current.items.length) {
      throw new MobileApiException({ code: 'qolip_storage_invalid_page', message: 'Invalid archive page' });
    }
    sourceOffset = current.next_offset;
  }
}

/** @v2 qolipArchiveAction */
export async function qolipArchiveAction(session: Session, body: JsonObject): Promise<QolipArchiveEntry[]> {
  const data = await storageRequest(session, 'archive/action', {}, body);
  if (!Array.isArray(data.entries)) throw new TypeError('Expected archive entries');
  return data.entries.map(qolipArchiveEntryFromJson);
}

/** @v2 qolipPaddonCodeFromQr */
export function qolipPaddonCodeFromQr(raw: string): string | null {
  const value = trimDart(raw), prefix = 'qolip-paddon:';
  if (!value.startsWith(prefix)) return null;
  const code = value.substring(prefix.length);
  return /^QP-[0-9]{5,}$/.test(code) ? code : null;
}

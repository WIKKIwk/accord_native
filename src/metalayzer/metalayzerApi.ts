import { captureSessionWitness, currentSession, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';

export type MetalayzerMaterial = { barcode: string; itemCode: string; itemName: string; warehouse: string; qty: number; uom: string; isMetalayzer: boolean };
export class MetalayzerFormatError extends Error {}
export class MetalayzerStateError extends Error {}

/** @v2 MetalayzerMaterial.fromJson */
export function parseMetalayzerMaterial(value: unknown, allowZero = false): MetalayzerMaterial {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MetalayzerFormatError('Xomashyo ma’lumotlari olinmadi');
  const row = value as Record<string, unknown>;
  if (typeof row.barcode !== 'string' || !row.barcode.trim() || typeof row.is_metalayzer !== 'boolean' ||
      typeof row.qty !== 'number' || !Number.isFinite(row.qty) || (allowZero ? row.qty < 0 : row.qty <= 0)) throw new MetalayzerFormatError('Xomashyo ma’lumotlari olinmadi');
  const string = (key: string): string => {
    const value = row[key];
    if (value == null) return '';
    if (typeof value !== 'string') throw new TypeError('Invalid string');
    return value;
  };
  return { barcode: row.barcode, itemCode: string('item_code'), itemName: string('item_name'), warehouse: string('warehouse'),
    qty: row.qty, uom: string('uom'), isMetalayzer: row.is_metalayzer };
}

/** @v2 metalayzerScope */
export function metalayzerScope(session: Session | null = currentSession()): string {
  if (!session || currentSession() !== session || !session.token || session.token === 'test-mode-token' ||
      session.profile.role !== 'metalayzer' || !session.capabilities.includes('metalayzer.access')) {
    throw new MetalayzerStateError('Metalayzer huquqi kerak');
  }
  return sessionReadScope(session);
}

async function request(session: Session, barcode: string, complete: boolean, witness?: SessionWitness | null): Promise<MetalayzerMaterial> {
  const scope = metalayzerScope(session), ticket = witness === undefined ? captureSessionWitness(session) : witness, code = barcode.trim();
  if (!code) throw new MetalayzerFormatError('Xomashyo QR kodini kiriting');
  const guard = () => {
    if (!isSessionWitnessCurrent(ticket) || metalayzerScope(session) !== scope) throw new MetalayzerStateError('Akkaunt o‘zgargan');
  };
  guard();
  const endpoint = complete ? '/v1/mobile/metalayzer/complete' : `/v1/mobile/metalayzer/material?${new URLSearchParams({ barcode: code })}`;
  const response = await authorizedFetch(session, endpoint, complete ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: code }) } : {}, guard);
  guard();
  let row: Record<string, unknown> | null = null;
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) row = value as Record<string, unknown>;
  } catch { /* V2 treats invalid JSON as a request failure. */ }
  guard();
  if (response.status !== 200 || !row) throw new MobileApiException({ code: typeof row?.code === 'string' ? row.code : 'metalayzer_request_failed',
    statusCode: response.status, message: typeof row?.error === 'string' ? row.error : 'Xomashyoni tekshiring yoki qayta urinib ko‘ring' });
  const material = parseMetalayzerMaterial(row);
  if (material.barcode.trim().toLowerCase() !== code.toLowerCase() || (complete && !material.isMetalayzer)) {
    throw new MetalayzerFormatError('Metalayzer natijasi tasdiqlanmadi');
  }
  return material;
}

/** @v2 metalayzerMaterial */
export const metalayzerMaterial = (session: Session, barcode: string, witness?: SessionWitness | null) => request(session, barcode, false, witness);
/** @v2 metalayzerComplete */
export const metalayzerComplete = (session: Session, barcode: string, witness?: SessionWitness | null) => request(session, barcode, true, witness);

export type MetalayzerPage = { items: MetalayzerMaterial[]; nextCursor: string | null };

export async function metalayzerMaterials(session: Session, cursor: string | null,
  witness: SessionWitness | null, requestCurrent: () => boolean): Promise<MetalayzerPage> {
  const scope = metalayzerScope(session);
  const isCurrent = () => {
    try { return requestCurrent() && isSessionWitnessCurrent(witness) && metalayzerScope(session) === scope; }
    catch { return false; }
  };
  const guard = () => {
    if (!isCurrent()) throw new MetalayzerStateError('Akkaunt o‘zgargan');
  };
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  guard();
  const response = await authorizedFetch(session, `/v1/mobile/metalayzer/materials?${params}`, {}, guard, 10_000, { readWitness: isCurrent });
  guard();
  let data: unknown;
  try { data = await response.json(); } catch { data = null; }
  guard();
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
  if (response.status !== 200 || !row) throw new MobileApiException({
    code: typeof row?.code === 'string' ? row.code : 'metalayzer_list_failed', statusCode: response.status,
    message: typeof row?.error === 'string' ? row.error : 'Ro‘yxatni yuklab bo‘lmadi',
  });
  if (!Array.isArray(row.items) || !(row.next_cursor === null || (typeof row.next_cursor === 'string' && row.next_cursor.length > 0)) ||
      (row.next_cursor !== null && row.next_cursor === cursor)) throw new MetalayzerFormatError('Xomashyo ro‘yxati tasdiqlanmadi');
  const items = row.items.map(value => parseMetalayzerMaterial(value, true));
  if (items.some(item => !item.isMetalayzer) || (row.next_cursor !== null && items.length === 0)) {
    throw new MetalayzerFormatError('Xomashyo ro‘yxati tasdiqlanmadi');
  }
  return { items, nextCursor: row.next_cursor };
}

/** @v2 formatQuantityWithUnit */
export function formatMetalayzerQuantity(qty: number, uom: string): string {
  const value = Number.isInteger(qty) ? qty.toFixed(0) : qty.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return [value, uom.trim()].filter(Boolean).join(' ');
}

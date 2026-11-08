import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
const trim = (value: string) => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');

// The JSON fields are normally strings; Dart also calls toString on optional fields.
function dartString(value: unknown): string {
  if (value == null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartString).join(', ')}]`;
  const row = object(value);
  if (row) return `{${Object.entries(row).map(([key, item]) => `${key}: ${dartString(item)}`).join(', ')}}`;
  return String(value);
}
const optionalText = (value: unknown) => value == null ? '' : dartString(value);
function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Expected string');
  return value;
}
function nullableString(value: unknown): string | null {
  return value == null ? null : requiredString(value);
}
function requiredNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected number');
  return value;
}

// DateTime.tryParse accepts Dart's ISO-8601 forms and normalizes overflow.
function isDartDateTime(value: string): boolean {
  const match = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3]);
  const hour = Number(match[4] ?? 0), second = Number(match[6] ?? 0);
  const fraction = Number((match[7] ?? '').slice(0, 3).padEnd(3, '0'));
  let minute = Number(match[5] ?? 0);
  if (match[9]) minute -= (match[9] === '-' ? -1 : 1) * (Number(match[10]) * 60 + Number(match[11] ?? 0));
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, fraction);
  return Number.isFinite(date.getTime());
}

/** @v2 QolipReworkEntry */
export type QolipReworkEntry = {
  id: string; qolip_code: string; qolip_set_id: string; warehouse: string; item_code: string;
  item_name: string; color: string; size: number; sent_at: string; returned_at: string | null;
  is_open: boolean;
};

export function qolipReworkEntryFromJson(value: unknown): QolipReworkEntry {
  const row = object(value);
  if (!row) throw new TypeError('Invalid mold rework record');
  const id = requiredString(row.id), code = requiredString(row.qolip_code), sentAt = requiredString(row.sent_at);
  const returnedAt = nullableString(row.returned_at);
  if (!trim(id) || !trim(code) || !isDartDateTime(sentAt) || (returnedAt !== null && !isDartDateTime(returnedAt))) {
    throw new TypeError('Invalid mold rework record');
  }
  return {
    id, qolip_code: code, qolip_set_id: optionalText(row.qolip_set_id), warehouse: optionalText(row.warehouse),
    item_code: optionalText(row.item_code), item_name: optionalText(row.item_name), color: optionalText(row.color),
    size: row.size == null ? 0 : Math.trunc(requiredNumber(row.size)), sent_at: sentAt, returned_at: returnedAt,
    is_open: returnedAt === null,
  };
}

/** @v2 QolipMileageCycle */
export type QolipMileageCycle = { id: string; started_at: string; ended_at: string | null; meter: number; rework_id: string };
/** @v2 QolipMileage */
export type QolipMileage = { qolip_code: string; tracking_enabled: boolean; current_meter: number | null; cycles: QolipMileageCycle[] };
export function qolipMileageFromJson(value: unknown): QolipMileage {
  const row = object(value);
  if (!row || !Array.isArray(row.cycles)) throw new TypeError('Invalid mold mileage');
  const cycles = row.cycles.map(value => {
    const cycle = object(value);
    if (!cycle) throw new TypeError('Invalid mold mileage cycle');
    return { id: requiredString(cycle.id), started_at: requiredString(cycle.started_at),
      ended_at: nullableString(cycle.ended_at), meter: requiredNumber(cycle.meter), rework_id: requiredString(cycle.rework_id) };
  });
  return { qolip_code: requiredString(row.qolip_code), tracking_enabled: row.tracking_enabled === true,
    current_meter: row.current_meter == null ? null : requiredNumber(row.current_meter), cycles };
}

function requireScope(session: Session) {
  const scope = sessionReadScope(session);
  return () => {
    if (scope !== sessionReadScope(session) || !activeSessionToken(session)) {
      throw new MobileApiException({ code: 'session_scope_changed', message: 'Sessiya o‘zgardi. Sahifani yangilang.' });
    }
  };
}

async function responseError(response: Response, fallbackCode: string, fallbackMessage: string): Promise<MobileApiException> {
  let code = fallbackCode, message = fallbackMessage;
  try {
    const row = object(await response.json());
    if (row) {
      code = optionalText(row.error ?? row.code ?? fallbackCode);
      const serverMessage = trim(optionalText(row.message));
      if (serverMessage) message = serverMessage;
    }
  } catch { /* V2 keeps its fallback code and message for an invalid error body. */ }
  return new MobileApiException({ code, message, statusCode: response.status });
}

async function request(session: Session, path: string, fallbackCode: string, fallbackMessage: string,
  body?: JsonObject): Promise<JsonObject> {
  const guard = requireScope(session);
  // V2 checks test mode asynchronously; the shared test-mode pass is still pending.
  await Promise.resolve();
  guard();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  const response = await authorizedFetch(session, path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, guard);
  guard();
  if (response.status !== 200) throw await responseError(response, fallbackCode, fallbackMessage);
  const data: unknown = await response.json();
  guard();
  const result = object(data);
  if (!result) throw new TypeError('Expected JSON object');
  return result;
}

function decodeReworks(data: JsonObject): QolipReworkEntry[] {
  if (!Array.isArray(data.reworks)) throw new TypeError('Invalid mold rework records');
  return data.reworks.map(qolipReworkEntryFromJson);
}

/** @v2 qolipReworks */
export async function qolipReworks(session: Session, status: 'open' | 'returned' | 'all' = 'open'): Promise<QolipReworkEntry[]> {
  if (!['open', 'returned', 'all'].includes(status)) throw new TypeError('Invalid mold rework status');
  const query = new URLSearchParams({ status });
  return decodeReworks(await request(session, `/v1/mobile/qolip/reworks?${query}`,
    'qolip_rework_failed', 'Peredelkadagi qoliplar yuklanmadi'));
}

/** @v2 qolipSendToRework */
export async function qolipSendToRework(session: Session, input: { requestId: string; qolipCodes: string[] }): Promise<QolipReworkEntry[]> {
  const codes = [...new Set(input.qolipCodes.map(code => trim(code).toLowerCase()))].sort();
  if (!trim(input.requestId) || !codes.length || codes.length > 1000 || codes.some(code => !code)) throw new TypeError('Select mold codes');
  const rows = decodeReworks(await request(session, '/v1/mobile/qolip/reworks/send', 'qolip_rework_failed',
    'Qoliplar peredelkaga berilmadi', { request_id: input.requestId, qolip_codes: codes }));
  const returned = new Set(rows.map(row => row.qolip_code.toLowerCase()));
  if (rows.length !== codes.length || returned.size !== codes.length || codes.some(code => !returned.has(code)) ||
      rows.some(row => !row.is_open)) throw new TypeError('Incomplete mold rework response');
  return rows;
}

/** @v2 qolipReturnFromRework */
export async function qolipReturnFromRework(session: Session, input: { requestId: string; reworkIds: string[] }): Promise<QolipReworkEntry[]> {
  const ids = [...new Set(input.reworkIds.map(trim))].sort();
  if (!trim(input.requestId) || !ids.length || ids.length > 1000 || ids.some(id => !id)) throw new TypeError('Select rework records');
  const rows = decodeReworks(await request(session, '/v1/mobile/qolip/reworks/return', 'qolip_rework_failed',
    'Qoliplar qaytarilmadi', { request_id: input.requestId, rework_ids: ids }));
  const returned = new Set(rows.map(row => row.id));
  if (rows.length !== ids.length || returned.size !== ids.length || ids.some(id => !returned.has(id)) ||
      rows.some(row => row.is_open)) throw new TypeError('Incomplete mold return response');
  return rows;
}

/** @v2 qolipMileage */
export async function qolipMileage(session: Session, qolipCode: string): Promise<QolipMileage> {
  const code = trim(qolipCode), query = new URLSearchParams({ qolip_code: code });
  const data = await request(session, `/v1/mobile/qolip/mileage?${query}`, 'qolip_mileage_failed', 'Probeg yuklanmadi');
  const result = qolipMileageFromJson(data.mileage);
  if (result.qolip_code.toLowerCase() !== code.toLowerCase()) throw new TypeError('Mold mileage identity changed');
  return result;
}

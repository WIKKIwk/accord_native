import { MobileApiException } from '../shared/mobileApiException';

export type JsonObject = Record<string, unknown>;
export const jsonObject = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
export const trimDart = (value: string) => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
// Dart Uri.replace(queryParameters: ...) omits '=' for an empty value.
export function dartQuery(values: Record<string, string>): string {
  const encode = (value: string) => encodeURIComponent(value)
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
  return Object.entries(values).map(([key, value]) => {
    const encoded = encode(key);
    return value === '' ? encoded : `${encoded}=${encode(value)}`;
  }).join('&');
}

// Dart DateTime.tryParse treats date-only and offset-free values as local time.
export function parseDartDateTime(value: string): Date | null {
  const match = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3]), hour = Number(match[4] ?? 0);
  let minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0), millisecond = Number((match[7] ?? '').slice(0, 3).padEnd(3, '0'));
  const date = new Date(0);
  if (match[8]) {
    if (match[9]) minute -= (match[9] === '-' ? -1 : 1) * (Number(match[10]) * 60 + Number(match[11] ?? 0));
    date.setUTCFullYear(year, month, day); date.setUTCHours(hour, minute, second, millisecond);
  } else {
    date.setFullYear(year, month, day); date.setHours(hour, minute, second, millisecond);
  }
  return Number.isFinite(date.getTime()) ? date : null;
}

// The JSON fields are normally strings; Dart also calls toString on optional fields.
export function dartString(value: unknown): string {
  if (value == null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartString).join(', ')}]`;
  const row = jsonObject(value);
  if (row) return `{${Object.entries(row).map(([key, item]) => `${key}: ${dartString(item)}`).join(', ')}}`;
  return String(value);
}
export const optionalText = (value: unknown) => value == null ? '' : dartString(value);
export function optionalInteger(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected number');
  return Math.trunc(value);
}

export async function qolipApiResponseError(response: Response, fallbackCode: string, fallbackMessage: string): Promise<MobileApiException> {
  let code = fallbackCode, message = fallbackMessage;
  try {
    const row = jsonObject(await response.json());
    if (row) {
      code = optionalText(row.error ?? row.code ?? fallbackCode);
      const serverMessage = trimDart(optionalText(row.message));
      if (serverMessage) message = serverMessage;
    }
  } catch { /* V2 keeps its fallback code and message for an invalid error body. */ }
  return new MobileApiException({ code, message, statusCode: response.status });
}

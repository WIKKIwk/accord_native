import { MobileApiException } from '../shared/mobileApiException';

export type JsonObject = Record<string, unknown>;
export const jsonObject = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
export const trimDart = (value: string) => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');

// The JSON fields are normally strings; Dart also calls toString on optional fields.
export function dartString(value: unknown): string {
  if (value == null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartString).join(', ')}]`;
  const row = jsonObject(value);
  if (row) return `{${Object.entries(row).map(([key, item]) => `${key}: ${dartString(item)}`).join(', ')}}`;
  return String(value);
}
export const optionalText = (value: unknown) => value == null ? '' : dartString(value);

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

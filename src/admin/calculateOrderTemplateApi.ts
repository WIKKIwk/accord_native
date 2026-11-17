import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { checkedAdminGuard } from './adminProductionRequest';
import { dartJsonString, dartTrim } from './dartJsonString';
import { calculateOrderTemplateFromJson, calculateOrderTemplateToJson, type CalculateOrderTemplate } from './calculateOrderTemplateModel';

export { calculateOrderTemplateFromJson, calculateOrderTemplateToJson, type CalculateOrderTemplate } from './calculateOrderTemplateModel';
type Guard = () => void;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback: string): string => value == null ? fallback : dartTrim(dartJsonString(value)) || fallback;

async function request(session: Session, path: string, init: RequestInit | undefined, errorCode: string, errorMessage: string,
  beforeSend?: Guard, readWitness?: () => boolean): Promise<Record<string, unknown>> {
  const check = checkedAdminGuard(beforeSend);
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped template read requires a guard');
  if (session.token === 'test-mode-token') throw new Error('Shared calculate test mode is not available');
  check?.();
  let response: Response;
  try { response = readWitness ? await authorizedFetch(session, path, init, check, 10_000, { readWitness })
    : await authorizedFetch(session, path, init, check); }
  catch (error) { check?.(); throw error; }
  check?.();
  let decoded: unknown;
  try { decoded = await response.json(); } catch { decoded = null; }
  check?.();
  // _calculateDecodeObject deliberately treats malformed/non-map JSON as {}.
  const payload = object(decoded) ? decoded : {};
  if (response.status !== 200) throw new MobileApiException({ code: text(payload.error, errorCode),
    message: text(payload.detail, errorMessage), statusCode: response.status });
  return payload;
}

/** @v2 calculateOrderTemplates */
export async function calculateOrderTemplates(session: Session, beforeSend?: Guard, readWitness?: () => boolean): Promise<CalculateOrderTemplate[]> {
  const payload = await request(session, '/v1/mobile/calculate/orders', undefined, 'calculate_orders', 'Calculate orders failed', beforeSend, readWitness);
  const rows = payload.templates ?? [];
  if (!Array.isArray(rows)) throw new TypeError('Invalid calculate templates list');
  const result = rows.filter(object).map(calculateOrderTemplateFromJson);
  checkedAdminGuard(beforeSend)?.();
  return result;
}

/** @v2 upsertCalculateOrderTemplate */
export async function upsertCalculateOrderTemplate(session: Session, template: CalculateOrderTemplate, beforeSend?: Guard): Promise<CalculateOrderTemplate> {
  const payload = await request(session, '/v1/mobile/calculate/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calculateOrderTemplateToJson(template), (_key, value: unknown) => {
      // Dart jsonEncode rejects these values instead of silently sending null.
      if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite calculate template number');
      return value;
    }) }, 'calculate_order_save', 'Calculate order save failed', beforeSend);
  const saved = calculateOrderTemplateFromJson(object(payload.template) ? payload.template : {});
  checkedAdminGuard(beforeSend)?.();
  return saved;
}

/** @v2 deleteCalculateOrderTemplate */
export async function deleteCalculateOrderTemplate(session: Session, id: string, beforeSend?: Guard): Promise<void> {
  await request(session, '/v1/mobile/calculate/orders/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }) }, 'calculate_order_delete', 'Calculate order delete failed', beforeSend);
}

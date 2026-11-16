import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { rawMaterialStockFromJson, type RawMaterialReprint } from '../shared/printApi';
import { printJobFromJson } from '../workerPrintJob';
import { adminWarehouseItemRollsChecked, type AdminWarehouseItemRollsGuard } from './adminWarehouseItemRollsApi';
import { dartJsonString, dartTrim } from './dartJsonString';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid response object'); return value as ObjectValue; };
async function command(session: Session, action: 'prepare' | 'confirm', body: ObjectValue, check: () => void): Promise<Response> {
  check(); const response = await authorizedFetch(session, `/v1/mobile/admin/raw-material-stock/reprint/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, check); check();
  if (response.status === 200) return response;
  let code = 'raw_material_stock_reprint_failed';
  try { const value: unknown = await response.json(); check(); const error = object(value).error; if (typeof error === 'string' && dartTrim(error)) code = dartTrim(error); }
  catch { check(); }
  const messages: Record<string, string> = { raw_material_stock_locked: 'Bu homashyo zakazga to‘liq yoki qisman band qilingan. QR kodini qayta chop etib bo‘lmaydi',
    raw_material_stock_not_found: 'Homashyo omborda topilmadi', forbidden: 'Bu homashyo sizga biriktirilgan omborda emas' };
  check(); throw new MobileApiException({ code, message: Object.hasOwn(messages, code) ? messages[code] : 'QR kodini qayta chop etib bo‘lmadi', statusCode: response.status });
}
/** Opt-in Warehouse command adapters preserve protected shared printApi defaults. */
export async function prepareAdminWarehouseRawQr(session: Session, barcode: string, orderId: string, guard: AdminWarehouseItemRollsGuard): Promise<RawMaterialReprint> {
  const check = adminWarehouseItemRollsChecked(guard);
  try {
    check(); const normalized = dartTrim(barcode); if (!normalized) throw new MobileApiException({ code: 'raw_material_stock_reprint_invalid', message: 'QR kodi topilmadi' });
    const response = await command(session, 'prepare', { barcode: normalized, ...(dartTrim(orderId) ? { order_id: dartTrim(orderId) } : {}) }, check);
    const value: unknown = await response.json(); check(); const row = object(value);
    const result = { reprint_id: row.reprint_id == null ? '' : dartJsonString(row.reprint_id), stock: rawMaterialStockFromJson(row.stock ?? {}), print_request: printJobFromJson(row.print ?? {}) }; check(); return result;
  } catch (error) { check(); throw error; }
}
export async function confirmAdminWarehouseRawQr(session: Session, barcode: string, reprintId: string, guard: AdminWarehouseItemRollsGuard): Promise<void> {
  const check = adminWarehouseItemRollsChecked(guard);
  try { check(); await command(session, 'confirm', { barcode: dartTrim(barcode), reprint_id: dartTrim(reprintId) }, check); check(); }
  catch (error) { check(); throw error; }
}

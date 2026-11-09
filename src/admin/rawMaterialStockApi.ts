import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { rawMaterialStockFromJson, type RawMaterialStock } from '../shared/printApi';
import { dartTrim } from './dartJsonString';

const path = '/v1/mobile/admin/raw-material-stock';
async function stockMutationError(response: Response, operation: 'update' | 'delete'): Promise<MobileApiException> {
  let code = `raw_material_stock_${operation}_failed`;
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const error = (value as Record<string, unknown>).error;
      if (typeof error === 'string' && dartTrim(error)) code = dartTrim(error);
    }
  } catch { /* V2 falls back for invalid JSON. */ }
  const update: Record<string, string> = {
    raw_material_stock_locked: 'Bu homashyo zakazga to‘liq yoki qisman band qilingan. Uni tahrirlab bo‘lmaydi',
    raw_material_stock_not_found: 'Homashyo omborda topilmadi',
    raw_material_stock_qty_invalid: 'Miqdor musbat son bo‘lishi kerak',
    raw_material_item_not_found: 'Tanlangan mahsulot topilmadi',
    raw_material_uom_mismatch: 'Tanlangan mahsulotning o‘lchov birligi mos emas',
    'item group is not assigned to material taminotchi': 'Bu mahsulot guruhi sizga biriktirilmagan',
  };
  const remove: Record<string, string> = {
    raw_material_stock_locked: 'Zakazga biriktirilgan, transferdagi yoki State’dagi homashyoni o‘chirib bo‘lmaydi',
    raw_material_stock_not_found: 'Homashyo omborda topilmadi',
    forbidden: 'Bu homashyo sizga biriktirilgan omborda emas',
  };
  const messages = operation === 'update' ? update : remove;
  return new MobileApiException({ code, statusCode: response.status, message: Object.hasOwn(messages, code) ? messages[code]
    : operation === 'update' ? 'Homashyo ma’lumotlarini o‘zgartirib bo‘lmadi' : 'Homashyoni o‘chirib bo‘lmadi' });
}
/** @v2 adminRawMaterialStock */
export async function adminRawMaterialStock(session: Session, options: { warehouse?: string; limit?: number } = {}): Promise<RawMaterialStock[]> {
  const query = new URLSearchParams(), warehouse = dartTrim(options.warehouse ?? ''), limit = options.limit ?? 500;
  if (warehouse) query.set('warehouse', warehouse);
  if (limit > 0) query.set('limit', String(limit));
  const suffix = query.toString(), response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new Error('Admin raw material stock failed');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid raw material stock list');
  return value.map(rawMaterialStockFromJson);
}
/** @v2 adminUpdateRawMaterialStock */
export async function adminUpdateRawMaterialStock(session: Session, barcode: string, itemCode: string, qty: number): Promise<RawMaterialStock> {
  const normalizedBarcode = dartTrim(barcode), normalizedItem = dartTrim(itemCode);
  if (!normalizedBarcode || !normalizedItem || !Number.isFinite(qty) || qty <= 0) {
    throw new MobileApiException({ code: 'raw_material_stock_update_invalid', message: 'Mahsulot va musbat miqdorni kiriting' });
  }
  const response = await authorizedFetch(session, path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: normalizedBarcode, item_code: normalizedItem, qty }) });
  if (response.status !== 200) throw await stockMutationError(response, 'update');
  return rawMaterialStockFromJson(await response.json());
}
/** @v2 adminDeleteRawMaterialStock */
export async function adminDeleteRawMaterialStock(session: Session, barcode: string): Promise<void> {
  const normalized = dartTrim(barcode);
  if (!normalized) throw new MobileApiException({ code: 'raw_material_stock_delete_invalid', message: 'QR kodi topilmadi' });
  const response = await authorizedFetch(session, path, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: normalized }) });
  if (response.status !== 200) throw await stockMutationError(response, 'delete');
}

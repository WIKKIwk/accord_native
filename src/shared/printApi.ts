import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from './mobileApiException';
import { printJobFromJson, type WorkerPrintJob } from '../workerPrintJob';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid response object');
  return value as Obj;
};
const text = (value: unknown) => value == null ? '' : String(value);
const number = (value: unknown, fallback: number | null = null): number | null => {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid quantity');
  return value;
};

export type RawMaterialStock = {
  id: string; warehouse: string; item_code: string; item_name: string; barcode: string;
  qty: number; width_mm: number | null; micron: number | null; length_m: number | null;
  uom: string; status: string; reserved_order_id: string; source_receipt_id: string;
};
export type RawMaterialReprint = { reprint_id: string; stock: RawMaterialStock; print_request: WorkerPrintJob };

/** @v2 AdminRawMaterialStockEntry.fromJson */
export function rawMaterialStockFromJson(value: unknown): RawMaterialStock {
  const stock = object(value);
  return { id: text(stock.id), warehouse: text(stock.warehouse), item_code: text(stock.item_code),
    item_name: text(stock.item_name), barcode: text(stock.barcode), qty: number(stock.qty, 0)!,
    width_mm: number(stock.width_mm), micron: number(stock.micron), length_m: number(stock.length_m),
    uom: text(stock.uom), status: text(stock.status), reserved_order_id: text(stock.reserved_order_id),
    source_receipt_id: text(stock.source_receipt_id) };
}

async function reprintException(response: Response): Promise<MobileApiException> {
  let code = 'raw_material_stock_reprint_failed';
  try {
    const body: unknown = await response.json();
    const error = object(body).error;
    if (typeof error === 'string' && error.trim()) code = error.trim();
  } catch { /* V2 falls back for an invalid error body. */ }
  const messages: Record<string, string> = {
    raw_material_stock_locked: 'Bu homashyo zakazga to‘liq yoki qisman band qilingan. QR kodini qayta chop etib bo‘lmaydi',
    raw_material_stock_not_found: 'Homashyo omborda topilmadi',
    forbidden: 'Bu homashyo sizga biriktirilgan omborda emas',
  };
  return new MobileApiException({ code, message: messages[code] ?? 'QR kodini qayta chop etib bo‘lmadi', statusCode: response.status });
}

/** @v2 adminPrepareRawMaterialStockReprint */
export async function adminPrepareRawMaterialStockReprint(session: Session, barcode: string, orderId = '',
  beforeSend?: () => void): Promise<RawMaterialReprint> {
  const normalized = barcode.trim();
  if (!normalized) throw new MobileApiException({ code: 'raw_material_stock_reprint_invalid', message: 'QR kodi topilmadi' });
  const path = '/v1/mobile/admin/raw-material-stock/reprint/prepare';
  const init = {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: normalized, ...(orderId.trim() ? { order_id: orderId.trim() } : {}) }),
  };
  const response = beforeSend ? await authorizedFetch(session, path, init, beforeSend) : await authorizedFetch(session, path, init);
  if (response.status !== 200) throw await reprintException(response);
  const data = object(await response.json());
  const stock = data.stock == null ? {} : object(data.stock);
  const print = data.print == null ? {} : object(data.print);
  return {
    reprint_id: text(data.reprint_id),
    stock: rawMaterialStockFromJson(stock),
    print_request: printJobFromJson(print),
  };
}

/** @v2 adminConfirmRawMaterialStockReprint */
export async function adminConfirmRawMaterialStockReprint(session: Session, barcode: string, reprintId: string,
  beforeSend?: () => void): Promise<void> {
  const path = '/v1/mobile/admin/raw-material-stock/reprint/confirm';
  const init = {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: barcode.trim(), reprint_id: reprintId.trim() }),
  };
  const response = beforeSend ? await authorizedFetch(session, path, init, beforeSend) : await authorizedFetch(session, path, init);
  if (response.status !== 200) throw await reprintException(response);
}

export type QolipCodeQr = { qolip_code: string; qr_payload: string; item_code: string; item_name: string; item_group: string; size: number };
export type QolipCodeQrPrint = { qolip_qr: QolipCodeQr; print_job: WorkerPrintJob };
export type QolipPrintOptions = { qolipCode: string; driverUrl: string; printer?: string; printMode?: string;
  customerName?: string; qolipColor?: string; printTransport?: 'wifi' | 'offline' | 'bluetooth' };

/** @v2 qolipPrintCodeQr */
export async function qolipPrintCodeQr(session: Session, options: QolipPrintOptions): Promise<QolipCodeQrPrint> {
  const printer = (options.printer ?? '').trim(), mode = (options.printMode ?? '').trim();
  const response = await authorizedFetch(session, '/v1/mobile/qolip/code-qr/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qolip_code: options.qolipCode.trim(), driver_url: options.driverUrl.trim().replace(/\/+$/, ''),
      ...(printer ? { printer } : {}), ...(mode ? { print_mode: mode } : {}),
      ...(['offline', 'bluetooth'].includes(options.printTransport ?? 'wifi') ? { print_transport: 'offline' } : {}) }),
  });
  if (response.status !== 200) throw new Error('Qolip code QR print failed');
  const data = object(await response.json()), raw = object(data.qolip_qr);
  const qr: QolipCodeQr = { qolip_code: text(raw.qolip_code), qr_payload: text(raw.qr_payload),
    item_code: text(raw.item_code), item_name: text(raw.item_name), item_group: text(raw.item_group),
    size: Math.trunc(number(raw.size, 0)!) };
  const print = data.print == null ? printJobFromJson({ epc: qr.qr_payload, item_code: qr.qolip_code,
    item_name: qr.item_name, warehouse: 'ACCORD', printer: 'godex', print_mode: 'label', gross_qty: 1,
    unit: 'dona', label_kind: 'qolip_code', progress_qty: 1, progress_unit: 'dona' }) : printJobFromJson(object(data.print));
  return { qolip_qr: qr, print_job: { ...print, epc: qr.qr_payload.trim(), item_code: qr.qolip_code.trim(),
    item_name: qr.item_name.trim(), order_code: '', include_bobina_in_net: false, label_kind: 'qolip_code',
    manufacturer_name: '', customer_name: (options.customerName ?? '').trim() || print.customer_name,
    qolip_color: (options.qolipColor ?? '').trim() || print.qolip_color, completed_at_unix: 0, paddon_label_lines: [] } };
}

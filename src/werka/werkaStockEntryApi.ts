import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid stock entry string');
  return value;
};
const number = (value: unknown, fallback = 0): number => {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid stock entry number');
  return value;
};

/** @v2 StockEntryBarcodeEntry */
export function stockEntryBarcodeEntryFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid stock entry');
  return { stockEntryName: string(row.stock_entry_name), stockEntryType: string(row.stock_entry_type),
    docStatus: Math.trunc(number(row.doc_status)), status: string(row.status), company: string(row.company),
    postingDate: string(row.posting_date), postingTime: string(row.posting_time), creation: string(row.creation),
    modified: string(row.modified), remarks: string(row.remarks), lineIndex: Math.trunc(number(row.line_index)),
    itemCode: string(row.item_code), itemName: string(row.item_name), qty: number(row.qty), uom: string(row.uom),
    stockUOM: string(row.stock_uom), barcode: string(row.barcode), sourceWarehouse: string(row.source_warehouse),
    targetWarehouse: string(row.target_warehouse) };
}

/** @v2 StockEntryBarcodeLookup */
export function stockEntryBarcodeLookupFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid stock entry lookup');
  const entries = Array.isArray(row.entries) ? row.entries.filter(item => object(item)).map(stockEntryBarcodeEntryFromJson) : [];
  return { barcode: string(row.barcode), count: Math.trunc(number(row.count, entries.length)), entries,
    hasMultipleEntries: entries.length > 1 };
}

/** @v2 werkaStockEntryLookup */
export async function werkaStockEntryLookup(session: Session, barcode: string, limit = 20) {
  const query = new URLSearchParams({ barcode: barcode.trim() });
  if (limit > 0) query.set('limit', String(limit));
  const response = await authorizedFetch(session, `/v1/mobile/stock-entry/lookup?${query}`);
  if (response.status !== 200) {
    let raw: unknown;
    try { raw = await response.json(); } catch { raw = null; }
    const row = object(raw), message = row?.error == null ? 'Stock entry lookup failed' : string(row.error);
    const code = response.status === 400 ? 'stock_entry_lookup_bad_request' : response.status === 404 ? 'stock_entry_not_found'
      : response.status === 503 ? 'direct_db_lookup_unavailable' : 'stock_entry_lookup_failed';
    throw new MobileApiException({ code, message: message.trim(), statusCode: response.status });
  }
  return stockEntryBarcodeLookupFromJson(await response.json());
}

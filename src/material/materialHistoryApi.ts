import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { dartTrim, isAsciiCanonicalApparatusId } from '../shared/dartApparatus';
import { WorkerControlException } from '../workerControlsApi';
import { materialHistoryResponseError } from './materialHistoryErrors';
import { materialHistoryOptionalText as text } from './materialHistoryValueText';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectValue : null;
const number = (value: unknown, integer = false): number => {
  if (value == null) return 0;
  // V2 toDouble retains nonfinite quantities; its timestamp toInt conversion cannot.
  if (typeof value !== 'number' || (integer && !Number.isFinite(value))) throw new TypeError('Invalid raw material event number');
  return integer ? Math.trunc(value) : value;
};

/** @v2 AdminRawMaterialEvent */
export type AdminRawMaterialEvent = {
  event_id: string; event_type: string; warehouse: string; barcode: string; item_code: string; item_name: string;
  qty_delta: number; uom: string; stock_status_before: string; stock_status_after: string; order_id: string;
  apparatus: string; actor_role: string; actor_ref: string; actor_display_name: string; owner_role: string;
  owner_ref: string; owner_display_name: string; source_type: string; source_id: string; occurred_at_unix: number;
  recorded_at_unix: number; payload_json: ObjectValue;
};

export function rawMaterialEvent(raw: unknown): AdminRawMaterialEvent {
  const row = object(raw);
  if (!row) throw new TypeError('Invalid raw material event');
  const apparatus = dartTrim(text(row.apparatus));
  if (apparatus && !isAsciiCanonicalApparatusId(apparatus)) {
    throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  }
  return {
    event_id: text(row.event_id), event_type: text(row.event_type), warehouse: text(row.warehouse), barcode: text(row.barcode),
    item_code: text(row.item_code), item_name: text(row.item_name), qty_delta: number(row.qty_delta), uom: text(row.uom),
    stock_status_before: text(row.stock_status_before), stock_status_after: text(row.stock_status_after),
    order_id: text(row.order_id), apparatus, actor_role: text(row.actor_role), actor_ref: text(row.actor_ref),
    actor_display_name: text(row.actor_display_name), owner_role: text(row.owner_role), owner_ref: text(row.owner_ref),
    owner_display_name: text(row.owner_display_name), source_type: text(row.source_type), source_id: text(row.source_id),
    occurred_at_unix: number(row.occurred_at_unix, true), recorded_at_unix: number(row.recorded_at_unix, true),
    payload_json: { ...object(row.payload_json) },
  };
}

/** @v2 adminRawMaterialHistory */
export async function adminRawMaterialHistory(session: Session, options: { warehouse?: string; eventType?: string; limit?: number } = {},
  beforeSend?: () => void) {
  const query = new URLSearchParams(), warehouse = dartTrim(options.warehouse ?? ''), eventType = dartTrim(options.eventType ?? '');
  const limit = options.limit ?? 50;
  if (warehouse) query.set('warehouse', warehouse);
  if (eventType) query.set('event_type', eventType);
  if (limit > 0) query.set('limit', String(limit));
  await Promise.resolve();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const path = `/v1/mobile/admin/raw-material-history?${query}`, init = { signal: controller.signal };
    const response = beforeSend ? await authorizedFetch(session, path, init, beforeSend) : await authorizedFetch(session, path, init);
    if (response.status === 404) throw new MobileApiException({ code: 'raw_material_history_not_found', message: 'Serverda tarix endpointi yo‘q', statusCode: 404 });
    if (response.status !== 200) {
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw materialHistoryResponseError(response, payload);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new TypeError('Invalid raw material history');
    return data.map(rawMaterialEvent);
  } finally { clearTimeout(timer); }
}

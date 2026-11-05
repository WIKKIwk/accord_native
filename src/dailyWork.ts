import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { progressBatchStatusDetail } from './workerProgressModel';
import { adminProgressQrHistory } from './workerProgressApi';
import { WorkerControlException } from './workerControlsApi';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export type DailyWorkBatch = {
  id: string;
  orderId: string;
  title: string;
  code: string;
  qr: string;
  apparatus: string;
  location: string;
  nextApparatus: string;
  worker: string;
  started: number;
  completed: number;
  quantity: number | null;
  unit: string;
  meters: number | null;
  weight: number | null;
  bobina: number | null;
  diameter: number | null;
  description: string;
  flowStatus: string;
  workStatus: string;
  wipStatus: string;
};

export type DailyWorkGroup = { key: string; orderId: string; title: string; batches: DailyWorkBatch[] };
export type DailyWorkStatus = 'Ishlatilgan' | 'Jarayonda' | 'Kutmoqda';

function cleanTitle(value: string): string {
  let result = value.trim().replace(/,?\s*apparat:.*$/i, '').trim();
  result = result.replace(/\s*(yarim\s+tayyor\s+mahsulot|tayyor\s+mahsulot|полуфабрикат|готовая\s+продукция)\s*$/i, '').replace(/[,;:\-]\s*$/, '').trim();
  return /^wip\s*\d*$/i.test(result) ? '' : result;
}

export function parseDailyWorkHistory(value: unknown): DailyWorkBatch[] {
  const data = object(value);
  if (!Array.isArray(data.batches)) throw new Error('Server javobi noto‘g‘ri.');
  return data.batches.flatMap((item, index): DailyWorkBatch[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = object(item);
    const payload = object(row.payload_json);
    const status = progressBatchStatusDetail(row);
    const title = [payload.order_title, payload.orderTitle, payload.order_name, payload.orderName,
      row.label_item_name, row.label_item_code, row.description].map(value => cleanTitle(text(value))).find(Boolean) ?? '';
    return [{
      id: text(row.batch_id) || `missing-${index}`,
      orderId: text(row.order_id), title, code: text(row.label_item_code), qr: text(row.qr_payload),
      apparatus: text(row.apparatus), location: text(row.current_location) || text(row.current_apparatus),
      nextApparatus: text(row.next_apparatus), worker: text(row.worker_display_name) || text(row.executor_name),
      started: number(row.started_at_unix) ?? 0, completed: number(row.completed_at_unix) ?? 0,
      quantity: number(row.produced_qty), unit: text(row.uom), meters: number(row.finished_goods_meter),
      weight: number(row.finished_goods_kg), bobina: number(row.bobina_kg) ?? number(row.babina_kg),
      diameter: number(row.diameter), description: text(row.description),
      flowStatus: text(status.flow_status).toLowerCase(), workStatus: text(status.work_status).toLowerCase(),
      wipStatus: text(row.wip_status).toLowerCase(),
    }];
  });
}

/** V2's history endpoint is scoped by the server to the signed-in worker. */
export async function loadDailyWork(session: Session, signal: AbortSignal): Promise<DailyWorkBatch[]> {
  try {
    return parseDailyWorkHistory({ batches: await adminProgressQrHistory(session, { limit: 200, signal }) });
  } catch (error) {
    if (error instanceof WorkerControlException && error.statusCode === 401) throw new Error('Sessiya tugagan. Qayta kiring.');
    if (error instanceof WorkerControlException && error.statusCode === 403) throw new Error('Kunlik ishlarni ko‘rishga ruxsat yo‘q.');
    throw error;
  }
}

export function dailyWorkStatus(batch: DailyWorkBatch): DailyWorkStatus {
  if (['consumed_by_next_stage', 'accepted_to_stock'].includes(batch.flowStatus) || ['processed', 'used', 'consumed'].includes(batch.wipStatus)) return 'Ishlatilgan';
  if (batch.flowStatus === 'in_progress' || ['in_use', 'in_progress'].includes(batch.wipStatus) || batch.workStatus === 'paused') return 'Jarayonda';
  return 'Kutmoqda';
}

/** Include every local day touched by the work interval, as in V2. */
export function batchesForDay(batches: readonly DailyWorkBatch[], day: Date): DailyWorkBatch[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return batches.filter(batch => {
    const started = batch.started > 0 ? batch.started * 1000 : 0;
    const completed = batch.completed > 0 ? batch.completed * 1000 : 0;
    if (!started && !completed) return false;
    const first = Math.min(started || completed, completed || started);
    const last = Math.max(started, completed);
    return first < end && last >= start;
  }).sort((a, b) => (b.completed || b.started) - (a.completed || a.started));
}

export function groupDailyWork(batches: readonly DailyWorkBatch[]): DailyWorkGroup[] {
  const groups = new Map<string, DailyWorkGroup>();
  for (const batch of batches) {
    const key = batch.orderId ? `order:${batch.orderId}` : `batch:${batch.id}`;
    const group = groups.get(key) ?? { key, orderId: batch.orderId, title: '', batches: [] };
    group.batches.push(batch);
    if (!group.title && batch.title) group.title = batch.title;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function dailyWorkTotals(batches: readonly DailyWorkBatch[]) {
  return {
    orders: new Set(batches.map(batch => batch.orderId).filter(Boolean)).size,
    wips: batches.length,
    used: batches.filter(batch => dailyWorkStatus(batch) === 'Ishlatilgan').length,
  };
}

export function dailyWorkQuantity(batch: DailyWorkBatch): string {
  const value = batch.meters != null && batch.meters > 0 ? batch.meters : batch.quantity;
  const unit = batch.meters != null && batch.meters > 0 ? 'm' : batch.unit;
  return value == null ? '—' : [String(Number(value.toFixed(3))), unit].filter(Boolean).join(' ');
}

export function dailyWorkDate(value: number): string {
  return value > 0 ? new Date(value * 1000).toLocaleString() : '';
}

/** Return human-readable names, never a technical apparatus ID. */
export function dailyWorkLocation(value: string, names: Record<string, string>): string {
  const location = value.trim();
  if (!location) return '';
  return names[location] || (location.includes(':') ? '' : location);
}

export async function loadDailyWorkApparatus(session: Session, signal: AbortSignal): Promise<Record<string, string>> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/apparatus?limit=300', { signal });
  if (!response.ok) throw new Error('Aparatlar ro‘yxatini yuklab bo‘lmadi.');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Aparatlar ro‘yxati noto‘g‘ri.');
  const names: Record<string, string> = {};
  for (const item of rows) {
    const outer = object(item);
    const projection = object(outer.runtime_projection);
    const display = object(projection.display);
    const name = text(display.display_name) || text(outer.name);
    if (!name) continue;
    for (const id of [projection.apparatus_id, projection.physical_asset_id, projection.work_unit_id, outer.id]) {
      if (text(id)) names[text(id)] = name;
    }
  }
  return names;
}

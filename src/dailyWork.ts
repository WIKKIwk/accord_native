import type { Session } from './auth';
import { adminApparatus, type AdminApparatus } from './apparatusApi';
import { progressBatchStatusDetail } from './workerProgressModel';
import { adminProgressQrHistory } from './workerProgressApi';
import { WorkerControlException } from './workerControlsApi';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export type DailyWorkBatch = {
  source: RecordValue;
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
      source: { ...row, payload_json: { ...payload } },
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
  return value == null ? '—' : dailyWorkMetric(value, unit);
}

/** @v2 formatQuantityWithUnit */
export function dailyWorkMetric(value: number, unit: string): string {
  const quantity = Object.is(value, -0) ? '-0' : Number.isInteger(value) ? value.toFixed(0)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return [quantity, unit.trim()].filter(Boolean).join(' ');
}

/** @v2 formatUnixSecondsLocalDateTime */
export function dailyWorkDate(value: number): string {
  if (value <= 0) return '';
  const date = new Date(value * 1000), two = (part: number) => String(part).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Return human-readable names, never a technical apparatus ID. */
export function dailyWorkLocation(value: string, names: Record<string, string>, assigned: readonly string[] = []): string {
  const location = value.trim();
  if (!location) return '—';
  if (names[location]) return names[location];
  const suffix = (id: string) => id.trim().toLowerCase().split(/[:/_-]+/).filter(Boolean).at(-1) ?? '';
  const matching = Object.entries(names).find(([id]) => suffix(id) === suffix(location))?.[1];
  if (matching) return matching;
  if (!location.includes(':')) return location;
  return assigned.map(id => names[id]).find(Boolean) || Object.values(names).find(name => name.trim()) || '—';
}

export async function loadDailyWorkApparatus(session: Session, signal: AbortSignal): Promise<Record<string, string>> {
  return dailyWorkApparatusNames(await loadDailyWorkCatalog(session, signal));
}

export function loadDailyWorkCatalog(session: Session, signal: AbortSignal) {
  return adminApparatus(session, { limit: 300, signal });
}

export function dailyWorkApparatusNames(rows: readonly AdminApparatus[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const item of rows) {
    for (const id of [item.id, item.physical_asset_id, item.work_unit_id]) {
      if (id) names[id] = item.name;
    }
  }
  return names;
}

/** @v2 _AparatchiDailyWorkScreenState._canonicalApparatus */
export function dailyWorkApparatus(rows: readonly AdminApparatus[], id: string): AdminApparatus | undefined {
  const normalized = id.trim();
  if (!normalized) return undefined;
  const aliases = (item: AdminApparatus) => [item.id, item.physical_asset_id, item.work_unit_id].filter(Boolean);
  const exact = rows.find(item => aliases(item).some(alias => alias.trim() === normalized));
  if (exact) return exact;
  const suffix = (value: string) => value.trim().toLowerCase().split(/[:/_-]+/).filter(Boolean).at(-1) ?? '';
  const token = suffix(normalized);
  return token ? rows.find(item => item.name.trim() && aliases(item).some(alias => suffix(alias) === token)) : undefined;
}

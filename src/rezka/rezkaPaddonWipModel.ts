import type { AdminApparatus } from '../apparatusApi';
import { progressBatchStatusDetail } from '../workerProgressModel';
import { rezkaPaddonOrderSummary } from './rezkaPaddonDisplay';

type Obj = Record<string, unknown>;
type Text = (key: string) => string;
export type RezkaPaddonWipRow = { key: string; label: string; value: string; isEpc?: boolean };
const text = (value: unknown) => value == null ? '' : String(value);
const number = (value: unknown): number | null => typeof value === 'number' ? value : null;
const object = (value: unknown): Obj => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};

// V2 formats quantities to three decimals and groups thousands with spaces.
function quantity(value: number, unit: string): string {
  const fixed = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const parts = fixed.split('.'); parts[0] = parts[0].replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
  return [parts.join('.'), unit.trim()].filter(Boolean).join(' ');
}
function weightUnits(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0 || value >= 1e12) return null;
  const units = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(units)) throw new RangeError();
  return units;
}
function localDate(seconds: number): string {
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) throw new RangeError();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function epc(value: unknown): string {
  const code = text(value).trim();
  if (!code) return '—';
  return /^[0-9a-f]{24}$/i.test(code) ? code.toUpperCase().match(/.{4}/g)!.join(' ') : code;
}
function producer(batch: Obj, viewer: Obj | null, t: Text): string {
  const worker = text(batch.worker_ref).trim();
  const candidates = [batch.worker_display_name, batch.executor_name,
    ...(worker && text(viewer?.ref).trim() === worker ? [viewer?.display_name] : [])];
  for (const candidate of candidates) {
    const name = text(candidate).trim();
    if (!name || name === worker || /^(?:worker|user|system-user)[_:=-]/i.test(name) ||
        /^(?:worker|user)\S*\d{6,}\S*$/i.test(name) || /^[0-9a-f]{24,}$/i.test(name) ||
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(name)) continue;
    return name;
  }
  return t('worker.qr.history.worker_missing');
}
function status(batch: Obj, t: Text): string {
  const detail = progressBatchStatusDetail(batch), flow = detail.flow_status.trim();
  const flowKeys: Record<string, string> = { free_wip: 'worker.wip.status.free', accepted_to_stock: 'worker.wip.status.accepted',
    waiting_next_stage: 'worker.wip.status.waiting_next', consumed_by_next_stage: 'worker.wip.status.consumed_next',
    in_progress: 'worker.wip.status.in_progress' };
  if (Object.hasOwn(flowKeys, flow)) return t(flowKeys[flow]);
  const wip = text(batch.wip_status).trim();
  if (wip === 'waiting') return t('worker.wip.status.waiting');
  if (wip === 'in_use') return t('worker.wip.status.in_progress');
  if (wip === 'processed') return t('worker.wip.status.used');
  const work = detail.work_status.trim() || text(batch.status).trim();
  return t(work === 'paused' ? 'worker.wip.status.paused' : work === 'resumed' || work === 'in_progress' ? 'worker.wip.status.in_progress'
    : work === 'completed' || work === 'complete' ? 'worker.wip.status.finished' : 'worker.daily.wip');
}

/** Passive V2 Paddon WIP card content. No network, printer or mutation is present. */
export function rezkaPaddonWipContent(batch: Obj, catalog: readonly AdminApparatus[], viewer: Obj | null, t: Text) {
  const payload = object(batch.payload_json), missing = t('worker.paddon.bobina_unknown');
  const rawGross = payload.gross_qty == null ? number(batch.finished_goods_kg) : number(payload.gross_qty);
  const gross = weightUnits(rawGross), bobina = weightUnits(number(batch.bobina_kg));
  const net = gross == null || gross <= 0 ? null : payload.include_bobina_in_net === true ? gross
    : bobina != null && bobina <= gross ? gross - bobina : null;
  const weight = (units: number | null) => units == null ? missing : quantity(units / 1_000_000, 'kg');
  const names = new Map<string, string>();
  for (const row of catalog) if (row.id.trim() && row.name.trim()) names.set(row.id.trim(), row.name.trim());
  const apparatus = (candidates: unknown[]) => {
    for (const candidate of candidates) {
      const id = text(candidate).trim(), label = names.get(id) ?? id;
      if (label.trim() && !label.includes('apparatus:')) return label.trim();
    }
    return '';
  };
  const source = apparatus([batch.apparatus]), current = apparatus([batch.current_apparatus, batch.current_location]);
  const next = apparatus([batch.next_apparatus]), produced = number(batch.produced_qty) ?? 0, uom = text(batch.uom);
  const length = number(batch.finished_goods_meter), hasQuantity = Number.isFinite(produced) && produced > 0 && !!uom.trim();
  const hasLength = length != null && Number.isFinite(length) && length > 0;
  const rows: RezkaPaddonWipRow[] = [];
  const add = (key: string, value: string, isEpc = false) => rows.push({ key, label: t(key), value, ...(isEpc ? { isEpc: true } : {}) });
  add('worker.wip.info.quantity', hasQuantity ? quantity(produced, uom) : hasLength ? quantity(length, 'm') : missing);
  if (hasLength && hasQuantity && (uom.trim().toLowerCase() !== 'm' || length !== produced)) add('worker.daily.field.length', quantity(length, 'm'));
  add('worker.wip.info.gross_weight', weight(gross != null && gross > 0 ? gross : null));
  add('worker.wip.info.net_weight', weight(net)); add('worker.qr.passport.bobbin_weight', weight(bobina));
  add('worker.wip.info.produced_by', producer(batch, viewer, t)); add('worker.daily.status', status(batch, t));
  add('worker.wip.info.source', source || t('worker.qr.history.machine_missing'));
  if (current && current !== source) add('worker.wip.info.location', current);
  if (next) add('worker.wip.info.next_machine', next);
  const completed = number(batch.completed_at_unix) ?? 0, started = number(batch.started_at_unix) ?? 0;
  if (completed > 0) add('worker.wip.info.finished', localDate(completed));
  else if (started > 0) add('worker.wip.info.started', localDate(started));
  const diameter = number(batch.diameter);
  if (diameter != null && Number.isFinite(diameter) && diameter > 0) add('worker.qr.passport.diameter', quantity(diameter, ''));
  const description = text(batch.description).trim(); if (description) add('worker.wip.info.note', description);
  add('worker.wip.info.epc', epc(batch.qr_payload), true);
  return { order: `${t('worker.paddon.order')}: ${rezkaPaddonOrderSummary({ order_id: text(batch.order_id),
    label_item_name: text(batch.label_item_name), payload_json: payload })}`,
    peremotka: batch.wip_status === 'peremotka' ? t('worker.rezka.print.peremotka') : '', rows };
}

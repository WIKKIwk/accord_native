import type { Session } from './auth';
import { dailyWorkDate } from './dailyWork';
import { progressBatchStatusDetail } from './workerProgressModel';
import type { WipApparatusNames, WipBatch, WipOrder } from './workerWip';

type Text = (key: string) => string;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const units = (value: unknown): number | null => finite(value) && value >= 0 && value < 1e12 ? Math.round(value * 1e6) : null;

/** @v2 _quantity */
export function workerWipQuantity(value: number, unit: string): string {
  const quantity = Object.is(value, -0) ? '-0' : Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const [whole, decimal] = quantity.split('.');
  return [whole.replace(/(\d)(?=(\d{3})+$)/g, '$1 ') + (decimal ? `.${decimal}` : ''), unit.trim()].filter(Boolean).join(' ');
}

/** @v2 _readableEpc */
export function workerWipReadableEpc(value: unknown): string {
  const code = text(value);
  return !code ? '—' : /^[0-9a-f]{24}$/i.test(code) ? code.toUpperCase().match(/.{4}/g)!.join(' ') : code;
}

/** @v2 WorkerWipDetails.statusLabelFor */
export function workerWipStatusLabel(batch: WipBatch, p: Text): string {
  const status = progressBatchStatusDetail(batch);
  const flow: Record<string, string> = { free_wip: 'free', accepted_to_stock: 'accepted', waiting_next_stage: 'waiting_next', consumed_by_next_stage: 'consumed_next', in_progress: 'in_progress' };
  const key = flow[text(status.flow_status)] ?? ({ waiting: 'waiting', in_use: 'in_progress', processed: 'used' } as Record<string, string>)[text(batch.wip_status)]
    ?? ({ paused: 'paused', resumed: 'in_progress', in_progress: 'in_progress', completed: 'finished', complete: 'finished' } as Record<string, string>)[text(status.work_status) || text(batch.status)];
  return p(key ? `worker.wip.status.${key}` : 'worker.daily.wip');
}

/** @v2 WorkerWipDetails._producerName */
export function workerWipProducer(batch: WipBatch, viewer: Session['profile'], p: Text): string {
  const ref = text(batch.worker_ref);
  for (const raw of [batch.worker_display_name, batch.executor_name, ref && text(viewer.ref) === ref ? viewer.display_name : '']) {
    const name = text(raw);
    if (!name || name === ref || /^(?:worker|user|system-user)[_:=-]/i.test(name) || /^(?:worker|user)\S*\d{6,}\S*$/i.test(name)
      || /^[0-9a-f]{24,}$/i.test(name) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(name)) continue;
    return name;
  }
  return p('worker.qr.history.worker_missing');
}

/** @v2 WorkerWipDetails.build */
export function workerWipDetailRows(batch: WipBatch, names: WipApparatusNames, viewer: Session['profile'], p: Text): [string, string][] {
  const missing = p('worker.paddon.bobina_unknown');
  const rawGross = batch.payload_json?.gross_qty;
  const gross = units(rawGross == null ? batch.finished_goods_kg : rawGross);
  const bobina = units(batch.bobina_kg);
  const net = gross === null || gross <= 0 ? null : batch.payload_json?.include_bobina_in_net === true ? gross : bobina !== null && bobina <= gross ? gross - bobina : null;
  const weight = (value: number | null) => value === null ? missing : workerWipQuantity(value / 1e6, 'kg');
  const apparatus = (candidates: unknown[]) => {
    for (const candidate of candidates) {
      const raw = text(candidate);
      if (!raw) continue;
      const label = names[raw] || raw;
      if (label.trim() && !label.includes('apparatus:')) return label.trim();
    }
    return '';
  };
  const source = apparatus([batch.apparatus]), current = apparatus([batch.current_apparatus, batch.current_location]);
  const hasQuantity = finite(batch.produced_qty) && batch.produced_qty > 0 && !!text(batch.uom);
  const length = batch.finished_goods_meter, hasLength = finite(length) && length > 0;
  const rows: [string, string][] = [[p('worker.wip.info.quantity'), hasQuantity ? workerWipQuantity(batch.produced_qty, batch.uom) : hasLength ? workerWipQuantity(length, 'm') : missing]];
  if (hasLength && hasQuantity && (text(batch.uom).toLowerCase() !== 'm' || length !== batch.produced_qty)) rows.push([p('worker.daily.field.length'), workerWipQuantity(length, 'm')]);
  rows.push([p('worker.wip.info.gross_weight'), weight(gross !== null && gross > 0 ? gross : null)], [p('worker.wip.info.net_weight'), weight(net)],
    [p('worker.qr.passport.bobbin_weight'), weight(bobina)], [p('worker.wip.info.produced_by'), workerWipProducer(batch, viewer, p)],
    [p('worker.daily.status'), workerWipStatusLabel(batch, p)], [p('worker.wip.info.source'), source || p('worker.qr.history.machine_missing')]);
  if (current && current !== source) rows.push([p('worker.wip.info.location'), current]);
  const next = apparatus([batch.next_apparatus]);
  if (next) rows.push([p('worker.wip.info.next_machine'), next]);
  if (finite(batch.completed_at_unix) && batch.completed_at_unix > 0) rows.push([p('worker.wip.info.finished'), dailyWorkDate(batch.completed_at_unix)]);
  else if (finite(batch.started_at_unix) && batch.started_at_unix > 0) rows.push([p('worker.wip.info.started'), dailyWorkDate(batch.started_at_unix)]);
  if (finite(batch.diameter) && batch.diameter > 0) rows.push([p('worker.qr.passport.diameter'), workerWipQuantity(batch.diameter, '')]);
  if (text(batch.description)) rows.push([p('worker.wip.info.note'), text(batch.description)]);
  rows.push([p('worker.wip.info.epc'), workerWipReadableEpc(batch.qr_payload)]);
  return rows;
}

/** @v2 WorkerWipDetailsSheet.build */
export function workerWipDetailsItemName(order: WipOrder, batch: WipBatch, p: Text): string {
  const payloadText = (value: unknown) => value == null ? '' : String(value).trim();
  const number = text(order.code) || payloadText(batch.payload_json?.order_number) || /^zakaz-(\d+)$/.exec(text(batch.order_id))?.[1] || (/^\d+$/.test(text(batch.order_id)) ? text(batch.order_id) : '');
  const label = text(batch.label_item_name).split(/,?\s*apparat:/i)[0].replace(/\s+(?:yarim tayyor(?: mahsulot)?|tayyor mahsulot)\s*$/i, '').trim();
  const name = text(order.title) || payloadText(batch.payload_json?.order_title) || label || p('worker.daily.wip');
  return [number, name].filter(Boolean).join(' • ');
}

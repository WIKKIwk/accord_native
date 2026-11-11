import { dailyWorkDate, dailyWorkMetric } from './dailyWork';
import type { WipApparatusNames, WipBatch } from './workerWip';

type Text = (key: string, values?: Record<string, unknown>) => string;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const units = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e12 ? Math.round(value * 1e6) : null;
export type WorkerWipHistoryTotal = { units: number; known: number; missing: number };

/** @v2 _WorkerWipHistoryTotals.fromBatches */
export function workerWipHistoryTotals(batches: readonly WipBatch[]) {
  const sum = (measurement: (batch: WipBatch) => number | null): WorkerWipHistoryTotal => {
    let total = 0, known = 0;
    for (const batch of batches) { const value = measurement(batch); if (value !== null) { total += value; known++; } }
    return { units: total, known, missing: batches.length - known };
  };
  const gross = (batch: WipBatch) => { const value = units(batch.payload_json?.gross_qty ?? batch.finished_goods_kg); return value !== null && value > 0 ? value : null; };
  return {
    gross: sum(gross),
    net: sum(batch => { const value = gross(batch), bobina = units(batch.bobina_kg);
      return batch.payload_json?.include_bobina_in_net === true ? value : value !== null && bobina !== null && bobina <= value ? value - bobina : null; }),
    meters: sum(batch => batch.finished_goods_meter != null ? units(batch.finished_goods_meter)
      : ['m', 'meter', 'metr'].includes(text(batch.uom).toLowerCase()) ? units(batch.produced_qty) : null),
  };
}

/** @v2 _WorkerWipTotalLine.build */
export function workerWipHistoryTotalText(total: WorkerWipHistoryTotal, unit: string, p: Text): string {
  if (!total.known) return p('worker.paddon.bobina_unknown');
  return `${(total.units / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${unit}`;
}

/** @v2 _WorkerWipHistoryCard.build */
export function workerWipHistoryRows(batch: WipBatch, names: WipApparatusNames, p: Text): [string, string][] {
  const first = (values: unknown[]) => values.map(text).find(Boolean) ?? '';
  const apparatus = (value: string) => names[value] || value;
  const rows: [string, string][] = [[p('worker.wip.info.quantity'), dailyWorkMetric(typeof batch.produced_qty === 'number' ? batch.produced_qty : 0, text(batch.uom))]];
  if (batch.started_at_unix > 0) rows.push([p('worker.wip.info.started'), dailyWorkDate(batch.started_at_unix)]);
  if (batch.completed_at_unix > 0) rows.push([p('worker.wip.info.finished'), dailyWorkDate(batch.completed_at_unix)]);
  rows.push([p('worker.wip.info.source'), apparatus(text(batch.apparatus) || '—')]);
  const action = text(batch.action), known = ['pause', 'detach_roll', 'roll_complete', 'complete', 'resume'].includes(action.toLowerCase());
  if (action) rows.push([p('worker.wip.info.action'), known ? p(`worker.wip.action.${action.toLowerCase()}`) : action]);
  rows.push([p('worker.wip.info.location'), apparatus(first([batch.current_location, batch.current_apparatus, batch.apparatus]))],
    [p('worker.wip.info.next_machine'), apparatus(text(batch.next_apparatus)) || '—'],
    [p('worker.wip.info.worker'), first([batch.worker_display_name, batch.executor_name, batch.worker_ref])]);
  return rows;
}

import { dailyWorkDate, dailyWorkLocation, dailyWorkMetric, dailyWorkQuantity, dailyWorkStatus, type DailyWorkBatch } from './dailyWork';

export type DailyWorkText = (key: string, values?: Record<string, unknown>) => string;

/** @v2 _dailyWorkDateLabel */
export function dailyWorkDayLabel(value: Date): string {
  return `${String(value.getDate()).padStart(2, '0')}. ${String(value.getMonth() + 1).padStart(2, '0')}. ${value.getFullYear()}`;
}

export function dailyWorkDateDraft(value: Date, today: Date): Date {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return day > last ? last : day < new Date(2020, 0, 1) ? new Date(2020, 0, 1) : day;
}

/** @v2 _dailyWorkStatusLabel */
export function dailyWorkStatusLabel(batch: DailyWorkBatch, p: DailyWorkText): string {
  const status = dailyWorkStatus(batch);
  return p(status === 'Ishlatilgan' ? 'worker.daily.used' : status === 'Jarayonda' ? 'worker.queue.status.in_progress' : 'worker.wip.waiting');
}

/** @v2 _dailyWorkDisplayCode */
export function dailyWorkDisplayCode(batch: DailyWorkBatch): string {
  if (batch.qr.trim()) return batch.qr.trim();
  const id = batch.id.trim();
  return !id ? '—' : id.length <= 24 ? id : `…${id.slice(-12)}`;
}

/** @v2 _dailyWorkProductTitle */
export function dailyWorkProductTitle(batch: DailyWorkBatch, index = 0): string {
  for (const candidate of [batch.source.label_item_name, batch.source.label_item_code]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    let title = candidate.trim();
    const withComma = title.toLowerCase().indexOf(', apparat:');
    const bare = title.toLowerCase().indexOf('apparat:');
    if (withComma > 0) title = title.slice(0, withComma).trim();
    else if (bare > 0 && title.slice(0, bare).trim()) title = title.slice(0, bare).trim().replace(/[,;:-]\s*$/, '');
    if (title) return title;
  }
  return index > 0 ? `WIP ${index}` : 'WIP';
}

/** @v2 _DailyWorkWipCardState.build */
export function dailyWorkExpandedRows(batch: DailyWorkBatch, names: Record<string, string>, p: DailyWorkText, assigned: readonly string[] = []): [string, string][] {
  const rows: [string, string][] = [
    [p('worker.wip.info.qr'), dailyWorkDisplayCode(batch)],
    [p('worker.daily.field.length'), dailyWorkQuantity(batch)],
  ];
  if (batch.weight !== null) rows.push([p('worker.daily.field.weight'), dailyWorkMetric(batch.weight, 'kg')]);
  if (batch.bobina !== null) rows.push([p('worker.daily.field.roll'), dailyWorkMetric(batch.bobina, 'kg')]);
  if (batch.diameter !== null) rows.push([p('worker.daily.field.diameter'), dailyWorkMetric(batch.diameter, 'mm')]);
  if (batch.started > 0) rows.push([p('worker.wip.info.started'), dailyWorkDate(batch.started)]);
  if (batch.completed > 0) rows.push([p('worker.wip.info.finished'), dailyWorkDate(batch.completed)]);
  rows.push([p('worker.wip.info.source'), dailyWorkLocation(batch.apparatus, names, assigned)],
    [p('worker.wip.info.location'), dailyWorkLocation(batch.location || batch.apparatus, names, assigned)]);
  if (batch.nextApparatus.trim()) rows.push([p('worker.wip.info.next_machine'), dailyWorkLocation(batch.nextApparatus, names, assigned)]);
  if (batch.description.trim()) rows.push([p('worker.wip.info.note'), batch.description.trim()]);
  return rows;
}

/** @v2 _AparatchiDailyWorkScreenState._dailyWorkSheetDetails */
export function dailyWorkQrRows(batch: DailyWorkBatch, names: Record<string, string>, p: DailyWorkText, assigned: readonly string[] = []): [string, string][] {
  const rows: [string, string][] = [];
  if (batch.orderId.trim()) rows.push([p('worker.daily.order'), batch.orderId.trim()]);
  rows.push([p('worker.wip.info.qr'), dailyWorkDisplayCode(batch)], [p('worker.daily.field.length'), dailyWorkQuantity(batch)]);
  if (batch.weight !== null) rows.push([p('worker.daily.field.weight'), dailyWorkMetric(batch.weight, 'kg')]);
  if (batch.bobina !== null) rows.push([p('worker.daily.field.roll'), dailyWorkMetric(batch.bobina, 'kg')]);
  if (batch.diameter !== null) rows.push([p('worker.daily.field.diameter'), dailyWorkMetric(batch.diameter, 'mm')]);
  rows.push([p('worker.daily.status'), dailyWorkStatusLabel(batch, p)]);
  if (batch.started > 0) rows.push([p('worker.wip.info.started'), dailyWorkDate(batch.started)]);
  if (batch.completed > 0) rows.push([p('worker.wip.info.finished'), dailyWorkDate(batch.completed)]);
  if (batch.apparatus.trim()) rows.push([p('worker.wip.info.source'), dailyWorkLocation(batch.apparatus, names, assigned)]);
  if (batch.location.trim()) rows.push([p('worker.wip.info.location'), dailyWorkLocation(batch.location, names, assigned)]);
  return rows;
}

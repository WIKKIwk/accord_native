import { adminText } from '../shared/localization';
import type { closedProductionOrderFromJson, productionOrderLogFromJson } from '../workerClosedOrders';
import type { progressBatchFromJson } from '../workerProgressBatch';
import { adminWorkMapClosedActor, adminWorkMapClosedTime } from './adminWorkMapClosedModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

type Log = ReturnType<typeof productionOrderLogFromJson>;
type Order = ReturnType<typeof closedProductionOrderFromJson>;
type Batch = ReturnType<typeof progressBatchFromJson>;
type Apparatus = { id: string; name: string };
export type ClosedLogField = { label: string; value: string; selectable?: true };
export type ClosedLogBatch = { title: string; status: string; fields: ClosedLogField[]; metrics: string[]; note?: ClosedLogField;
  qr?: { payload: string; label: string; copyLabel: string; copiedText: string } };
export type ClosedLogSection = { id: 'event' | 'freeze' | 'transfer' | 'progress'; title: string; fields: ClosedLogField[];
  metrics?: string[]; empty?: string; batches?: ClosedLogBatch[] };
const clean = (value: string) => dartTrim(value);
const lower = (value: string) => dartPartialLower(clean(value));
const actor = (displayName: string, role: string, ref: string) => adminWorkMapClosedActor({ closed_by_display_name: displayName,
  closed_by_role: role, closed_by_ref: ref } as Order);

/** V2 catalog names are trimmed, last duplicate wins, and an unknown ID remains visible. */
export function adminClosedApparatusLabel(id: string, catalog: readonly Apparatus[]): string {
  const names = new Map<string, string>();
  for (const item of catalog) { const key = clean(item.id), name = clean(item.name); if (key && name) names.set(key, name); }
  const key = clean(id); return key ? names.get(key) ?? key : '';
}
export function adminClosedFreezeLabel(status: string): string {
  const value = lower(status), labels: Record<string, string> = { pending: 'Muzlatish so‘raldi', frozen: 'Muzlatildi',
    cancelled: 'Muzlatish bekor qilindi', unfrozen: 'Muzlatishdan chiqarildi' };
  return Object.hasOwn(labels, value) ? labels[value] : value ? `Muzlatish: ${value}` : 'Muzlatish hodisasi';
}
export function adminClosedLogTitle(log: Log): string {
  if (log.action === 'close_early') return 'Order muammo bilan erta yopildi';
  if (log.freeze) return adminClosedFreezeLabel(log.freeze.status);
  if (log.transfer) return 'Apparat almashtirildi';
  if (log.completed_with_issue) return clean(log.issue_note) || 'Muammo bilan yopildi';
  const action = clean(log.action), labels: Record<string, string> = { start: 'Boshladi', pause: 'Pauza qildi', freeze: 'Muzlatdi',
    detach_roll: 'Rulonni yechdi', merge: 'WIP rulonni uladi', resume: 'Davom ettirdi', roll_complete: 'Rulonni tugatdi', complete: 'Tugatdi' };
  return Object.hasOwn(labels, action) ? labels[action] : action || 'Harakat';
}
export function adminClosedLogApparatus(log: Log, catalog: readonly Apparatus[]): string {
  if (log.action === 'close_early') return '';
  const label = (id: string) => adminClosedApparatusLabel(id, catalog);
  if (log.freeze && clean(log.freeze.target_apparatus)) return label(log.freeze.target_apparatus);
  if (log.transfer) {
    const from = clean(log.transfer.from_apparatus), to = clean(log.transfer.to_apparatus);
    return from && to ? `${label(from)} → ${label(to)}` : label(to || from);
  }
  return label(log.apparatus);
}
export function adminClosedLogState(log: Log): string {
  if (log.action === 'close_early') return 'Erta yopilgan';
  if (log.freeze) return adminClosedFreezeLabel(log.freeze.status);
  if (log.transfer) { const from = clean(log.transfer.from_apparatus), to = clean(log.transfer.to_apparatus); if (from && to) return `${from} → ${to}`; }
  const from = clean(log.from_state), to = clean(log.to_state); return from && to ? `${from} → ${to}` : to || from;
}
export function adminClosedLogRow(log: Log, catalog: readonly Apparatus[]) {
  const apparatus = adminClosedLogApparatus(log, catalog), reason = clean(log.transfer?.reason ?? '');
  const note = log.action === 'close_early' ? clean(log.issue_note) : '';
  const icons: Record<string, string> = { start: 'start', pause: 'pause', detach_roll: 'detach_roll', merge: 'merge', resume: 'resume',
    roll_complete: 'roll_complete', complete: 'complete', close_early: 'close_early' }, action = clean(log.action);
  const icon = log.freeze ? 'freeze' : log.transfer ? 'transfer' : Object.hasOwn(icons, action) ? icons[action] : 'history';
  return { icon, title: [adminClosedLogTitle(log), apparatus].filter(Boolean).join(' • '),
    subtitle: [actor(log.actor_display_name, log.actor_role, log.actor_ref), adminClosedLogState(log), adminWorkMapClosedTime(log.created_at_unix),
      reason ? `Sabab: ${reason}` : '', note ? `Sabab: ${note}` : ''].filter(Boolean).join(' • ') };
}
export function adminClosedLogNumber(value: number): string {
  return Object.is(value, -0) ? '-0' : value.toFixed(3).replace(/\.?0+$/, '');
}
function batchDistance(batch: Batch, time: number): number {
  const values = [batch.started_at_unix, batch.completed_at_unix].filter(value => value > 0);
  return !values.length || time <= 0 ? 1 << 30 : Math.min(...values.map(value => Math.abs(value - time)));
}
export function adminClosedBatchesForLog(order: Order, log: Log): Batch[] {
  if (log.action === 'close_early') return [];
  const freezeSession = clean(log.freeze?.target_session_id ?? '');
  if (freezeSession) { const matched = order.progress_batches.filter(batch => clean(batch.session_id) === freezeSession); if (matched.length) return matched; }
  const transferBatch = clean(log.transfer?.progress_batch_id ?? '');
  if (transferBatch) return order.progress_batches.filter(batch => clean(batch.batch_id) === transferBatch);
  const action = lower(log.action), apparatus = clean(log.apparatus);
  return order.progress_batches.filter(batch => lower(batch.action) === action && (!apparatus || clean(batch.apparatus) === apparatus || clean(batch.current_apparatus) === apparatus))
    .sort((a, b) => batchDistance(a, log.created_at_unix) - batchDistance(b, log.created_at_unix));
}
function adminClosedBatch(batch: Batch, catalog: readonly Apparatus[], locale: string): ClosedLogBatch {
  const text = (key: string, values: Record<string, unknown> = {}) => adminText(key, locale, values), fields: ClosedLogField[] = [], metrics: string[] = [];
  const field = (key: string, value: string, selectable = false) => fields.push({ label: text(key), value, ...(selectable ? { selectable: true as const } : {}) });
  const metric = (key: string, value: number) => metrics.push(text(key, { value: adminClosedLogNumber(value) }));
  if (batch.produced_qty > 0 || clean(batch.uom)) metrics.push(text('production.produced', { value: clean(`${adminClosedLogNumber(batch.produced_qty)} ${batch.uom}`) }));
  for (const [property, key] of [['return_ink_kg', 'production.returned_ink'], ['lamination_print_leftover_rolls', 'production.print_roll_waste'],
    ['lamination_film_leftover_rolls', 'production.film_waste'], ['rezka_bosma_waste', 'production.print_waste'],
    ['rezka_lamination_waste', 'production.lamination_waste'], ['rezka_edge_waste', 'production.edge_waste'], ['total_waste', 'production.total_waste'],
    ['finished_goods_kg', 'production.finished_goods'], ['finished_goods_meter', 'production.finished_meters']] as const) if (batch[property] != null) metric(key, batch[property]);
  const status = [clean(batch.status), clean(batch.wip_status) ? text('production.wip_prefix', { value: clean(batch.wip_status) }) : '',
    clean(batch.status_detail.flow_status) ? text('production.flow_prefix', { value: clean(batch.status_detail.flow_status) }) : '',
    clean(batch.status_detail.stock_status) ? text('production.stock_prefix', { value: clean(batch.status_detail.stock_status) }) : ''].filter(Boolean).join(' • ');
  if (clean(batch.batch_id)) field('production.batch_id', clean(batch.batch_id), true);
  if (clean(batch.session_id)) field('production.target_session', clean(batch.session_id), true);
  field('production.executor', actor(batch.worker_display_name, batch.worker_role, batch.worker_ref));
  if (clean(batch.executor_name)) field('production.executor', clean(batch.executor_name));
  const item = [clean(batch.label_item_code), clean(batch.label_item_name)].filter(Boolean).join(' • '); if (item) field('production.item', item);
  if (clean(batch.current_location)) field('production.location', clean(batch.current_location));
  if (clean(batch.next_apparatus)) field('production.next_equipment', clean(batch.next_apparatus));
  if (clean(batch.parent_batch_id)) field('production.parent_batch', clean(batch.parent_batch_id), true);
  const note = clean(batch.description) ? { label: text('production.note'), value: clean(batch.description) } : undefined;
  const qr = clean(batch.qr_payload) ? { payload: clean(batch.qr_payload), label: text('production.qr_payload'), copyLabel: text('action.copy'), copiedText: text('production.copied') } : undefined;
  return { title: [clean(batch.action), clean(batch.apparatus) ? adminClosedApparatusLabel(batch.apparatus, catalog) : ''].filter(Boolean).join(' • '),
    status, fields, metrics, ...(note ? { note } : {}), ...(qr ? { qr } : {}) };
}

/** Pure source content for a future Closed log sheet; no reader or action is connected here. */
export function adminClosedLogDetail(order: Order, log: Log, catalog: readonly Apparatus[], locale: string) {
  const text = (key: string, values: Record<string, unknown> = {}) => adminText(key, locale, values), sections: ClosedLogSection[] = [];
  const make = (id: ClosedLogSection['id'], title: string): ClosedLogSection => ({ id, title: text(title), fields: [] });
  const add = (section: ClosedLogSection, key: string, value: string, selectable = false) => section.fields.push({ label: text(key), value, ...(selectable ? { selectable: true as const } : {}) });
  const apparatus = adminClosedLogApparatus(log, catalog), event = make('event', 'production.event_details');
  add(event, 'production.event', adminClosedLogTitle(log)); if (apparatus) add(event, 'label.apparatus', apparatus);
  add(event, 'production.time', adminWorkMapClosedTime(log.created_at_unix)); add(event, 'production.executor', actor(log.actor_display_name, log.actor_role, log.actor_ref));
  if (clean(log.from_state) || clean(log.to_state)) add(event, 'label.status', adminClosedLogState(log));
  if (clean(log.event_id)) add(event, 'production.event_id', clean(log.event_id), true);
  if (clean(log.issue_note)) add(event, 'production.issue_note', clean(log.issue_note)); sections.push(event);
  if (log.freeze) {
    const freeze = log.freeze, section = make('freeze', 'production.freeze_details'); add(section, 'label.status', adminClosedFreezeLabel(freeze.status));
    if (clean(freeze.target_apparatus)) add(section, 'label.apparatus', adminClosedApparatusLabel(freeze.target_apparatus, catalog));
    if (clean(freeze.target_worker_display_name) || clean(freeze.target_worker_ref) || clean(freeze.target_worker_role))
      add(section, 'production.target_worker', actor(freeze.target_worker_display_name, freeze.target_worker_role, freeze.target_worker_ref));
    if (clean(freeze.target_session_id)) add(section, 'production.target_session', clean(freeze.target_session_id), true);
    if (clean(freeze.request_id)) add(section, 'production.freeze_request_id', clean(freeze.request_id), true);
    if (freeze.requested_at_unix > 0) add(section, 'production.requested_at', adminWorkMapClosedTime(freeze.requested_at_unix));
    if (freeze.transitioned_at_unix > 0) add(section, 'production.state_transition', adminWorkMapClosedTime(freeze.transitioned_at_unix)); sections.push(section);
  }
  if (log.transfer) {
    const transfer = log.transfer, section = make('transfer', 'production.transfer_details');
    add(section, 'production.from', adminClosedApparatusLabel(transfer.from_apparatus, catalog)); add(section, 'production.to', adminClosedApparatusLabel(transfer.to_apparatus, catalog));
    if (clean(transfer.reason)) add(section, 'label.reason', clean(transfer.reason));
    if (clean(transfer.transfer_id)) add(section, 'production.transfer_id', clean(transfer.transfer_id), true);
    if (clean(transfer.session_id)) add(section, 'production.target_session', clean(transfer.session_id), true);
    if (clean(transfer.progress_batch_id)) add(section, 'production.progress_batch', clean(transfer.progress_batch_id), true);
    if (transfer.material_barcodes.length) add(section, 'production.material_qr', transfer.material_barcodes.join(', '), true); sections.push(section);
  }
  const waste = Object.entries(log.zero_output_waste), batches = waste.length ? [] : adminClosedBatchesForLog(order, log), progress = make('progress', batches.length ? 'production.progress_info_plural' : 'production.progress_info');
  const wasteLabels: Record<string, string> = { rezka_bosma_waste: 'production.print_waste', rezka_lamination_waste: 'production.lamination_waste',
    rezka_edge_waste: 'production.edge_waste' };
  if (waste.length) progress.metrics = waste.map(([key, value]) => text(Object.hasOwn(wasteLabels, key) ? wasteLabels[key] : 'production.total_waste', { value: adminClosedLogNumber(value) }));
  else if (!batches.length) progress.empty = text('production.progress_empty');
  else progress.batches = batches.map(batch => adminClosedBatch(batch, catalog, locale));
  sections.push(progress);
  const icon: 'transfer' | 'freeze' | 'history' = log.transfer ? 'transfer' : log.freeze ? 'freeze' : 'history';
  return { title: adminClosedLogTitle(log), apparatus, icon, sections };
}

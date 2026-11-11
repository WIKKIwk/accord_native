import type { WorkerQueue } from './workerApi';

type Obj = Record<string, any>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** @v2 _busyOrderLabels */
export function workerOrderBusyTitle(queue: Pick<WorkerQueue, 'snapshot' | 'orders'> | null | undefined, apparatus: string, orderId: string): string {
  if (!queue) return '';
  const snapshot = queue.snapshot as Obj;
  const states = snapshot.queue_states?.[apparatus] ?? {};
  const controls = snapshot.queue_action_controls?.[apparatus] ?? {};
  const other = (id: string) => !!id.trim() && id.trim() !== orderId.trim();
  const busyId = Object.keys(states).find(id => other(id) && states[id] === 'in_progress') ??
    Object.keys(controls).find(id => other(id) && ['in_progress', 'freeze_requested'].includes(controls[id]?.interaction?.mode));
  if (!busyId) return '';
  const row = queue.orders[apparatus]?.find(order => order.id.trim() === busyId.trim());
  return text(row?.title) || text(row?.code);
}

/** @v2 _apparatusBusyDetailText */
export function workerOrderBusyText(reason: unknown, apparatus: string, order: string,
  p: (key: string, values?: Record<string, string>) => string): string {
  if (text(reason).toLowerCase() !== 'apparatus_busy') return '';
  const station = apparatus.trim(), title = order.trim();
  return station && title
    ? p('worker.waiting.apparatus_busy_detail', { apparatus: station, order: title })
    : p('worker.waiting.apparatus_busy');
}

/** @v2 AppLocalizations.productionErrorMessage */
export function workerOrderBlockingText(reason: unknown, apparatus: string, order: string,
  p: (key: string, values?: Record<string, string>) => string): string {
  const busy = workerOrderBusyText(reason, apparatus, order, p);
  if (busy) return busy;
  const keys: Record<string, string> = {
    print_preflight_active: 'worker.waiting.print_preflight_active', print_preflight_other_order_active: 'worker.waiting.print_preflight_other_order_active',
    previous_stage_not_configured: 'worker.error.previous_stage_not_configured', waiting_sequence: 'worker.waiting.sequence',
    waiting_previous_stage: 'worker.waiting.previous_short', waiting_opening_wip: 'worker.waiting.opening_wip',
    wip_route_source_unresolved: 'worker.error.wip_route_source', wip_route_destination_unresolved: 'worker.error.wip_route_destination',
    wip_route_ambiguous: 'worker.error.wip_route_ambiguous', wip_route_changed: 'worker.error.wip_route_changed',
    raw_material_assignment_required: 'worker.error.incomplete_material_groups', raw_materials_missing: 'worker.error.no_materials',
    raw_material_groups_incomplete: 'worker.error.incomplete_material_groups', raw_materials_not_at_apparatus: 'worker.error.material_not_at_machine',
    raw_material_scan_incomplete: 'worker.error.scan_all_materials', raw_material_group_scan_incomplete: 'worker.error.scan_required_materials',
    raw_material_rule_missing: 'worker.error.rule_failed', raw_material_rule_load_failed: 'worker.error.rule_failed',
    raw_material_needs_cutting: 'worker.delivery.needs_cutting', raw_material_width_mismatch: 'worker.error.material_width_mismatch',
    previous_stage_qr_required: 'worker.error.scan_previous', qolip_scan_incomplete: 'worker.error.scan_molds',
    qolip_confirmation_invalid: 'qolip.start.auto.unknown_state', qolip_automatic_confirmation_invalid: 'qolip.start.auto.unknown_state',
    qolip_automatic_confirmation_disabled: 'qolip.start.auto.settings_changed', qolip_policy_changed: 'qolip.start.auto.settings_changed',
    qolip_set_changed: 'qolip.start.auto.set_changed', qolip_automatic_confirmation_unavailable: 'qolip.start.auto.unavailable',
    order_frozen: 'worker.freeze.active', order_freeze_requested: 'worker.freeze.requested',
    merge_input_required: 'worker.error.merge_input_required', merge_input_same: 'worker.error.merge_input_same',
    merge_input_already_used: 'worker.error.merge_input_already_used', merge_input_not_accepted: 'worker.error.merge_input_not_accepted',
    merge_input_frame_count_mismatch: 'worker.error.merge_input_frame_count_mismatch', rezka_frame_count_mismatch: 'worker.error.rezka_frame_count_mismatch',
  };
  return p(keys[text(reason).toLowerCase()] ?? 'worker.queue.action_unavailable');
}

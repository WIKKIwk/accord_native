import type { Session } from './auth';
import { temporaryPauseControl, WorkerControlException, type AdminTemporaryPauseControl } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';
import { workerNextWorkStages, workerWipConsumerIds } from './workerOutputProgress';

type Obj = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export type WorkerFabTarget = { orderId: string; scannedOrderId: string; switching: boolean; qr: string };
export type WorkerFabWip = { batch: Obj; opening?: Obj };
export type WorkerFabContext = { snapshot: Obj; bootstrap: Obj };
export type WorkerFabReads = {
  current(): boolean; snapshot(): Obj | null; identify(qr: string): Promise<WorkerFabWip | null>;
  context(order: string, qr: string): Promise<WorkerFabContext>;
  validate(wip: WorkerFabWip, qr: string, order: string): Promise<Obj>;
};
export class WorkerFabGuidance extends Error {}
export const workerFabChanged = () => new WorkerControlException('worker_qr_sync', '');

/** @v2 _AdminProductionMapOrdersScreenState._workerQrErrorText */
export function workerFabErrorText(error: unknown, p: Text): string {
  if (error instanceof WorkerFabGuidance) return error.message;
  if (error instanceof TypeError || error instanceof SyntaxError) return p('worker.qr.invalid_response');
  const value = error as { code?: string; statusCode?: number; name?: string; message?: string; orderTitle?: string; diagnostics?: Obj };
  if (['AbortError', 'TimeoutError'].includes(value?.name ?? '')) return p('worker.error.network_timeout');
  const keys: Record<string, string> = {
    order_freeze_requested: 'worker.qr.freeze_requested', progress_batch_not_found: 'worker.qr.not_found', progress_qr_not_found: 'worker.qr.not_found',
    progress_batch_not_accepted: 'worker.qr.not_accepted', progress_qr_invalid_response: 'worker.qr.invalid_response',
    progress_qr_validation_missing: 'worker.qr.invalid_response', progress_input_invalid: 'worker.qr.invalid_response',
    worker_qr_no_assignment: 'worker.qr.no_assignment', worker_qr_catalog_missing: 'worker.qr.catalog_missing',
    worker_qr_sync: 'worker.error.sync', production_map_snapshot_contract_invalid: 'worker.error.sync',
    order_not_found: 'worker.qr.order_unavailable', map_not_found: 'worker.qr.order_unavailable', unauthorized: 'worker.qr.session_expired', forbidden: 'worker.qr.forbidden',
    wip_route_source_unresolved: 'worker.error.wip_route_source', wip_route_destination_unresolved: 'worker.error.wip_route_destination',
    wip_route_ambiguous: 'worker.error.wip_route_ambiguous', wip_route_changed: 'worker.error.wip_route_changed',
  };
  if (value?.code === 'order_frozen') {
    const order = text(value.orderTitle ?? value.diagnostics?.order_title);
    return p(order ? 'worker.freeze.named' : 'worker.freeze.active', { order });
  }
  const key = keys[text(value?.code).toLowerCase()];
  if (key) return p(key);
  if (value?.statusCode === 401 || value?.statusCode === 403) return p(value.statusCode === 401 ? 'worker.qr.session_expired' : 'worker.qr.forbidden');
  if ((value?.statusCode ?? 0) >= 500) return p('worker.qr.server');
  if (['order_frozen', 'progress_batch_in_use', 'progress_batch_already_used'].includes(value?.code ?? '') && value?.message) return value.message;
  return p('worker.qr.lookup_failed');
}

export function workerFabControl(snapshot: Obj, apparatus: string, order: string): Obj {
  const rawOrderControl = snapshot.order_controls?.[order];
  return { ok: true, control_state: { apparatus, order_id: order, epoch: snapshot.epoch, rev: snapshot.revision ?? snapshot.rev,
    scope: snapshot.scope, queue_state: snapshot.queue_states?.[apparatus]?.[order],
    order_control: typeof rawOrderControl === 'string' ? rawOrderControl : rawOrderControl?.state ?? 'active',
    stage_states: snapshot.stage_states?.[order] ?? {}, control: snapshot.queue_action_controls?.[apparatus]?.[order] } };
}

/** @v2 _eligibleWorkerTemporaryPause */
export function workerFabTemporaryPause(session: Session, apparatus: string, order: string, data: Obj, synchronized: boolean): AdminTemporaryPauseControl | null {
  const state = data.control_state, control = state?.control;
  if (!synchronized || session.profile.role !== 'aparatchi' || !session.capabilities.includes('apparatus.queue.manage') ||
      !session.assigned_apparatus.includes(apparatus) || order.startsWith('training-') || state?.order_control !== 'active' ||
      control?.stage_control_state === 'frozen' || control?.stage_control_state === 'freeze_requested' || control?.state !== 'in_progress' ||
      !validOrderControl(data, apparatus, order, null)) return null;
  return temporaryPauseControl(control.temporary_pause);
}

/** @v2 _workerQrExistingOrderText */
export function workerFabExistingText(data: Obj, apparatus: string, order: string, joining: boolean, p: Text, busy = ''): string {
  const control = data.control_state?.control ?? {}, interaction = control.interaction ?? {}, actions: string[] = control.allowed_actions ?? [];
  const values = { apparatus, order }, mode = interaction.mode, reason = text(interaction.blocking_reason_code);
  const reasonKeys: Record<string, string> = {
    waiting_sequence: 'worker.waiting.sequence', waiting_previous_stage: 'worker.waiting.previous_short', waiting_opening_wip: 'worker.waiting.opening_wip',
    order_frozen: 'worker.freeze.active', order_freeze_requested: 'worker.freeze.requested',
    print_preflight_active: 'worker.waiting.print_preflight_active', print_preflight_other_order_active: 'worker.waiting.print_preflight_other_order_active',
    previous_stage_not_configured: 'worker.error.previous_stage_not_configured', raw_material_assignment_required: 'worker.error.incomplete_material_groups',
    raw_materials_missing: 'worker.error.no_materials', raw_material_groups_incomplete: 'worker.error.incomplete_material_groups',
    raw_materials_not_at_apparatus: 'worker.error.material_not_at_machine', raw_material_scan_incomplete: 'worker.error.scan_all_materials',
    raw_material_group_scan_incomplete: 'worker.error.scan_required_materials', previous_stage_qr_required: 'worker.error.scan_previous', qolip_scan_incomplete: 'worker.error.scan_molds',
    raw_material_rule_missing: 'worker.error.rule_failed', raw_material_rule_load_failed: 'worker.error.rule_failed',
  };
  const blocker = reason === 'apparatus_busy'
    ? p(busy ? 'worker.waiting.apparatus_busy_detail' : 'worker.waiting.apparatus_busy', { apparatus, order: busy })
    : p(reasonKeys[reason] ?? 'worker.qr.start_unavailable', values);
  const resume = (key: string) => p(key, { ...values, action: p('worker.action.resume') }) +
    (joining ? ` ${p('worker.qr.join_after_resume', { action: p('worker.action.merge') })}` : '');
  switch (mode) {
    case 'in_progress':
      if (actions.includes('merge')) return p('worker.qr.active_merge', { ...values, action: p('worker.action.merge') });
      if (control.rezka_output_report?.frames?.length && (actions.includes('roll_complete') || actions.includes('complete'))) return p('worker.qr.finish_roll_first',
        { ...values, action: p(actions.includes('roll_complete') ? 'worker.action.roll_complete' : 'worker.action.complete') });
      return p('worker.qr.active', values);
    case 'paused':
      if (text(control.closing_output_batch_id) && actions.includes('complete')) return p('worker.qr.closing_roll', { ...values, action: p('worker.action.complete') });
      if (actions.includes('resume')) return resume('worker.qr.paused_resume');
      return `${p('worker.qr.paused_waiting', values)} ${reason ? blocker : p('worker.qr.open_order_actions')}`;
    case 'requeued_ready': return resume('worker.qr.requeued_resume');
    case 'requeued_waiting': return `${p('worker.qr.requeued_waiting', values)} ${blocker}`;
    case 'completed': return p(control.stage_work?.astatka_available === true && control.stage_work?.astatka_required === true ? 'worker.qr.completed_report' : 'worker.qr.completed', values);
    case 'frozen': return p('worker.qr.apparatus_frozen', values);
    case 'freeze_requested': return p('worker.qr.freeze_requested');
    default: return blocker;
  }
}

/** @v2 _workerWipConsumerIds */
export function workerFabConsumers(wip: WorkerFabWip, map: Obj): string[] {
  const batch = wip.batch, intake = wip.opening?.intake;
  if (!intake) return batch.has_input_route_metadata ? batch.input_route?.consumer_apparatus_ids ?? []
    : workerWipConsumerIds(map, text(batch.next_apparatus), text(batch.payload_json?.next_stage_node_id));
  if (!text(intake.source_apparatus)) return workerWipConsumerIds(map, text(intake.resume_apparatus), text(intake.resume_stage_node_id));
  return workerNextWorkStages(map, text(intake.resume_stage_node_id)).map(stage => stage.apparatus).filter(Boolean);
}

/** @v2 _AdminProductionMapOrdersScreenState._workerCurrentOrderForApparatus */
export function workerFabVisibleCurrent(live: Obj | null, apparatus: string): string | undefined {
  if (!live) return undefined;
  const frozen = (id: string) => {
    const raw = live.order_controls?.[id];
    return (typeof raw === 'string' ? raw : raw?.state) === 'frozen' || live.order_statuses?.[id]?.order_status === 'frozen';
  };
  if (live.projection === 'worker_list_v1') {
    const active = Object.entries(live.queue_states?.[apparatus] ?? {}).find(([id, state]) => ['in_progress', 'print_preflight'].includes(String(state)) && !frozen(id));
    if (active) return live.worker_list_rows?.[active[0]] ? active[0] : undefined;
    const report = (live.worker_pending_report_ids?.[apparatus] ?? Object.keys(live.worker_report_prompts?.[apparatus] ?? {})).find((id: string) => !frozen(id));
    return report && live.worker_list_rows?.[report] ? report : undefined;
  }
  const orders: string[] = (live.maps ?? []).map((row: Obj) => text(row.map?.id));
  const mode = (id: string) => !frozen(id) && validOrderControl(workerFabControl(live, apparatus, id), apparatus, id, null)
    ? live.queue_action_controls?.[apparatus]?.[id]?.interaction?.mode : '';
  const active = orders.find(id => ['in_progress', 'freeze_requested'].includes(mode(id)));
  if (active) return active;
  return [...(live.completed_orders ?? [])].filter(row => row.apparatus === apparatus && orders.includes(row.order_id))
    .sort((left, right) => right.completed_at_unix - left.completed_at_unix)
    .find(row => ['paused', 'completed'].includes(mode(row.order_id)) && live.queue_action_controls?.[apparatus]?.[row.order_id]?.stage_work?.astatka_required === true)?.order_id;
}

/** @v2 _AdminProductionMapOrdersScreenState._workerQrLoadedRollText */
export function workerFabLoadedText(wip: WorkerFabWip, live: Obj | null, session: Session, p: Text, label: (id: string) => string): string {
  const id = text(wip.batch.order_id), station = text(wip.batch.used_by_apparatus) || text(wip.batch.current_apparatus);
  const map = live?.projection === 'worker_list_v1' ? null : live?.maps?.find((row: Obj) => row.map?.id === id)?.map;
  if (!station || !map || label(station) === station) return p('worker.error.wip_in_use');
  const order = text(map.title) || text(map.order_number) || id;
  const message = p('worker.qr.roll_in_use', { apparatus: label(station), order }), data = workerFabControl(live!, station, id);
  if (!session.assigned_apparatus.includes(station) || !validOrderControl(data, station, id, null)) return message;
  const control = data.control_state.control;
  if (control.interaction.mode === 'in_progress') return `${message} ${p('worker.qr.loaded_active')}`;
  if (control.interaction.mode === 'paused' && control.allowed_actions.includes('resume')) return `${message} ${p('worker.qr.resume_loaded_roll', { action: p('worker.action.resume') })}`;
  const busy = workerFabVisibleCurrent(live, station);
  return `${message} ${workerFabExistingText(data, label(station), order, false, p,
    busy && busy !== id ? text(live?.maps?.find((row: Obj) => row.map?.id === busy)?.map.title) : '')}`;
}

/** @v2 _AdminProductionMapOrdersScreenState._handleWorkerFabQr */
export async function prepareWorkerFabQr(session: Session, apparatus: { id: string; name: string; operation: string },
  qr: string, reads: WorkerFabReads, p: Text, label: (id: string) => string): Promise<WorkerFabTarget> {
  const check = () => { if (!reads.current()) throw workerFabChanged(); };
  check();
  if (!session.assigned_apparatus.includes(apparatus.id)) throw new WorkerFabGuidance(p('worker.qr.no_assignment'));
  const wip = await reads.identify(qr); check();
  if (!wip) throw new WorkerFabGuidance(p('worker.qr.not_found'));
  const batch = wip.batch, orderId = text(batch.order_id);
  if (!orderId) throw workerFabChanged();
  const status = text(batch.wip_status).toLowerCase();
  if (status !== 'waiting') throw new WorkerFabGuidance(status === 'in_use' ? workerFabLoadedText(wip, reads.snapshot(), session, p, label)
    : p(status === 'void' ? 'worker.qr.roll_void' : 'worker.error.wip_used'));
  if (text(batch.input_route_error)) throw new WorkerControlException(batch.input_route_error, '');
  const target = await reads.context(orderId, wip.opening ? '' : qr); check();
  const map = target.snapshot.maps?.find((row: Obj) => row.map?.id === orderId)?.map;
  if (!map) throw workerFabChanged();
  const targetState = target.bootstrap.control_state, targetControl = targetState?.control;
  if (!validOrderControl(target.bootstrap, apparatus.id, orderId, reads.snapshot())) throw workerFabChanged();
  if (targetState.order_control !== 'active' || ['frozen', 'freeze_requested'].includes(targetControl.stage_control_state)) {
    throw new WorkerFabGuidance(p(targetState.order_control === 'frozen' || targetControl.stage_control_state === 'frozen' ? (text(map.title) ? 'worker.freeze.named' : 'worker.freeze.active') : 'worker.qr.freeze_requested', { order: map.title }));
  }
  const consumers = workerFabConsumers(wip, map);
  if (!consumers.length) throw new WorkerControlException('wip_route_destination_unresolved', '');
  if (!consumers.includes(apparatus.id)) {
    const name = (id: string) => label(id) !== id ? label(id) : text(map.nodes?.find((node: Obj) => node.apparatus_id === id)?.title) || id;
    const destination = [...new Set(consumers.map(id => {
      const node = map.nodes?.find((node: Obj) => node.apparatus_id === id);
      return text(node?.alternative_group_id) && text(node?.alternative_group_label) ? text(node.alternative_group_label) : name(id);
    }))].join(', '), source = text(wip.opening?.intake.source_apparatus ?? batch.apparatus);
    throw new WorkerFabGuidance(`${p(source ? 'worker.qr.route_source_destination' : 'worker.qr.route_destination', { source: name(source), destination })} ${p('worker.qr.wrong_stage', { current: apparatus.name })}`);
  }
  const proof = target.bootstrap.validated_progress?.batch ?? await reads.validate(wip, qr, orderId); check();
  if (proof.batch_id !== batch.batch_id || text(proof.order_id) !== orderId || text(proof.wip_status).toLowerCase() !== 'waiting') throw workerFabChanged();
  const states = target.snapshot.queue_states?.[apparatus.id] ?? {};
  let currentId = Object.keys(states).find(id => ['in_progress', 'print_preflight'].includes(states[id]));
  const live = reads.snapshot();
  if (!currentId) {
    const visible = workerFabVisibleCurrent(live, apparatus.id);
    if (visible && (live?.worker_pending_report_ids?.[apparatus.id]?.includes(visible) || live?.worker_report_prompts?.[apparatus.id]?.[visible] ||
        live?.queue_action_controls?.[apparatus.id]?.[visible]?.stage_work?.astatka_required === true)) currentId = visible;
  }
  const current = currentId && currentId !== orderId ? await reads.context(currentId, '') : null; check();
  const currentControl = current?.bootstrap.control_state?.control;
  const canStop = !!current && (currentControl?.allowed_actions.includes('complete') ||
    workerFabTemporaryPause(session, apparatus.id, currentId!, current.bootstrap, true) !== null);
  const canPrepare = canStop && targetControl.interaction.mode === 'fresh_start_blocked' && targetControl.interaction.blocking_reason_code === 'apparatus_busy';
  const resumeWithInput = targetControl.allowed_actions.includes('resume') && targetControl.interaction.resume_input_required === true;
  if (!targetControl.allowed_actions.includes('start') && !resumeWithInput && !canPrepare) throw new WorkerFabGuidance(workerFabExistingText(target.bootstrap, apparatus.name,
    text(map.order_number) || text(map.title), ['laminate', 'glue', 'cut'].includes(apparatus.operation), p,
    text(current?.snapshot.maps?.find((row: Obj) => row.map?.id === currentId)?.map.title)));
  return { orderId: currentId && currentId !== orderId ? currentId : orderId, scannedOrderId: orderId, qr, switching: !!currentId && currentId !== orderId };
}

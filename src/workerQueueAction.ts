import type { Session } from './auth';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';
import { progressBatchFromJson } from './workerProgressBatch';
import { completionRequestNotification, productionOrderStatusDetail, queueWorkActivity } from './workerQueueModels';
import { printJobFromJson, type WorkerPrintJob } from './workerPrintJob';
import { rezkaReportFromJson, rezkaReportFromSession } from './workerRezkaReport';
import { printPreflightHold } from './workerPrintPreflight';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const trimmed = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const automaticInvalid = () => new WorkerControlException('qolip_automatic_confirmation_invalid', 'Qoliplarni avtomatik tasdiqlash ma’lumoti tasdiqlanmadi');

export function queueActionBody(input: Obj): Obj {
  const { apparatus, order_id: orderId, action } = input;
  if (input.qolip_confirmation != null) {
    const confirmation = object(input.qolip_confirmation);
    if (!confirmation || confirmation.method !== 'automatic' || !trimmed(confirmation.set_id) ||
        typeof confirmation.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(confirmation.fingerprint) ||
        !Number.isInteger(confirmation.policy_revision) || confirmation.policy_revision < 0 ||
        !['start', 'resume'].includes(action) || trimmed(input.qolip_code) ||
        (Array.isArray(input.qolip_codes) && input.qolip_codes.some((code: unknown) => trimmed(code)))) throw automaticInvalid();
  }
  if (typeof apparatus !== 'string' || !isCanonicalApparatusId(apparatus.trim())) {
    throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  }
  const issue = trimmed(input.issue_note);
  if (input.freeze_with_issue === true && !issue) throw new WorkerControlException('issue_note_required', 'Muammo izohini kiriting');
  if (input.freeze_with_issue === true && action !== 'freeze') {
    throw new WorkerControlException('freeze_with_issue_only_on_freeze', 'Muammo bilan yakunlash faqat muzlatish amalida mumkin');
  }
  if (action === 'freeze' && input.freeze_with_issue !== true && !trimmed(input.freeze_request_id)) {
    throw new WorkerControlException('freeze_action_requires_issue', 'Muzlatish amalida muammo izohi majburiy');
  }
  const body: Obj = { apparatus, order_id: orderId, action };
  for (const key of ['include_control', 'complete_without_output', 'freeze_with_issue', 'full_completion_report_required',
    'worker_handoff', 'remove_roll_from_apparatus']) if (input[key] === true) body[key] = true;
  if (input.freeze_with_issue === true) body.issue_note = issue;
  for (const key of ['output_paddon_code', 'print_preflight_hold_id', 'freeze_request_id', 'uom', 'qr_payload',
    'progress_batch_id', 'customer_name', 'printer', 'print_mode', 'completion_request_note', 'returned_paint_image_id']) {
    const value = trimmed(input[key]); if (value) body[key] = value;
  }
  const driver = trimmed(input.driver_url).replace(/\/+$/, '');
  if (driver) body.driver_url = driver;
  if (input.print_transport === 'offline' || input.print_transport === 'bluetooth') body.print_transport = 'offline';
  const barcodes = Array.isArray(input.material_barcodes) ? input.material_barcodes.map(trimmed).filter(Boolean) : [];
  if (barcodes.length) body.material_barcodes = barcodes;
  else if (trimmed(input.material_barcode)) body.material_barcode = trimmed(input.material_barcode);
  const codes: string[] = [];
  for (const value of Array.isArray(input.qolip_codes) ? input.qolip_codes : []) {
    const code = trimmed(value);
    if (code && !codes.some(existing => existing.toLowerCase() === code.toLowerCase())) codes.push(code);
  }
  if (codes.length) body.qolip_codes = codes;
  else if (trimmed(input.qolip_code)) body.qolip_code = trimmed(input.qolip_code);
  if (input.qolip_confirmation != null) {
    body.qolip_confirmation = { method: 'automatic', set_id: input.qolip_confirmation.set_id.trim(),
      fingerprint: input.qolip_confirmation.fingerprint, policy_revision: input.qolip_confirmation.policy_revision };
  }
  for (const key of ['produced_qty', 'gross_qty', 'bobina_kg', 'diameter', 'return_ink_kg', 'lamination_print_leftover_rolls',
    'lamination_film_leftover_rolls', 'rezka_bosma_waste', 'rezka_lamination_waste', 'rezka_edge_waste',
    'total_waste', 'finished_goods_kg', 'finished_goods_meter', 'rezka_record_frame_index']) if (input[key] != null) body[key] = input[key];
  for (const key of ['rezka_frames', 'rezka_expected_kadr_counts']) {
    if (Array.isArray(input[key]) && input[key].length) body[key] = input[key];
  }
  if (Array.isArray(input.returned_paint_items) && input.returned_paint_items.length) {
    body.returned_paint_items = input.returned_paint_items.map((item: Obj) => ({ usage: item.usage, category: item.category,
      name: item.name, values: item.values }));
  }
  for (const key of ['rezka_output_cycle', 'rezka_expected_epoch']) if (typeof input[key] === 'string' && input[key]) body[key] = input[key];
  return body;
}

function trainingPrintJobs(batches: Obj[], input: Obj): WorkerPrintJob[] {
  return batches.map(batch => {
    const payload = object(batch.payload_json) ?? {}, gross = payload.gross_qty ?? batch.finished_goods_kg ?? batch.produced_qty;
    const tare = batch.bobina_kg ?? 0, customer = trimmed(input.customer_name) || String(payload.customer_name ?? '');
    return printJobFromJson({ epc: batch.qr_payload, item_code: batch.label_item_code, item_name: batch.label_item_name,
      order_code: '', warehouse: `Ijrochi: ${batch.executor_name}`, printer: trimmed(input.printer) || 'godex',
      print_mode: trimmed(input.print_mode) || 'label', gross_qty: gross, unit: 'kg', label_kind: 'progress',
      executor_name: batch.executor_name, progress_qty: batch.finished_goods_meter ?? batch.produced_qty,
      progress_unit: batch.uom === '' ? 'm' : batch.uom, completed_at_unix: batch.completed_at_unix,
      tare_enabled: tare > 0, tare_kg: tare, include_bobina_in_net: payload.include_bobina_in_net === true, customer_name: customer });
  });
}

function validRezkaMergeState(control: Obj, actions: string[]): boolean {
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
  const lineage: { id: string; sequence: number; inUse: boolean }[] = [];
  if (Object.hasOwn(control, 'rezka_input_lineage')) {
    if (!Array.isArray(control.rezka_input_lineage)) return false;
    for (const raw of control.rezka_input_lineage) {
      const row = object(raw), id = String(row?.input_batch_id ?? '').trim(), sequence = row?.sequence_no;
      const state = String(row?.status ?? '').trim().toLowerCase(), kind = String(row?.source_kind ?? '').trim().toLowerCase();
      if (!row || !id || !positive(sequence) || !['in_use', 'processed'].includes(state) ||
          !['progress_batch', 'opening_wip'].includes(kind)) return false;
      lineage.push({ id, sequence, inUse: state === 'in_use' });
    }
  }
  const ids = new Set<string>(), sequences = new Set<number>(), active: string[] = [];
  for (const link of lineage) {
    if (ids.has(link.id) || sequences.has(link.sequence)) return false;
    ids.add(link.id); sequences.add(link.sequence);
    if (link.inUse) active.push(link.id);
  }
  if (active.length > 1 || (actions.includes('merge') && Object.hasOwn(control, 'rezka_input_lineage') && active.length !== 1)) return false;
  if (Object.hasOwn(control, 'rezka_active_partial_rolls')) {
    if (!Array.isArray(control.rezka_active_partial_rolls)) return false;
    const slots = new Set<number>();
    for (const raw of control.rezka_active_partial_rolls) {
      const row = object(raw), sources = row?.source_input_batch_ids;
      if (!row || !positive(row.slot_index) || !positive(row.generation) || !positive(row.contained_kadr_count) ||
          String(row.status ?? '').trim().toLowerCase() !== 'active' || !Array.isArray(sources) || slots.has(row.slot_index) ||
          sources.some((value: unknown) => typeof value !== 'string' || !value.trim())) return false;
      const normalized = sources.map((value: string) => value.trim());
      if (new Set(normalized).size !== normalized.length || normalized.some((id: string) => !ids.has(id)) ||
          (active.length ? !normalized.includes(active[0]) : normalized.length > 0)) return false;
      slots.add(row.slot_index);
    }
  }
  const counts = control.rezka_output_kadr_counts;
  if (Object.hasOwn(control, 'rezka_output_kadr_counts') && (!Array.isArray(counts) || counts.some((value: unknown) => !positive(value)))) return false;
  if (control.rezka_output_report != null) {
    const report = rezkaReportFromJson(control.rezka_output_report);
    if (!report || report.frames.some(frame => frame.index > (Array.isArray(counts) ? counts.length : 0))) return false;
  }
  return true;
}

export function queueActionControlState(raw: unknown, contractOnly = false): Obj | null {
  const state = object(raw), control = object(state?.control), interaction = object(control?.interaction);
  if (!state || !control || !interaction || !object(state.stage_states) || typeof state.apparatus !== 'string' ||
      typeof state.order_id !== 'string' || typeof state.queue_state !== 'string' || !Array.isArray(control.allowed_actions)) return null;
  if (control.allowed_actions.some((action: unknown) => typeof action !== 'string' || !action.trim())) return null;
  const actions = [...new Set<string>(control.allowed_actions.map((action: string) => action.trim()))];
  if (!validRezkaMergeState(control, actions)) return null;
  const freeze = object(control.freeze_request);
  let normalizedFreeze: Obj | null = null;
  if (freeze) {
    const target = String(freeze.target_apparatus ?? '').trim();
    if ((target && !isCanonicalApparatusId(target)) || ['requested_at_unix', 'transitioned_at_unix']
      .some(key => freeze[key] != null && typeof freeze[key] !== 'number')) return null;
    normalizedFreeze = { scope: String(freeze.scope ?? 'order'), stage_node_id: String(freeze.stage_node_id ?? ''),
      request_id: String(freeze.request_id ?? ''), status: String(freeze.status ?? ''), target_session_id: String(freeze.target_session_id ?? ''),
      target_apparatus: target, target_worker_role: String(freeze.target_worker_role ?? ''), target_worker_ref: String(freeze.target_worker_ref ?? ''),
      target_worker_display_name: String(freeze.target_worker_display_name ?? ''), requested_at_unix: Math.trunc(freeze.requested_at_unix ?? 0),
      transitioned_at_unix: Math.trunc(freeze.transitioned_at_unix ?? 0) };
  }
  const hold = Object.hasOwn(control, 'print_preflight') ? printPreflightHold(control.print_preflight) : undefined;
  if (hold === null) return null;
  const normalizedInteraction = { ...interaction,
    mode: String(interaction.mode ?? '').trim(), start_materials_mode: String(interaction.start_materials_mode ?? '').trim(),
    previous_wip_mode: String(interaction.previous_wip_mode ?? '').trim(),
    opening_wip_mode: interaction.opening_wip_mode == null ? 'not_required' : String(interaction.opening_wip_mode).trim(),
    qolip_mode: String(interaction.qolip_mode ?? '').trim(), blocking_reason_code: String(interaction.blocking_reason_code ?? '').trim() };
  const normalizedControl = { ...control, state: typeof control.state === 'string' ? control.state.trim().toLowerCase() : control.state,
    allowed_actions: actions, interaction: normalizedInteraction, previous_stage: String(control.previous_stage ?? '').trim(),
    stage_node_id: String(control.stage_node_id ?? '').trim(), stage_control_state: String(control.stage_control_state ?? '').trim(),
    closing_output_batch_id: typeof control.closing_output_batch_id === 'string' ? control.closing_output_batch_id.trim() : '',
    ...(normalizedFreeze ? { freeze_request: normalizedFreeze } : {}),
    ...(hold ? { print_preflight: hold } : {}) };
  if (!validOrderControl({ ok: true, control_state: { ...state, scope: '__action__',
    queue_state: state.queue_state.trim(), control: normalizedControl } }, state.apparatus, state.order_id, null, contractOnly)) return null;
  const stages = state.order_id === state.order_id.trim() ? Object.fromEntries(Object.entries(state.stage_states)
    .filter(([key]) => !!key.trim()).map(([key, value]) => [key.trim(), String(value).trim().toLowerCase()])) : {};
  const stageWork = object(control.stage_work);
  const normalizedStageWork = stageWork ? {
    completed: stageWork.completed === true, local_completed: stageWork.local_completed === true,
    upstream_closed: stageWork.upstream_closed === true, astatka_available: stageWork.astatka_available === true,
    astatka_required: stageWork.astatka_required === true, report_session_id: String(stageWork.report_session_id ?? ''),
    upstream_title: String(stageWork.upstream_title ?? ''), last_apparatus: String(stageWork.last_apparatus ?? ''),
    last_worker_ref: String(stageWork.last_worker_ref ?? ''),
  } : null;
  const lastWorked = control.last_worked_at_unix;
  return { ...state, control: { ...normalizedControl, state: control.state.trim(), freeze_request: normalizedFreeze,
    stage_work: normalizedStageWork, work_activity: queueWorkActivity(control.work_activity),
    last_worked_at_unix: Number.isInteger(lastWorked) && lastWorked > 0 ? lastWorked : 0,
    temporarily_paused: control.temporarily_paused === true, print_preflight_allowed: control.print_preflight_allowed === true,
    complete_requires_rezka_total_waste_only: control.complete_requires_rezka_total_waste_only === true,
    rezka_total_waste_only: control.rezka_total_waste_only === true }, stage_states: stages };
}

export function parseQueueActionResponse(raw: unknown, input: Obj = {}): Obj {
  const payload = object(raw);
  if (!payload) throw new TypeError('Invalid queue action response');
  const states = object(payload.states);
  const rawOrderControl = object(payload.order_control), rawState = trimmed(rawOrderControl?.state);
  const orderControl = rawOrderControl ? { state: ['frozen', 'freeze_requested'].includes(rawState) ? rawState : 'active' } : null;
  const result: Obj = {
    states: states ? Object.fromEntries(Object.entries(states).map(([key, value]) => [key, String(value)])) : {},
    rev: states && Number.isInteger(payload.rev) && payload.rev >= 0 ? payload.rev : null,
    epoch: states && typeof payload.epoch === 'string' ? payload.epoch.trim() : '',
    order_control: orderControl, order_status: productionOrderStatusDetail(payload.order_status),
    has_order_status: !!object(payload.order_status), control_state: null, work_activity: null, has_work_activity: false,
    progress_batch: null, progress_batches: [], rezka_output_report: null, completion_request: null,
    print_job: null, print_jobs: [], print: null, prints: [],
  };
  result.has_snapshot_cursor = result.rev !== null && !!result.epoch;
  if (!states) return result;
  result.control_state = queueActionControlState(payload.control_state);
  const batches = Array.isArray(payload.progress_batches) ? payload.progress_batches.filter(object).map((item: unknown) => progressBatchFromJson(item)) : [];
  result.progress_batches = batches;
  result.progress_batch = object(payload.progress_batch) ? progressBatchFromJson(payload.progress_batch) : batches[0] ?? null;
  const completionTimes = new Map<string, number>();
  for (const batch of [...batches, ...(result.progress_batch ? [result.progress_batch] : [])]) {
    if (batch.completed_at_unix > 0) completionTimes.set(String(batch.qr_payload).trim().toLowerCase(), batch.completed_at_unix);
  }
  const parseJob = (rawJob: Obj) => printJobFromJson(rawJob,
    completionTimes.get(String(rawJob.epc ?? rawJob.qr_payload ?? '').trim().toLowerCase()) ?? 0);
  let jobs = Array.isArray(payload.prints) ? payload.prints.filter((item: unknown) => object(item)?.ok === true).map(parseJob) : [];
  if (String(input.order_id ?? '').trim().startsWith('training-') && ['offline', 'bluetooth'].includes(input.print_transport) && !jobs.length) {
    jobs = trainingPrintJobs(batches, input);
  }
  const print = object(payload.print)?.ok === true ? parseJob(payload.print) : jobs[0] ?? null;
  result.print_jobs = result.prints = jobs;
  result.print_job = result.print = print;
  result.rezka_output_report = rezkaReportFromSession(payload.session);
  result.completion_request = object(payload.completion_request) ? completionRequestNotification(payload.completion_request) : null;
  result.work_activity = queueWorkActivity(payload.work_activity);
  result.has_work_activity = Object.hasOwn(payload, 'work_activity');
  return result;
}

export async function adminApparatusQueueActionResult(session: Session, input: Obj): Promise<Obj> {
  const body = queueActionBody(input);
  return parseQueueActionResponse(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/queue-action',
    body, null, false, 'queue_action_not_allowed'), input);
}

import type { Session } from './auth';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';
import { progressBatchFromJson } from './workerProgressBatch';
import { completionRequestNotification, productionOrderStatusDetail, queueWorkActivity } from './workerQueueModels';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const trimmed = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const automaticInvalid = () => new WorkerControlException('qolip_automatic_confirmation_invalid', 'Qoliplarni avtomatik tasdiqlash ma’lumotlari noto‘g‘ri');

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
  for (const key of ['rezka_frames', 'rezka_expected_kadr_counts', 'returned_paint_items']) {
    if (Array.isArray(input[key]) && input[key].length) body[key] = input[key];
  }
  for (const key of ['rezka_output_cycle', 'rezka_expected_epoch']) if (typeof input[key] === 'string' && input[key]) body[key] = input[key];
  return body;
}

export function parseQueueActionResponse(raw: unknown): Obj {
  const payload = object(raw);
  if (!payload) throw new TypeError('Invalid queue action response');
  const states = object(payload.states);
  const result: Obj = {
    states: states ? Object.fromEntries(Object.entries(states).map(([key, value]) => [key, String(value)])) : {},
    rev: states && Number.isInteger(payload.rev) && payload.rev >= 0 ? payload.rev : null,
    epoch: states && typeof payload.epoch === 'string' ? payload.epoch.trim() : '',
    order_control: object(payload.order_control), order_status: productionOrderStatusDetail(payload.order_status),
    has_order_status: !!object(payload.order_status), control_state: null,
  };
  result.has_snapshot_cursor = result.rev !== null && !!result.epoch;
  if (!states) return result;
  const state = object(payload.control_state);
  if (state && object(state.stage_states) && typeof state.apparatus === 'string' && typeof state.order_id === 'string' &&
      validOrderControl({ ok: true, control_state: { ...state, scope: state.scope || '__action__' } }, state.apparatus, state.order_id, null)) {
    result.control_state = state;
  }
  const batches = Array.isArray(payload.progress_batches) ? payload.progress_batches.filter(object).map((item: unknown) => progressBatchFromJson(item)) : [];
  result.progress_batches = batches;
  result.progress_batch = object(payload.progress_batch) ? progressBatchFromJson(payload.progress_batch) : batches[0] ?? null;
  result.prints = Array.isArray(payload.prints) ? payload.prints.filter((item: unknown) => object(item)?.ok === true) : [];
  result.print = object(payload.print)?.ok === true ? payload.print : result.prints[0] ?? null;
  result.completion_request = object(payload.completion_request) ? completionRequestNotification(payload.completion_request) : null;
  result.work_activity = queueWorkActivity(payload.work_activity);
  result.has_work_activity = Object.hasOwn(payload, 'work_activity');
  return result;
}

export async function adminApparatusQueueActionResult(session: Session, input: Obj): Promise<Obj> {
  const body = queueActionBody(input);
  return parseQueueActionResponse(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/queue-action',
    body, null, false, 'queue_action_not_allowed'));
}

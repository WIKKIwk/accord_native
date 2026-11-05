import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { rawMaterialAssignment } from './workerRawMaterials';
import { progressBatchFromJson, progressInputRoute } from './workerProgressBatch';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';
import { queueActionControlState } from './workerQueueAction';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
const invalid = (message: string) => new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${message}`);

function comparable(value: any): any {
  if (Array.isArray(value)) return value.map(comparable);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparable(value[key])]));
  return value;
}
const equal = (left: unknown, right: unknown) => JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));

function completeMaterials(raw: unknown, order: string): boolean {
  const value = object(raw);
  if (!value || !['state_all', 'requirement_groups'].includes(value.policy) ||
      ['requires_material', 'material_scan_required', 'assignments_satisfied', 'scan_satisfied'].some(key => typeof value[key] !== 'boolean') ||
      ['required_scan_count', 'matched_scan_count'].some(key => !Number.isInteger(value[key]) || value[key] < 0) ||
      ['assigned_barcodes', 'staged_barcodes', 'eligible_barcodes'].some(key => !strings(value[key])) ||
      !Array.isArray(value.requirement_groups) || value.requirement_groups.some((rawGroup: unknown) => {
        const group = object(rawGroup);
        return !group || typeof (group.requirement_id ?? group.name) !== 'string' ||
          !strings(group.item_group_ids ?? group.item_groups) || !Number.isInteger(group.minimum_required_count ?? group.min_required_count);
      })) return false;
  try {
    return ['assignments', 'start_assignments'].every(key => Array.isArray(value[key]) && value[key].every((rawRow: unknown) => {
      const row = object(rawRow);
      if (!row || row.order_id !== order || typeof row.barcode !== 'string' || !row.barcode ||
          typeof (row.apparatus_id ?? row.apparatus) !== 'string') return false;
      rawMaterialAssignment(row);
      return true;
    }));
  } catch { return false; }
}

export function completeQolips(raw: unknown, interaction: Obj): boolean {
  const value = object(raw), qolip = object(value?.qolip);
  if (!value || value.ok !== true || !qolip || qolip.qolip_code !== '' ||
      !Array.isArray(qolip.required_qolips) || !strings(qolip.required_qolip_codes) ||
      !Number.isInteger(qolip.required_qolip_count) || qolip.required_qolip_count !== qolip.required_qolips.length ||
      qolip.required_qolip_codes.length !== qolip.required_qolips.length ||
      qolip.required_qolips.some((row: unknown, index: number) => {
        const mold = object(row);
        return !mold || typeof mold.qolip_code !== 'string' || !mold.qolip_code ||
          typeof mold.color !== 'string' || mold.qolip_code !== qolip.required_qolip_codes[index];
      })) return false;
  if (qolip.automatic_confirmation_enabled != null && typeof qolip.automatic_confirmation_enabled !== 'boolean') return false;
  if (qolip.policy_revision != null && (!Number.isInteger(qolip.policy_revision) || qolip.policy_revision < 0)) return false;
  const automatic = qolip.automatic_confirmation_enabled === true;
  if (automatic !== (interaction.qolip_automatic_confirmation === true) ||
      (automatic && qolip.policy_revision !== interaction.qolip_policy_revision)) return false;
  if (qolip.reused_qolip_codes != null) {
    if (!Array.isArray(qolip.reused_qolip_codes) || qolip.reused_qolip_codes.some((code: unknown) => !nonempty(code))) return false;
    const codes = new Set(qolip.reused_qolip_codes.map((code: string) => code.trim().toLowerCase()));
    const required = new Set(qolip.required_qolips.map((mold: Obj) => mold.qolip_code.trim().toLowerCase()));
    if (codes.size && (codes.size !== qolip.reused_qolip_codes.length || codes.size !== required.size ||
        [...codes].some(code => !required.has(code)))) return false;
  }
  if (!automatic) return true;
  if (!Number.isInteger(qolip.policy_revision) || typeof qolip.blocking_reason_code !== 'string' || !Array.isArray(qolip.sets)) return false;
  const codes = new Set<string>();
  if (qolip.required_qolips.some((mold: Obj) => {
    const code = mold.qolip_code.trim().toLowerCase();
    if (!code || codes.has(code) || !nonempty(mold.qolip_set_id) || typeof mold.is_extension !== 'boolean' ||
        typeof mold.ready !== 'boolean' || typeof mold.blocking_reason_code !== 'string' ||
        (mold.ready && mold.blocking_reason_code !== '')) return true;
    codes.add(code); return false;
  })) return false;
  const setIds = new Set<string>();
  if (qolip.sets.some((rawSet: unknown) => {
    const set = object(rawSet), id = typeof set?.set_id === 'string' ? set.set_id.trim() : '';
    if (!set || !id || setIds.has(id) || typeof set.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(set.fingerprint) ||
        typeof set.ready !== 'boolean' || typeof set.blocking_reason_code !== 'string' || (set.ready && set.blocking_reason_code)) return true;
    setIds.add(id);
    if (!set.ready) return false;
    const molds = qolip.required_qolips as Obj[];
    return !molds.some(mold => mold.qolip_set_id.trim() === id && (!mold.is_extension || molds.every(item => item.is_extension))) ||
      molds.some(mold => (mold.is_extension || mold.qolip_set_id.trim() === id) && !mold.ready);
  })) return false;
  return !((!qolip.required_qolips.length || !qolip.sets.length) && !qolip.blocking_reason_code) &&
    !(qolip.blocking_reason_code && qolip.sets.some((set: Obj) => set.ready));
}

function validBatch(row: Obj): boolean {
  try { progressBatchFromJson(row); return true; } catch { return false; }
}

function scopedSection(section: unknown, state: Obj): Obj | null {
  const value = object(section);
  return value && value.status === 'ready' && value.apparatus === state.apparatus && value.order_id === state.order_id &&
    value.stage_node_id === state.control.stage_node_id ? value : null;
}

function completeAssignments(section: unknown, state: Obj): boolean {
  const value = scopedSection(section, state), rows = value?.data;
  if (!Array.isArray(rows)) return false;
  const codes = new Set<string>();
  try {
    return rows.every((raw: unknown) => {
      const row = object(raw), code = typeof row?.barcode === 'string' ? row.barcode.trim().toUpperCase() : '';
      if (!row || row.order_id !== state.order_id || !code || codes.has(code) ||
          ['item_code', 'item_name', 'item_group'].some(key => typeof row[key] !== 'string') ||
          rawMaterialAssignment(row).apparatus !== state.apparatus) return false;
      codes.add(code); return true;
    });
  } catch { return false; }
}

function completeInput(section: unknown, state: Obj): boolean {
  const value = scopedSection(section, state), rows = object(value?.data)?.batches;
  if (!value || value.limit !== 500 || value.status_filter !== 'waiting' || !Array.isArray(rows) || rows.length > 500) return false;
  const ids = new Set<string>(), qrs = new Set<string>();
  return rows.every((raw: unknown) => {
    const row = object(raw), id = typeof row?.batch_id === 'string' ? row.batch_id.trim() : '';
    const qr = typeof row?.qr_payload === 'string' ? row.qr_payload.trim().toUpperCase() : '';
    if (!row || row.order_id !== state.order_id || row.wip_status !== 'waiting' || !id || ids.has(id) || !qr || qrs.has(qr) ||
        typeof row.apparatus !== 'string' || typeof row.uom !== 'string' || typeof row.produced_qty !== 'number' ||
        !Number.isFinite(row.produced_qty) || (row.payload_json != null && !object(row.payload_json)) || !validBatch(row)) return false;
    ids.add(id); qrs.add(qr); return true;
  });
}

function validateContext(raw: unknown, state: Obj, session?: Session) {
  const context = object(raw), station = state.apparatus, order = state.order_id;
  if (!context || context.ok !== true || !Array.isArray(context.maps) || !object(context.stage_states)) throw invalid('invalid scan queue context');
  const decoded = decodeCanonicalProductionMapSnapshot(context, false, session);
  if (decoded.maps.length !== context.maps.length ||
      !object(context.sequences) || !object(context.visible_order_ids) || !object(context.queue_states) ||
      !object(context.queue_action_controls) || !Array.isArray(context.queue_policies) || !object(context.order_controls) ||
      decoded.epoch !== state.epoch || decoded.revision !== state.rev || decoded.scope !== state.scope ||
      decoded.queue_states?.[station]?.[order] !== state.queue_state ||
      (decoded.order_controls?.[order] ?? 'active') !== state.order_control ||
      !equal(decoded.stage_states[order] ?? {}, state.stage_states) ||
      !object(context.queue_action_controls?.[station]?.[order]) ||
      !equal(context.queue_action_controls[station][order], state.control)) throw invalid('invalid scan queue context');
  for (const field of ['sequences', 'visible_order_ids']) {
    for (const [apparatus, ids] of Object.entries(context[field])) {
      if (!isCanonicalApparatusId(apparatus.trim()) || !Array.isArray(ids) ||
          ids.some(id => typeof id !== 'string' || !id.trim())) throw invalid(`invalid scan ${field}`);
    }
  }
  const knownStates = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);
  for (const [apparatus, rawStates] of Object.entries(context.queue_states)) {
    const states = object(rawStates);
    if (!isCanonicalApparatusId(apparatus.trim()) || !states || Object.entries(states).some(([id, value]) =>
      !id.trim() || typeof value !== 'string' || !knownStates.has(value.trim().toLowerCase()))) throw invalid('invalid scan queue states');
  }
  for (const [apparatus, rawControls] of Object.entries(context.queue_action_controls)) {
    const controls = object(rawControls);
    if (!isCanonicalApparatusId(apparatus.trim()) || !controls || Object.entries(controls).some(([id, value]) =>
      !id.trim() || !object(value))) throw invalid('invalid scan action controls');
    for (const [id, value] of Object.entries(controls)) {
      const control = object(value)!;
      const queueState = context.queue_states[apparatus]?.[id];
      if (typeof control.state !== 'string' || !knownStates.has(control.state.trim().toLowerCase()) ||
          !Array.isArray(control.allowed_actions) || control.allowed_actions.some((action: unknown) =>
            typeof action !== 'string' || !['start', 'pause', 'detach_roll', 'merge', 'resume', 'roll_complete', 'complete', 'freeze'].includes(action.trim())) ||
          !object(control.interaction) || typeof control.previous_stage_ready !== 'boolean' ||
          typeof control.complete_requires_full_report !== 'boolean' ||
          (typeof queueState === 'string' && queueState.trim() && queueState.trim().toLowerCase() !== control.state.trim().toLowerCase())) {
        throw invalid('invalid scan action control');
      }
    }
  }
  for (const [id, value] of Object.entries(context.stage_states)) {
    const stages = object(value);
    if (!id.trim() || !stages) continue;
    if (Object.entries(stages).some(([stage, status]) => stage.trim() && !knownStates.has(String(status).trim().toLowerCase()))) {
      throw invalid('invalid scan stage state');
    }
  }
  if (context.queue_policies.some((rawPolicy: unknown) => {
    const policy = object(rawPolicy);
    return !policy || typeof policy.apparatus_id !== 'string' || !isCanonicalApparatusId(policy.apparatus_id.trim()) ||
      typeof policy.policy !== 'string' || !['strict_sequence', 'free_pick'].includes(policy.policy.trim());
  }) || Object.entries(context.order_controls).some(([id, value]) => {
    const control = object(value);
    return !id.trim() || !control || typeof control.state !== 'string' ||
      !['active', 'freeze_requested', 'frozen'].includes(control.state.trim());
  })) throw invalid('invalid scan queue policies or order controls');
  const ids = context.maps.map((row: unknown) => {
    const entry = object(row), map = object(entry?.map);
    if (!entry || !map || !object(entry.program) || typeof map.id !== 'string') throw invalid('invalid scan queue map');
    return map.id.trim();
  });
  if (ids.some((id: string) => !id) || new Set(ids).size !== ids.length || !ids.includes(order)) throw invalid('invalid scan queue maps');
  return decoded;
}

function validateProgress(raw: unknown, state: Obj, qr: string) {
  const proof = object(raw), batch = object(proof?.batch), route = object(proof?.input_route);
  if (!proof || proof.ok !== true || proof.active_order_validated !== true || proof.validated_apparatus !== state.apparatus ||
      proof.validated_order_id !== state.order_id || state.order_control !== 'active' || !batch || !nonempty(batch.batch_id) ||
      batch.order_id !== state.order_id || !qr.trim() || typeof batch.qr_payload !== 'string' ||
      batch.qr_payload.trim().toUpperCase() !== qr.trim().toUpperCase() || batch.wip_status !== 'waiting' ||
      !validBatch(batch) || !route || (proof.input_route_error != null && proof.input_route_error !== '')) throw invalid('invalid scan progress proof');
  const inputRoute = progressInputRoute(route);
  if (!inputRoute.consumer_apparatus_ids.includes(state.apparatus)) throw invalid('invalid scan progress route');
  return { ...proof, batch: progressBatchFromJson(batch, { inputRoute, hasInputRouteMetadata: true }), input_route: inputRoute };
}

export function parseWorkerScanBootstrap(raw: unknown, apparatus: string, orderId: string, qrPayload = '', session?: Session): Obj {
  const data = object(raw), state = object(data?.control_state);
  let control: Obj | null = null;
  try { control = state ? queueActionControlState(state, false, session) : null; } catch { /* Invalid control data is not authoritative. */ }
  if (!data || data.ok !== true || !state || !control || state.apparatus !== apparatus || state.order_id !== orderId ||
      typeof state.scope !== 'string' || !state.scope) throw invalid('invalid scan bootstrap control');
  const contextState = { ...control, control: state.control };
  const queueContext = Object.hasOwn(data, 'queue_context') ? validateContext(data.queue_context, contextState, session) : undefined;
  const validatedProgress = Object.hasOwn(data, 'validated_progress') ? validateProgress(data.validated_progress, control, qrPayload) : undefined;
  const sections = object(data.sections) ?? {};
  const result: Obj = { ...data, control_state: control, sections: { ...sections } };
  if (queueContext) result.queue_context = queueContext;
  if (validatedProgress) result.validated_progress = validatedProgress;
  for (const [name, valid] of [
    ['materials', completeMaterials(object(sections.materials)?.status === 'ready' ? sections.materials.data : null, orderId)],
    ['qolips', completeQolips(object(sections.qolips)?.status === 'ready' ? sections.qolips.data : null, control.control.interaction)],
    ['material_assignments', completeAssignments(sections.material_assignments, control)],
    ['input_progress', completeInput(sections.input_progress, control)],
  ] as const) {
    if (!valid && object(sections[name])?.status === 'ready') result.sections[name] = { ...sections[name], status: 'incomplete' };
  }
  return result;
}

/** @v2 adminOrderScanBootstrap */
export async function adminOrderScanBootstrap(session: Session, input: {
  apparatus: string; orderId: string; materialBarcodes?: string[]; includeSections?: boolean; includeContext?: boolean;
  automaticQolipConfirmation?: boolean; qrPayload?: string;
}): Promise<Obj | null> {
  const station = input.apparatus.trim(), order = input.orderId.trim(), qr = input.qrPayload?.trim() ?? '';
  if (!isCanonicalApparatusId(station)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const query = new URLSearchParams({ apparatus: station, order_id: order });
  if (input.includeSections === false) query.set('include_sections', 'false');
  if (input.includeContext) query.set('include_context', 'true');
  if (input.automaticQolipConfirmation) query.set('automatic_qolip_confirmation', 'true');
  if (qr) query.set('qr_payload', qr);
  if (input.materialBarcodes?.length) query.set('material_barcodes', input.materialBarcodes.join(','));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${query}`, { signal: controller.signal });
    const body = await response.text();
    if ((response.status === 404 || response.status === 405) && !body.trim()) return null;
    if (response.status !== 200) {
      let payload: unknown; try { payload = JSON.parse(body); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'order_scan_bootstrap_failed');
    }
    return parseWorkerScanBootstrap(JSON.parse(body), station, order, qr, session);
  } finally { clearTimeout(timer); }
}

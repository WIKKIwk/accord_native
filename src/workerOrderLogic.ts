type Obj = Record<string, any>;
export type QueueCursor = { epoch?: unknown; rev?: unknown };

const paintFields = ['Mix', '1w Oq', '7w Oq', 'Qora', 'Sariq', 'Qizil', 'Ko‘k', 'Spirt'];
export const paintOptions = [
  { name: 'Mix', category: 'colors', fields: [] },
  { name: 'Pantone', category: 'colors', fields: [] },
  ...['Oq', 'Sariq', 'Qizil', 'Ko‘k', 'Tilla', 'Kumush', 'Qora'].map(name => ({ name, category: 'colors', fields: paintFields })),
  { name: 'Lak', category: 'lacquers', fields: ['OPV lak', 'MAT lak'] },
  { name: 'Spirtlar', category: 'solvents', fields: ['Aralashmalar', 'Etil', 'Metoxil', 'Rasvavitel', 'Izopropel'] },
];

export function returnedPaintItemsFromDraft(paint: Record<string, string>, dynamic: Record<string, string[]>) {
  function valuesFor(usage: string, name: string, labels: string[]) {
    return Object.fromEntries(labels.flatMap(label => {
      const value = paint[`${usage}:${name}:${label}`]?.trim();
      return value ? [[label, value.replace(',', '.')]] : [];
    }));
  }
  return ['rasxot', 'astatka'].flatMap(usage => [
    ...paintOptions.flatMap(option => {
      const values = valuesFor(usage, option.name, [...option.fields, ...(dynamic[`${usage}:${option.name}`] ?? [])]);
      return Object.keys(values).length ? [{ usage, category: option.category, name: option.name, values }] : [];
    }),
    ...(() => {
      const values = valuesFor(usage, 'Pantone Mix', dynamic[`${usage}:Pantone Mix`] ?? []);
      return Object.keys(values).length ? [{ usage, category: 'colors', name: 'Mix', values }] : [];
    })(),
  ]);
}

export function matchesMaterialAssignment(row: Obj, orderId: string, apparatus: string): boolean {
  const station = typeof row.apparatus_id === 'string' && row.apparatus_id.trim() ? row.apparatus_id : row.apparatus;
  return row.order_id === orderId && station === apparatus;
}

export function materialStartReadiness(interaction: Obj, section: Obj | undefined, orderWidth: unknown) {
  if (interaction.start_materials_mode !== 'scan_required') return { ready: true, reason: '', unavailable: false };
  if (section?.status !== 'ready' || !section.data) return { ready: false, reason: 'Homashyo qoidasi yuklanmadi', unavailable: true };
  const data = section.data;
  const assigned: string[] = Array.isArray(data.assigned_barcodes) ? data.assigned_barcodes.filter((value: unknown): value is string => typeof value === 'string' && !!value.trim()) : [];
  const staged = Array.isArray(data.staged_barcodes) ? data.staged_barcodes : [];
  const ids = new Set(assigned.map(value => value.trim().toUpperCase()));
  if (data.requires_material === true && !assigned.length) return { ready: false, reason: 'Ish boshlash uchun homashyo biriktirilmagan', unavailable: true };
  if (data.assignments_satisfied !== true) {
    const rows: Obj[] = Array.isArray(data.assignments) ? data.assignments : [];
    const relevant = rows.filter(row => ids.has(String(row.barcode ?? '').trim().toUpperCase()));
    if (relevant.some(row => row.execution_status === 'needs_cutting')) return { ready: false, reason: 'Homashyo biriktirilgan, lekin apparatingizga katta. Rezka kutilmoqda', unavailable: true };
    const mismatch = relevant.find(row => row.execution_status === 'width_mismatch');
    if (mismatch) {
      const roll = Number(mismatch.roll_width_mm);
      const order = Number(orderWidth);
      const detail = roll > 0 && order > 0 ? ` Rulon eni: ${roll} mm. Order eni: ${order} mm.` : '';
      return { ready: false, reason: `Homashyo biriktirilgan, lekin rulon eni orderga kichik.${detail}`, unavailable: true };
    }
    return { ready: false, reason: 'Majburiy homashyo guruhlari to‘liq biriktirilmagan', unavailable: true };
  }
  if (data.policy === 'state_all' && assigned.length && !staged.length) return { ready: false, reason: 'Apparat oldiga homashyo olib kelinmagan', unavailable: true };
  if (data.scan_satisfied !== true) return { ready: false, reason: data.policy === 'requirement_groups' ? 'Avval har bir majburiy guruhdan minimum homashyo QR scan qiling' : 'Avval state’dagi barcha homashyolarni QR scan qiling', unavailable: false };
  return { ready: true, reason: '', unavailable: false };
}

/** Only a scoped, current server control can enable production actions. */
export function validOrderControl(bootstrap: Obj | null, apparatus: string, orderId: string, baseline: QueueCursor | null): boolean {
  const state = bootstrap?.control_state;
  const control = state?.control;
  if (bootstrap?.ok !== true || !state || state.apparatus !== apparatus || state.order_id !== orderId ||
      typeof state.epoch !== 'string' || !state.epoch || typeof state.scope !== 'string' || !state.scope ||
      !Number.isInteger(state.rev) || state.rev < 0 || !control || !control.interaction ||
      !Array.isArray(control.allowed_actions) || control.allowed_actions.some((action: unknown) => typeof action !== 'string') ||
      typeof control.state !== 'string' || typeof state.queue_state !== 'string' ||
      typeof control.previous_stage_ready !== 'boolean' || typeof control.complete_requires_full_report !== 'boolean' ||
      (state.queue_state && control.state.toLowerCase() !== state.queue_state.toLowerCase()) ||
      !['active', 'freeze_requested', 'frozen'].includes(state.order_control)) return false;
  const interaction = control.interaction;
  const mode = interaction.mode;
  const openingMode = interaction.opening_wip_mode ?? 'not_required';
  if (!['hidden', 'scan_required'].includes(interaction.start_materials_mode) ||
      !['not_required', 'scan_required', 'waiting'].includes(interaction.previous_wip_mode) ||
      !['not_required', 'scan_required', 'waiting'].includes(openingMode) ||
      !['not_required', 'scan_required'].includes(interaction.qolip_mode) ||
      ['material_scan_required', 'assigned_materials_display_only', 'material_intake_allowed'].some(key => typeof interaction[key] !== 'boolean') ||
      (control.allowed_actions.includes('resume') && typeof interaction.resume_input_required !== 'boolean') ||
      (interaction.qolip_automatic_confirmation !== undefined && typeof interaction.qolip_automatic_confirmation !== 'boolean') ||
      (interaction.qolip_policy_revision !== undefined && (!Number.isInteger(interaction.qolip_policy_revision) || interaction.qolip_policy_revision < 0)) ||
      (interaction.qolip_automatic_confirmation === true && (interaction.qolip_mode !== 'scan_required' || !Number.isInteger(interaction.qolip_policy_revision))) ||
      (interaction.start_materials_mode === 'scan_required') !== interaction.material_scan_required ||
      (interaction.previous_wip_mode !== 'not_required' && !String(control.previous_stage ?? '').trim()) ||
      (openingMode !== 'not_required' && interaction.previous_wip_mode !== 'not_required' &&
        !(openingMode === 'scan_required' && interaction.previous_wip_mode === 'scan_required'))) return false;
  const stateModes: Record<string, string[]> = {
    pending: ['fresh_start', 'fresh_start_blocked', 'requeued_waiting', 'requeued_ready', 'waiting_previous_stage'],
    print_preflight: ['fresh_start', 'fresh_start_blocked', 'freeze_requested'],
    in_progress: ['in_progress', 'freeze_requested'], paused: ['paused', 'freeze_requested'], frozen: ['frozen'], completed: ['completed'],
  };
  if (!stateModes[control.state]?.includes(mode)) return false;
  const actionModes: Record<string, string[]> = {
    start: ['fresh_start'], resume: ['requeued_ready', 'paused'], pause: ['in_progress', 'freeze_requested'],
    detach_roll: ['in_progress', 'freeze_requested'], merge: ['in_progress'], roll_complete: ['in_progress'],
    complete: ['in_progress', ...(control.closing_output_batch_id ? ['paused'] : [])], freeze: ['in_progress', 'freeze_requested'],
  };
  if (new Set(control.allowed_actions).size !== control.allowed_actions.length ||
      control.allowed_actions.some((action: string) => !actionModes[action]?.includes(mode))) return false;
  const expected: Record<string, string[]> = {
    fresh_start: ['start'], requeued_ready: ['resume'], fresh_start_blocked: [], requeued_waiting: [],
    waiting_previous_stage: [], frozen: [], completed: [],
  };
  if (expected[mode] && (control.allowed_actions.length !== expected[mode].length ||
      expected[mode].some(action => !control.allowed_actions.includes(action)))) return false;
  if (mode === 'in_progress' && !control.allowed_actions.includes('pause')) return false;
  if (mode === 'freeze_requested') {
    const actions = control.state === 'in_progress' ? ['pause'] : control.state === 'print_preflight' ? ['freeze'] : [];
    if (control.allowed_actions.length !== actions.length || actions.some(action => !control.allowed_actions.includes(action))) return false;
  }
  if (['fresh_start_blocked', 'requeued_waiting', 'waiting_previous_stage'].includes(mode) &&
      (typeof interaction.blocking_reason_code !== 'string' || !interaction.blocking_reason_code.trim())) return false;
  if (control.closing_output_batch_id &&
      (control.state !== 'paused' || mode !== 'paused' || !control.allowed_actions.includes('complete'))) return false;
  if (control.temporarily_paused !== undefined && typeof control.temporarily_paused !== 'boolean') return false;
  if (control.temporarily_paused === true && (control.state !== 'paused' || mode !== 'paused')) return false;
  if ((control.temporary_pause != null || control.cancel_start != null) &&
      (control.state !== 'in_progress' || mode !== 'in_progress' || control.temporarily_paused === true)) return false;
  const hold = control.print_preflight;
  if (hold !== undefined && (!hold || typeof hold.hold_id !== 'string' || !hold.hold_id.trim() ||
      typeof hold.idempotency_key !== 'string' || !hold.idempotency_key.trim() ||
      typeof hold.order_id !== 'string' || !hold.order_id.trim() || typeof hold.apparatus !== 'string' || !hold.apparatus.trim() ||
      !Number.isInteger(hold.revision ?? 0) || (hold.revision ?? 0) < 0 ||
      !['held', 'running', 'passed', 'failed', 'cancelled', 'consumed'].includes(hold.status))) return false;
  if (hold && ['held', 'running'].includes(hold.status) &&
      !(control.state === 'print_preflight' && ((mode === 'fresh_start_blocked' && !control.allowed_actions.length) ||
        (mode === 'freeze_requested' && control.allowed_actions.length === 1 && control.allowed_actions[0] === 'freeze')))) return false;
  let orderControl = state.order_control;
  if (orderControl === 'active' && ['frozen', 'freeze_requested'].includes(control.stage_control_state)) {
    if (!String(control.stage_node_id ?? '').trim()) return false;
    if (control.stage_control_state === 'freeze_requested' &&
        (control.freeze_request?.scope !== 'stage' || control.freeze_request?.stage_node_id !== control.stage_node_id)) return false;
    orderControl = control.stage_control_state;
  }
  if (orderControl === 'frozen' && (mode !== 'frozen' || control.allowed_actions.length)) return false;
  if (orderControl === 'freeze_requested' && mode === 'freeze_requested') {
    const request = control.freeze_request;
    const wildcard = request && (request.scope ?? 'order') === 'order' && !request.stage_node_id && !request.target_apparatus && !request.target_session_id && !request.target_worker_ref;
    if (!request || typeof request.request_id !== 'string' || !request.request_id.trim() || request.status !== 'pending' ||
        (!String(request.target_apparatus ?? '').trim() && !wildcard) ||
        (control.state !== 'print_preflight' && !wildcard && !String(request.target_session_id ?? '').trim())) return false;
  } else if (orderControl === 'freeze_requested') {
    if (state.order_control !== 'freeze_requested' || control.allowed_actions.length ||
        !['fresh_start_blocked', 'requeued_waiting', 'waiting_previous_stage', 'frozen', 'completed'].includes(mode)) return false;
  } else if (orderControl === 'active' && (mode === 'frozen' || control.state === 'frozen' || mode === 'freeze_requested')) return false;
  if (baseline && typeof baseline.epoch === 'string' && baseline.epoch &&
      (baseline.epoch !== state.epoch || (typeof baseline.rev === 'number' && state.rev < baseline.rev))) return false;
  return true;
}

export function preflightFreezeRequest(state: Obj | undefined, apparatus: string, orderId: string): string | null {
  const control = state?.control;
  const request = control?.freeze_request;
  const hold = control?.print_preflight;
  const stageRequest = state?.order_control === 'active' && control?.stage_control_state === 'freeze_requested';
  const wildcard = !!request && (request.scope ?? 'order') === 'order' && !request.stage_node_id && !request.target_apparatus && !request.target_session_id && !request.target_worker_ref;
  if (!request || request.status !== 'pending' || typeof request.request_id !== 'string' || !request.request_id.trim() ||
      (request.target_apparatus !== apparatus && !(wildcard && state?.order_control === 'freeze_requested')) ||
      (!wildcard && request.target_session_id) ||
      (stageRequest && (request.scope !== 'stage' || !control.stage_node_id || request.stage_node_id !== control.stage_node_id)) ||
      !Array.isArray(control.allowed_actions) || !control.allowed_actions.includes('freeze') || control.state !== 'print_preflight' ||
      !hold || hold.order_id !== orderId || hold.apparatus !== apparatus || !['held', 'running'].includes(hold.status)) return null;
  return request.request_id.trim();
}

export function runningFreezeRequest(state: Obj | undefined, apparatus: string): string | null {
  const control = state?.control;
  const request = control?.freeze_request;
  const stageRequest = state?.order_control === 'active' && control?.stage_control_state === 'freeze_requested';
  const wildcard = !!request && (request.scope ?? 'order') === 'order' && !request.stage_node_id && !request.target_apparatus && !request.target_session_id && !request.target_worker_ref;
  if (!request || request.status !== 'pending' || typeof request.request_id !== 'string' || !request.request_id.trim() ||
      (request.target_apparatus !== apparatus && !(wildcard && state?.order_control === 'freeze_requested')) ||
      (!wildcard && (typeof request.target_session_id !== 'string' || !request.target_session_id.trim())) ||
      (stageRequest && (request.scope !== 'stage' || !control.stage_node_id || request.stage_node_id !== control.stage_node_id)) ||
      control.state !== 'in_progress' || !Array.isArray(control.allowed_actions) || !control.allowed_actions.includes('pause')) return null;
  return request.request_id.trim();
}

/** V2 accepts automatic molds only when the complete server policy and set agree. */
export function automaticQolipConfirmation(data: Obj | undefined, interaction: Obj, chosenSet: string): Obj | null {
  if (!data || data.automatic_confirmation_enabled !== true || !Number.isInteger(data.policy_revision) ||
      data.policy_revision < 0 || data.policy_revision !== interaction.qolip_policy_revision ||
      data.blocking_reason_code !== '' || !Array.isArray(data.sets) || !Array.isArray(data.required_qolips) ||
      !Array.isArray(data.required_qolip_codes) || data.qolip_code !== '' ||
      data.required_qolip_count !== data.required_qolips.length || data.required_qolip_codes.length !== data.required_qolips.length) return null;
  const molds: Obj[] = data.required_qolips;
  const codes = new Set<string>();
  if (!molds.every((mold, i) => {
    if (!mold || typeof mold.qolip_code !== 'string' || !mold.qolip_code.trim() ||
        typeof mold.qolip_set_id !== 'string' || !mold.qolip_set_id.trim() ||
        typeof mold.color !== 'string' || typeof mold.is_extension !== 'boolean' ||
        typeof mold.ready !== 'boolean' || typeof mold.blocking_reason_code !== 'string' ||
        (mold.ready && mold.blocking_reason_code !== '') || data.required_qolip_codes[i] !== mold.qolip_code) return false;
    const code = mold.qolip_code.trim().toLowerCase();
    if (codes.has(code)) return false;
    codes.add(code);
    return true;
  })) return null;
  const ids = new Set<string>();
  if (!data.sets.every((set: Obj) => {
    if (!set || typeof set.set_id !== 'string' || !set.set_id.trim() || ids.has(set.set_id.trim()) ||
        typeof set.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(set.fingerprint) ||
        typeof set.ready !== 'boolean' || typeof set.blocking_reason_code !== 'string' ||
        (set.ready && set.blocking_reason_code !== '')) return false;
    ids.add(set.set_id.trim());
    return true;
  })) return null;
  const id = chosenSet || (data.sets.length === 1 ? data.sets[0].set_id : '');
  const selected = data.sets.find((set: Obj) => set.set_id === id);
  const members = molds.filter(mold => mold.is_extension || mold.qolip_set_id === id);
  if (!selected?.ready || selected.blocking_reason_code || !members.length ||
      !molds.some(mold => mold.qolip_set_id === id && (!mold.is_extension || molds.every(entry => entry.is_extension))) ||
      members.some(mold => !mold.ready || mold.blocking_reason_code)) return null;
  return { method: 'automatic', set_id: id, fingerprint: selected.fingerprint, policy_revision: data.policy_revision };
}

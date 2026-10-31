type Obj = Record<string, any>;
export type QueueCursor = { epoch?: unknown; rev?: unknown };

/** Only a scoped, current server control can enable production actions. */
export function validOrderControl(bootstrap: Obj | null, apparatus: string, orderId: string, baseline: QueueCursor | null): boolean {
  const state = bootstrap?.control_state;
  const control = state?.control;
  if (bootstrap?.ok !== true || !state || state.apparatus !== apparatus || state.order_id !== orderId ||
      typeof state.epoch !== 'string' || !state.epoch || typeof state.scope !== 'string' || !state.scope ||
      !Number.isInteger(state.rev) || state.rev < 0 || !control || !control.interaction ||
      !Array.isArray(control.allowed_actions) || control.allowed_actions.some((action: unknown) => typeof action !== 'string') ||
      typeof control.state !== 'string' || typeof state.queue_state !== 'string' ||
      (state.queue_state && control.state.toLowerCase() !== state.queue_state.toLowerCase()) ||
      !['active', 'freeze_requested', 'frozen'].includes(state.order_control)) return false;
  const mode = control.interaction.mode;
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
  const hold = control.print_preflight;
  if (hold && ['held', 'running'].includes(hold.status) &&
      !(control.state === 'print_preflight' && ((mode === 'fresh_start_blocked' && !control.allowed_actions.length) ||
        (mode === 'freeze_requested' && control.allowed_actions.length === 1 && control.allowed_actions[0] === 'freeze')))) return false;
  if (state.order_control === 'frozen' && (control.interaction.mode !== 'frozen' || control.allowed_actions.length)) return false;
  if (state.order_control === 'active' && (control.state === 'frozen' || control.interaction.mode === 'frozen' ||
      control.stage_control_state === 'frozen')) return false;
  const freezeRequested = state.order_control === 'freeze_requested' || control.stage_control_state === 'freeze_requested';
  if (freezeRequested && control.interaction.mode === 'freeze_requested' && !control.freeze_request) return false;
  if (freezeRequested && control.interaction.mode !== 'freeze_requested' && control.allowed_actions.length) return false;
  if (!freezeRequested && control.interaction.mode === 'freeze_requested') return false;
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

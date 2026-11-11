type Mold = { qolip_set_id?: unknown; is_extension?: unknown; ready?: unknown; blocking_reason_code?: unknown };
type MoldSet = { set_id?: unknown; blocking_reason_code?: unknown };
type Input<T extends Mold> = {
  automatic: boolean; status?: string; requiredQolips: readonly T[]; scannedCodes: readonly string[];
  sets?: readonly MoldSet[]; selectedSetId?: string | null; confirmed?: boolean;
  validation?: { blocking_reason_code?: unknown } | null; readError?: string;
};
type Blocking = { key: string; message?: never; reason?: never; fallbackKey?: never } |
  { message: string; key?: never; reason?: never; fallbackKey?: never } |
  { reason: string; fallbackKey: string; key?: never; message?: never };
const code = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** @v2 _AutomaticQolipReadiness */
export function workerMoldPresentation<T extends Mold>(input: Input<T>) {
  const loading = input.status === 'loading', sets = input.sets ?? [], selected = input.selectedSetId || null;
  const molds = input.automatic && selected !== null
    ? input.requiredQolips.filter(mold => mold.is_extension === true || mold.qolip_set_id === selected)
    : input.requiredQolips;
  const setCount = input.automatic ? sets.length : new Set(input.requiredQolips
    .filter(mold => mold.is_extension !== true).map(mold => mold.qolip_set_id ?? '')).size;
  const alternatives = input.automatic ? setCount > 1 && selected === null : setCount > 1;
  const scannedCount = input.automatic
    ? molds.filter(mold => mold.ready === true && !loading && !code(mold.blocking_reason_code)).length
    : input.scannedCodes.length;
  const countKind = alternatives && (input.automatic || scannedCount === 0) ? 'sets'
    : !input.automatic && molds.length === 0 ? 'molds' : 'progress';
  const countNumber = countKind === 'sets' ? String(setCount) : countKind === 'molds' ? String(scannedCount)
    : `${scannedCount}/${molds.length}`;
  const titleKey = alternatives ? 'worker.mold.alternatives' : 'worker.molds';
  let blocking: Blocking | null = null;
  if (input.automatic && !input.confirmed) {
    if (loading) blocking = { key: 'qolip.start.auto.checking' };
    else if (input.readError) blocking = { message: input.readError };
    else if (!input.validation || input.status === 'error') blocking = { key: 'qolip.start.auto.unavailable' };
    else {
      const reason = code(input.validation.blocking_reason_code);
      if (input.requiredQolips.length === 0 && (!reason || reason === 'qolip_scan_required')) {
        blocking = { key: 'worker.mold.requirements.empty' };
      } else if (reason) blocking = { reason, fallbackKey: 'qolip.start.auto.blocked' };
      else if (selected === null || !sets.some(set => set.set_id === selected)) blocking = { key: 'qolip.start.auto.choose_set' };
      else blocking = { reason: code(sets.find(set => set.set_id === selected)?.blocking_reason_code), fallbackKey: 'qolip.start.auto.blocked' };
    }
  }
  const manualStatusKey = input.automatic || molds.length > 0 ? '' : loading ? 'worker.mold.requirements.loading'
    : input.readError ? '' : 'worker.mold.requirements.empty';
  return { molds, scannedCount, requiredCount: molds.length, setCount, alternatives, countKind, countNumber,
    titleKey, manualStatusKey, manualStatusText: !input.automatic && molds.length === 0 ? input.readError ?? '' : '',
    expandable: molds.length > 0, loading, blocking };
}

// Source productionErrorMessage switch, kept complete because the server reason is an open string.
const productionErrorKeys: Record<string, string> = {
  lamination_remainder_source_missing: 'worker.lamination_label.source_missing',
  lamination_remainder_source_ambiguous: 'worker.lamination_label.source_ambiguous',
  lamination_label_backend_required: 'worker.lamination_label.backend_required',
  qolip_confirmation_invalid: 'qolip.start.auto.unknown_state',
  qolip_automatic_confirmation_invalid: 'qolip.start.auto.unknown_state',
  qolip_automatic_confirmation_disabled: 'qolip.start.auto.settings_changed',
  qolip_policy_changed: 'qolip.start.auto.settings_changed',
  qolip_set_changed: 'qolip.start.auto.set_changed',
  qolip_automatic_confirmation_unavailable: 'qolip.start.auto.unavailable',
  apparatus_busy: 'worker.waiting.apparatus_busy',
  print_preflight_active: 'worker.waiting.print_preflight_active',
  print_preflight_other_order_active: 'worker.waiting.print_preflight_other_order_active',
  previous_stage_not_configured: 'worker.error.previous_stage_not_configured',
  wip_route_source_unresolved: 'worker.error.wip_route_source',
  wip_route_destination_unresolved: 'worker.error.wip_route_destination',
  wip_route_ambiguous: 'worker.error.wip_route_ambiguous',
  wip_route_changed: 'worker.error.wip_route_changed',
  progress_batch_not_found: 'worker.qr.not_found',
  progress_qr_not_found: 'worker.qr.not_found',
  progress_batch_not_accepted: 'worker.qr.not_accepted',
  progress_qr_invalid_response: 'worker.qr.invalid_response',
  progress_qr_validation_missing: 'worker.qr.invalid_response',
  raw_material_assignment_required: 'worker.error.incomplete_material_groups',
  material_deliverer_missing: 'worker.delivery.no_deliverers',
  material_deliverer_not_allowed: 'worker.delivery.deliverer_unavailable',
  material_delivery_location_missing: 'worker.delivery.location_missing',
  material_delivery_receipt_unconfirmed: 'worker.delivery.unconfirmed',
  material_delivery_candidates: 'worker.delivery.failed',
  material_delivery_receipt: 'worker.delivery.failed',
  raw_material_needs_cutting: 'worker.delivery.needs_cutting',
  raw_material_width_mismatch: 'worker.error.material_width_mismatch',
  waiting_sequence: 'worker.waiting.sequence',
  waiting_previous_stage: 'worker.waiting.previous_short',
  waiting_opening_wip: 'worker.waiting.opening_wip',
  order_frozen: 'worker.freeze.active',
  order_freeze_requested: 'worker.freeze.requested',
  qolip_scan_incomplete: 'worker.error.scan_molds',
  raw_material_rule_missing: 'worker.error.rule_failed',
  raw_material_rule_load_failed: 'worker.error.rule_failed',
  raw_materials_missing: 'worker.error.no_materials',
  raw_material_groups_incomplete: 'worker.error.incomplete_material_groups',
  raw_materials_not_at_apparatus: 'worker.error.material_not_at_machine',
  raw_material_scan_incomplete: 'worker.error.scan_all_materials',
  raw_material_group_scan_incomplete: 'worker.error.scan_required_materials',
  previous_stage_qr_required: 'worker.error.scan_previous',
  merge_input_required: 'worker.error.merge_input_required',
  merge_input_same: 'worker.error.merge_input_same',
  merge_input_already_used: 'worker.error.merge_input_already_used',
  merge_input_not_accepted: 'worker.error.merge_input_not_accepted',
  merge_input_frame_count_mismatch: 'worker.error.merge_input_frame_count_mismatch',
  rezka_frame_count_mismatch: 'worker.error.rezka_frame_count_mismatch',
  rezka_output_cycle_conflict: 'worker.rezka.print.sync_failed',
  progress_qr_reprint: 'worker.daily.reprint_failed',
  progress_batch_correction_reason_required: 'worker.daily.correction.required',
  progress_batch_correction_locked: 'worker.daily.correction_failed',
  progress_batch_correction_conflict: 'worker.daily.correction_failed',
  progress_batch_correction_unchanged: 'worker.daily.correction_failed',
  progress_batch_correction_failed: 'worker.daily.correction_failed',
  paddons_list: 'worker.paddon.load_failed',
  paddon_not_found: 'worker.paddon.not_found',
  paddon_create: 'worker.paddon.create_failed',
  paddon_delete: 'worker.paddon.delete_failed',
  paddon_delete_locked: 'worker.paddon.delete_locked',
  paddon_item_add: 'worker.paddon.add_failed',
  paddon_items_add: 'worker.paddon.add_failed',
  paddon_item_remove: 'worker.paddon.remove_failed',
  paddon_items_remove: 'worker.paddon.remove_failed',
  paddon_qr_print: 'worker.paddon.print_failed',
  paddon_locked: 'worker.paddon.locked_error',
  paddon_roll_kind_conflict: 'worker.paddon.peremotka_separate',
  active_paddon_required: 'worker.paddon.active.required',
  paddon_print_confirm: 'worker.paddon.print_confirm_failed',
  paddon_unlock: 'worker.paddon.unlock.failed',
  paddon_unlock_forbidden: 'worker.paddon.unlock.forbidden',
};

type ProductionText = (key: string, values?: Record<string, unknown>) => string;

/** @v2 AppLocalizations.productionErrorMessage */
export function workerMoldBlockingText(blocking: Blocking | null, p: ProductionText, reworkText: (key: string) => string): string {
  if (!blocking) return '';
  if (blocking.key !== undefined) return p(blocking.key);
  if (blocking.message !== undefined) return blocking.message;
  const reason = blocking.reason.trim().toLowerCase();
  if (reason === 'qolip_in_rework') return reworkText('order_unavailable');
  return p(Object.hasOwn(productionErrorKeys, reason) ? productionErrorKeys[reason] : blocking.fallbackKey);
}

/** @v2 _countUnitForKind */
export function workerMoldCountText(model: { countKind: string; countNumber: string; scannedCount: number; requiredCount: number; alternatives?: boolean }, locale: string, p: ProductionText): string {
  if (model.countKind === 'sets' || model.alternatives) return `${model.countNumber} ${p('worker.mold.set_unit')}`;
  if (model.countKind === 'progress') return p('worker.mold.progress', { scanned: model.scannedCount, required: model.requiredCount });
  const language = locale.toLowerCase().split(/[-_]/)[0];
  // Source derives the suffix from productionCount(0), including English plural for1.
  const unit = language === 'uz' ? 'ta' : language === 'ru' ? 'форм' : language === 'ur' ? 'مولڈز' : 'molds';
  return `${model.countNumber} ${unit}`;
}

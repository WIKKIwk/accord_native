import type { WorkerPaddonText, WorkerPaddon } from './workerPaddonModel';
import type { AdminApparatus } from './apparatusApi';
import { rezkaPaddonApparatusOrLocation } from './rezka/rezkaPaddonDisplay';

/** @v2 AppLocalizations.productionErrorMessage */
export function workerPaddonErrorText(error: unknown, p: WorkerPaddonText, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const keys: Record<string, string> = { paddons_list: 'worker.paddon.load_failed', paddon_not_found: 'worker.paddon.not_found',
    paddon_create: 'worker.paddon.create_failed', paddon_delete: 'worker.paddon.delete_failed', paddon_delete_locked: 'worker.paddon.delete_locked',
    paddon_item_add: 'worker.paddon.add_failed', paddon_items_add: 'worker.paddon.add_failed', paddon_item_remove: 'worker.paddon.remove_failed',
    paddon_items_remove: 'worker.paddon.remove_failed', paddon_qr_print: 'worker.paddon.print_failed', paddon_locked: 'worker.paddon.locked_error',
    paddon_roll_kind_conflict: 'worker.paddon.peremotka_separate', active_paddon_required: 'worker.paddon.active.required',
    paddon_print_confirm: 'worker.paddon.print_confirm_failed', paddon_unlock: 'worker.paddon.unlock.failed', paddon_unlock_forbidden: 'worker.paddon.unlock.forbidden',
    progress_batch_not_found: 'worker.qr.not_found', progress_qr_not_found: 'worker.qr.not_found', progress_batch_not_accepted: 'worker.qr.not_accepted',
    progress_qr_invalid_response: 'worker.qr.invalid_response', progress_qr_validation_missing: 'worker.qr.invalid_response' };
  return p(keys[code] ?? fallback);
}
export function workerPaddonLocation(paddon: WorkerPaddon, catalog: AdminApparatus[], unspecified: string) {
  return [...new Set([paddon.apparatus_id, paddon.location].map(value => rezkaPaddonApparatusOrLocation(value, catalog, unspecified)).filter(Boolean))].join(' • ');
}

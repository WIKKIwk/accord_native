import { extensionText, productionText } from '../shared/localization';
import { MobileApiException } from '../shared/mobileApiException';
import { trimDart } from './qolipApiCommon';

/** @v2 qolipErrorMessage */
export function qolipErrorMessage(error: unknown, locale: string, fallback = 'Amal bajarilmadi'): string {
  const code = error instanceof MobileApiException ? error.code : String(error);
  const special: Record<string, [string, string]> = {
    qolip_set_changed: ['qolipSharedSetText', 'changed'], qolip_set_ambiguous: ['qolipSharedSetText', 'ambiguous'],
    qolip_set_name_invalid: ['qolipManagementText', 'name_invalid'], qolip_set_name_conflict: ['qolipManagementText', 'name_conflict'],
    qolip_set_rename_failed: ['qolipManagementText', 'rename_failed'], qolip_in_rework: ['qolipReworkText', 'already_away'],
    session_scope_changed: ['qolipReworkText', 'session_changed'], qolip_rework_conflict: ['qolipReworkText', 'conflict'],
    qolip_rework_request_conflict: ['qolipReworkText', 'conflict'], color_required: ['qolipManagementText', 'color_required'],
  };
  if (special[code]) return extensionText(special[code][0], special[code][1], locale);
  const normalized = trimDart(code).toLowerCase();
  if (normalized === 'qolip_history_locked') return extensionText('qolipReworkText', 'history_locked', locale);
  const keys: Record<string, string> = {
    insufficient_stock: 'insufficient_stock', location_not_found: 'location_not_found', location_invalid: 'location_invalid',
    checkout_not_found: 'checkout_not_found', checkout_not_returnable: 'checkout_not_returnable',
    qolip_checkout_required: 'checkout_required', qolip_checkout_assigned_to_another_worker: 'assigned_to_another',
    worker_required: 'worker_required', worker_not_found: 'worker_not_found', quantity_required: 'quantity_required',
    location_identity_mismatch: 'location_identity_mismatch', qolip_in_use: 'in_use', qolip_code_conflict: 'code_conflict',
    panton_limit_exceeded: 'panton_limit', block_in_use: 'block_in_use', block_exists: 'block_exists',
    block_not_found: 'block_not_found', forbidden: 'forbidden', unauthorized: 'unauthorized',
  };
  const key = keys[normalized] ?? (code.includes('insufficient_stock') ? 'insufficient_stock'
    : code.includes('location_not_found') ? 'location_not_found' : '');
  if (key) return productionText(`qolip.error.${key}`, locale);
  if (normalized.includes('insufficient_stock')) return 'Joyda yetarli qolip qolmadi';
  if (normalized.includes('location_not_found')) return 'Qolip joyi topilmadi';
  return fallback;
}

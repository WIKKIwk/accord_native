import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { RawMaterialAssignmentDiagnostic } from '../shared/rawMaterialAssignmentApi';
import type { AssignmentLookup } from './materialAssignmentsController';
import { parseDartDateTime } from '../qolip/qolipApiCommon';

type Text = (key: string, values?: Record<string, unknown>) => string;
const millimeters = (value: number) => `${value.toFixed(1).replace(/\.0$/, '')} mm`;
/** @v2 _rawMaterialDiagnosticMessage */
export function materialDiagnosticMessage(diagnostic: RawMaterialAssignmentDiagnostic, t: Text) {
  const reason = diagnostic.reason.trim().toLowerCase(), actual = diagnostic.roll_width_mm;
  const minimum = diagnostic.minimum_width_mm ?? diagnostic.order_width_mm, maximum = diagnostic.maximum_width_mm;
  if (reason === 'raw_material_roll_size_mismatch' && actual !== null && minimum !== null && Number.isFinite(actual) && Number.isFinite(minimum)) {
    if (actual < minimum) return t('production.assignment.diagnostic_roll_too_narrow', { actual: millimeters(actual), min: millimeters(minimum) });
    if (maximum !== null && Number.isFinite(maximum)) return t('production.assignment.diagnostic_roll_too_wide',
      { actual: millimeters(actual), min: millimeters(minimum), max: millimeters(maximum) });
  }
  const keys: Record<string, string> = {
    raw_material_roll_size_missing: 'diagnostic_roll_size_missing', raw_material_stock_unavailable: 'diagnostic_stock_unavailable',
    raw_material_already_assigned_to_order: 'diagnostic_already_assigned_to_order', raw_material_order_not_active: 'diagnostic_order_not_active',
    no_compatible_active_order: 'diagnostic_order_not_active', raw_material_group_not_allowed: 'diagnostic_group_not_allowed',
    apparatus_not_assigned: 'apparatus_access_message',
  };
  if (reason === 'raw_material_already_assigned') return diagnostic.order_title.trim()
    ? t('production.assignment.diagnostic_already_assigned_named', { order: diagnostic.order_title.trim() })
    : t('production.assignment.diagnostic_already_assigned');
  if (Object.hasOwn(keys, reason)) return t(`production.assignment.${keys[reason]}`);
  return t('production.assignment.diagnostic_generic', { reason: diagnostic.reason.trim() ? diagnostic.reason : t('production.assignment.qr_not_found') });
}
/** @v2 _scannedRawMaterialOrderTitle */
export function materialScannedOrderTitle(detail: AssignmentLookup | null, assignment?: AdminRawMaterialAssignment | null) {
  const order = detail?.order;
  return order ? order.title.trim() || order.code.trim() || order.order_number.trim() || order.id.trim() || assignment?.order_id.trim() || ''
    : assignment?.order_id.trim() || '';
}
/** @v2 _scannedRawMaterialOrderLabel */
export function materialScannedOrderLabel(detail: AssignmentLookup | null, assignment?: AdminRawMaterialAssignment | null) {
  const order = detail?.order;
  if (!order) return assignment?.order_id.trim() || '';
  const code = order.code.trim() || order.order_number.trim() || order.id.trim(), title = order.title.trim();
  return !title || !code || code === title ? title || code : `${code} · ${title}`;
}
/** @v2 _scannedRawMaterialStatus */
export function materialScannedStatus(detail: AssignmentLookup, assignment: AdminRawMaterialAssignment) {
  if (assignment.consumed_qty > 0) return 'consumed';
  return assignment.stock_status.trim().toLowerCase() || detail.status.trim().toLowerCase();
}
/** @v2 _assignmentStockStatusLabel */
export function materialStockStatusLabel(raw: string, t: Text) {
  const labels: Record<string, string> = { available: 'raw_material.status_available', in_use: 'raw_material.status_in_use',
    reserved: 'label.reserved', consumed: 'raw_material.status_consumed' };
  const value = raw.trim().toLowerCase(), key = Object.hasOwn(labels, value) ? labels[value] : null;
  return key ? t(key) : raw.trim();
}
/** @v2 _scannedRawMaterialLockMessage */
export function materialScannedLockMessage(detail: AssignmentLookup, assignment: AdminRawMaterialAssignment, t: Text) {
  const status = materialScannedStatus(detail, assignment);
  if (!status || status === 'available') return '';
  const key = status === 'in_use' ? 'raw_material.unlink_blocked_in_use'
    : status === 'consumed' ? 'raw_material.unlink_blocked_consumed' : 'raw_material.unlink_blocked_generic';
  return t(key, { order: materialScannedOrderTitle(detail, assignment) });
}
/** @v2 _assignmentAssignee */
export const materialAssignmentAssignee = (row: AdminRawMaterialAssignment) => row.assigned_by_name.trim() || row.assigned_by_ref.trim();
/** @v2 _formatAssignmentTimestamp */
export function materialAssignmentTimestamp(raw: string) {
  const value = raw.trim(); if (!value) return '';
  const date = parseDartDateTime(value); if (!date) return value;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

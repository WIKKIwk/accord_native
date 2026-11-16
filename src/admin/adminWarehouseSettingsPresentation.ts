import { adminText } from '../shared/localization';
import type { AdminWarehouseSettingsDialog } from './adminWarehouseSettingsController';

/** @v2 _confirmWarehouseDeletion */
export function adminWarehouseSettingsDialogText(dialog: AdminWarehouseSettingsDialog, locale: string) {
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  if (dialog.kind === 'unassign') return { title: a('warehouse.unassign'), body: a('warehouse.unassign_confirm', { warehouse: dialog.warehouse, displayName: dialog.displayName }),
    warning: '', cancel: a('action.cancel'), confirm: a('action.delete'), destructive: false, vertical: false };
  const summary = dialog.summary;
  if (dialog.kind === 'blocked') return { title: a('warehouse.delete_blocked'), body: a('warehouse.delete_blocked_message', { warehouse: summary.warehouse, count: summary.reserved_count }),
    warning: '', cancel: '', confirm: a('action.close'), destructive: true, vertical: false };
  return { title: a('warehouse.delete_title'), body: a(summary.product_count > 0 ? 'warehouse.delete_products_warning' : 'warehouse.delete_confirmation', { warehouse: summary.warehouse, count: summary.product_count }),
    warning: summary.assignment_count > 0 ? a('warehouse.delete_assignments_warning', { count: summary.assignment_count }) : '',
    cancel: a('action.cancel'), confirm: a('action.delete'), destructive: true, vertical: true };
}

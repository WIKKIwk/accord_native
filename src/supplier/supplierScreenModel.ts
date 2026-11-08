import type { SupplierItem } from '../shared/catalogApi';
import type { DispatchRecord } from '../shared/notificationApi';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import { searchMatches } from '../shared/searchNormalizer';

export type SupplierCategory = 'pendingDispatches' | 'pendingUnannounced' | 'acceptedByWerka' | 'approvedUnannounced';
export function supplierStatusTitleKey(kind: 'pending' | 'submitted' | 'returned'): string {
  return kind === 'pending' ? 'pendingStatus' : kind === 'submitted' ? 'submittedStatus' : 'returnedStatus';
}
export function supplierCategoryTitleKey(category: SupplierCategory): string {
  switch (category) {
    case 'pendingDispatches': return 'supplierPendingDispatchesTitle';
    case 'pendingUnannounced': return 'supplierPendingUnannouncedTitle';
    case 'acceptedByWerka': return 'supplierAcceptedByWerkaTitle';
    case 'approvedUnannounced': return 'supplierAcceptedUnannouncedTitle';
  }
}

/** Product picker loads the full assignment and filters locally by name and code. */
export function supplierVisibleItems(items: readonly SupplierItem[], query: string): SupplierItem[] {
  const trimmed = trimNotificationText(query);
  return items.filter(item => searchMatches(trimmed, [item.name, item.code]));
}

/** V2's double.tryParse followed by qty <= 0; NaN deliberately passes the latter check. */
export function supplierQuantity(value: string): number | null {
  const input = trimNotificationText(value);
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(input)) return null;
  const qty = Number(input.replace(/^([+-])NaN$/, 'NaN'));
  return qty <= 0 ? null : qty;
}

export function supplierInitialQuantity(value: number | null | undefined): string {
  return value != null && value > 0 ? value.toFixed(0) : '';
}

export function supplierConfirmationRows(item: SupplierItem, qty: number): { label: string; value: string }[] {
  return [
    { label: 'Mahsulot', value: item.code },
    { label: 'Nomi', value: item.name },
    { label: 'Miqdor', value: `${qty.toFixed(2)} ${item.uom}` },
    ...(trimNotificationText(item.warehouse) ? [{ label: 'Ombor', value: item.warehouse }] : []),
  ];
}

export function supplierPendingItems(items: readonly DispatchRecord[]): DispatchRecord[] {
  return items.filter(item => item.status === 'pending' || item.status === 'draft');
}

export function supplierApprovedUnannounced(item: DispatchRecord): boolean {
  const note = trimNotificationText(item.note).toLowerCase();
  return item.event_type === 'werka_unannounced_approved' || note.startsWith('aytilmagan mahsulot tasdiqlandi')
    || note.startsWith('unannounced item approved');
}

export function supplierCategoryItems(items: readonly DispatchRecord[], category: SupplierCategory): DispatchRecord[] {
  switch (category) {
    case 'pendingDispatches': return supplierPendingItems(items).filter(item => item.event_type !== 'werka_unannounced_pending');
    case 'pendingUnannounced': return supplierPendingItems(items).filter(item => item.event_type === 'werka_unannounced_pending');
    case 'acceptedByWerka': return items.filter(item => item.status === 'accepted' && !supplierApprovedUnannounced(item));
    case 'approvedUnannounced': return items.filter(item => item.status === 'accepted' && supplierApprovedUnannounced(item));
  }
}

export function supplierRecentItem(record: DispatchRecord): SupplierItem {
  return { code: record.item_code, name: record.item_name, uom: record.uom, warehouse: '', item_group: '',
    requires_dimensions: false, order_apparatus_options: {}, order_microns: [], customer_names: [] };
}

export function supplierNotificationItems(items: readonly DispatchRecord[], hidden: ReadonlySet<string>,
  highlighted: ReadonlySet<string>): DispatchRecord[] {
  const visible = items.filter(item => !hidden.has(item.id));
  return [...visible.filter(item => highlighted.has(item.id)), ...visible.filter(item => !highlighted.has(item.id))];
}

export function supplierNotificationSecondary(record: DispatchRecord): string {
  return trimNotificationText(record.highlight) ? record.highlight : record.item_name;
}

export function supplierNotificationMetric(record: DispatchRecord): string {
  const sent = `${record.sent_qty.toFixed(0)} ${record.uom} jo‘natildi`;
  return record.accepted_qty > 0 ? `${sent} • ${record.accepted_qty.toFixed(0)} ${record.uom} qabul` : sent;
}

export function supplierNotificationStatusIcon(record: DispatchRecord): 'clock' | 'doneAll' | 'check' | 'close' | 'remove' {
  if (record.note.includes('Supplier tasdiqladi:') || record.note.includes('Tasdiqlayman, shu holat')) return 'doneAll';
  switch (record.status) {
    case 'draft': case 'pending': return 'clock';
    case 'accepted': return 'doneAll';
    case 'partial': return 'check';
    case 'rejected': return 'close';
    case 'cancelled': return 'remove';
  }
}

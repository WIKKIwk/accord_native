import { compareCreatedLabelsDesc, parseCreatedLabelTimestamp } from '../shared/dispatchRuntimeStores';
import type { DispatchRecord } from '../shared/notificationApi';
import type { WerkaStatusBreakdownEntry } from './werkaRecordApi';

function createdLabelIsAfter(candidate: string, current: string): boolean {
  const a = parseCreatedLabelTimestamp(candidate), b = parseCreatedLabelTimestamp(current);
  if (a != null && b != null) return a > b;
  if (a != null) return true;
  if (b != null) return false;
  return candidate > current;
}

/** Pending branch of @v2 WerkaStore.breakdownItems. */
export function werkaPendingBreakdown(items: readonly DispatchRecord[]): WerkaStatusBreakdownEntry[] {
  const grouped = new Map<string, WerkaStatusBreakdownEntry & { latestCreatedLabel: string }>();
  for (const item of items) {
    const ref = item.supplier_ref.trim(), key = ref || item.supplier_name.trim(), current = grouped.get(key);
    if (!current) {
      grouped.set(key, { supplierRef: item.supplier_ref, supplierName: item.supplier_name, uom: item.uom,
        receiptCount: 1, totalSentQty: item.sent_qty, totalAcceptedQty: 0, totalReturnedQty: 0, latestCreatedLabel: item.created_label });
      continue;
    }
    current.receiptCount++; current.totalSentQty += item.sent_qty;
    if (createdLabelIsAfter(item.created_label, current.latestCreatedLabel)) current.latestCreatedLabel = item.created_label;
    if (!current.supplierName.trim() && item.supplier_name.trim()) current.supplierName = item.supplier_name;
    if (!current.uom.trim() && item.uom.trim()) current.uom = item.uom;
  }
  return [...grouped.values()].sort((left, right) => compareCreatedLabelsDesc(left.latestCreatedLabel, right.latestCreatedLabel))
    .map(entry => ({ supplierRef: entry.supplierRef, supplierName: entry.supplierName, uom: entry.uom,
      receiptCount: entry.receiptCount, totalSentQty: entry.totalSentQty, totalAcceptedQty: 0, totalReturnedQty: 0 }));
}

/** Pending branch of @v2 WerkaStore.detailItems. */
export function werkaPendingDetailItems(items: readonly DispatchRecord[], supplierRef: string): DispatchRecord[] {
  const expected = supplierRef.trim();
  return items.filter(item => item.supplier_ref.trim() === expected);
}

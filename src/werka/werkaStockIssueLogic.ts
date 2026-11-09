import type { DispatchRecord } from '../shared/notificationApi';
import type { CustomerDirectoryEntry } from './werkaArchiveBatchQr';
import type { werkaCustomerIssueRecordFromJson } from './werkaIssueApi';
import type { stockEntryBarcodeEntryFromJson } from './werkaStockEntryApi';

type Entry = ReturnType<typeof stockEntryBarcodeEntryFromJson>;
type Issue = ReturnType<typeof werkaCustomerIssueRecordFromJson>;

/** @v2 _entryKey */
export function werkaStockEntryKey(entry: Entry): string {
  return `${entry.stockEntryName}|${entry.lineIndex}|${entry.barcode}`;
}
/** @v2 _docStatusLabel */
export function werkaStockDocStatusLabel(value: number): string {
  return value === 0 ? 'Draft' : value === 1 ? 'Submitted' : value === 2 ? 'Cancelled' : `Doc ${value}`;
}
/** @v2 _warehouseText */
export function werkaStockWarehouseText(source: string, target: string): string {
  return `${source.trim() || '—'} → ${target.trim() || '—'}`;
}

/** Button enable condition in _LookupEntryPanelState._canCreateCustomerIssue. */
export function canCreateWerkaStockIssue(entry: Entry, customer: CustomerDirectoryEntry | null, submitting: boolean): boolean {
  return !!entry.itemCode.trim() && entry.qty > 0 && customer !== null && !submitting;
}

/** Payload preparation and validation from WerkaStockEntryLookupScreen._createCustomerIssueFromEntry. */
export function werkaStockIssueInput(entry: Entry, customer: CustomerDirectoryEntry, scannedBarcode: string) {
  const itemCode = entry.itemCode.trim();
  if (!itemCode || entry.qty <= 0 || !customer.ref.trim()) return null;
  return { customerRef: customer.ref, itemCode, qty: entry.qty,
    sourceBarcode: entry.barcode.trim() ? entry.barcode : scannedBarcode,
    sourceStockEntryName: entry.stockEntryName, sourceLineIndex: entry.lineIndex };
}

/** DispatchRecord construction after a successful QR-sourced customer issue. */
export function werkaStockIssueDispatch(issue: Issue): DispatchRecord {
  return { id: issue.entryID, record_type: '', supplier_ref: issue.customerRef, supplier_name: issue.customerName,
    item_code: issue.itemCode, item_name: issue.itemName, uom: issue.uom, sent_qty: issue.qty, accepted_qty: 0,
    amount: 0, currency: '', note: '', event_type: 'customer_issue_pending', highlight: '', status: 'pending',
    created_label: issue.createdLabel };
}

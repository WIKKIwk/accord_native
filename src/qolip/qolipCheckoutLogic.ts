import { parseDartDateTime, trimDart } from './qolipApiCommon';
import { normalizeQolipCellLabel } from './qolipCellPickerLogic';
import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { QolipSearchDocument, QolipSearchQuery } from './qolipSearchEngine';

const documents = new WeakMap<QolipCheckoutEntry, QolipSearchDocument>();
let lastQuery: string | null = null, preparedQuery: QolipSearchQuery | null = null;

/** @v2 qolipCheckoutSearchDocument */
export function qolipCheckoutSearchDocument(checkout: QolipCheckoutEntry): QolipSearchDocument {
  let document = documents.get(checkout);
  if (!document) {
    document = new QolipSearchDocument([checkout.issued_to_name, checkout.item_name, checkout.item_code, checkout.qolip_code,
      checkout.block, checkout.warehouse, checkout.location_label, String(checkout.size)]);
    documents.set(checkout, document);
  }
  return document;
}

/** @v2 qolipCheckoutSearchMatches */
export function qolipCheckoutSearchMatches(query: string, checkout: QolipCheckoutEntry): boolean {
  if (!trimDart(query)) return true;
  if (lastQuery !== query || !preparedQuery) { lastQuery = query; preparedQuery = new QolipSearchQuery(query); }
  return preparedQuery.matches(qolipCheckoutSearchDocument(checkout));
}

export function qolipFilterCheckouts(entries: readonly QolipCheckoutEntry[], query: string): readonly QolipCheckoutEntry[] {
  return query === '' ? entries : entries.filter(entry => qolipCheckoutSearchMatches(query, entry));
}

/** Source's row/column candidate takes precedence, then its location label. */
export function qolipKnownReturnCell(checkout: QolipCheckoutEntry): string | null {
  const row = trimDart(checkout.row_letter);
  if (row && checkout.column_number !== null) {
    const cell = normalizeQolipCellLabel(`${row}${checkout.column_number}`);
    if (cell !== null) return cell;
  }
  return normalizeQolipCellLabel(checkout.location_label);
}

/** Checkout ledger display uses local day/month and time; invalid dates remain raw. */
export function qolipCheckoutIssuedAt(raw: string): string {
  const date = parseDartDateTime(raw);
  if (!date) return raw;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function qolipCheckoutRowText(checkout: QolipCheckoutEntry, unknownWorker: string): { title: string; subtitle: string } {
  const itemName = trimDart(checkout.item_name), worker = trimDart(checkout.issued_to_name);
  const location = checkout.location_label !== '' ? checkout.location_label : checkout.block;
  return { title: itemName || checkout.item_code,
    subtitle: [worker || unknownWorker, location, checkout.qolip_code, String(checkout.size), qolipCheckoutIssuedAt(checkout.issued_at)]
      .filter(value => !!trimDart(value)).join(' • ') };
}

export type QolipCheckoutDetailKey = 'issued_to' | 'product' | 'item_code' | 'mold_code' | 'size' | 'quantity' | 'block' | 'cell' | 'warehouse' | 'issued_at';
export function qolipCheckoutDetailLines(checkout: QolipCheckoutEntry, quantity: string): { key: QolipCheckoutDetailKey; value: string }[] {
  const location = checkout.location_label !== '' ? checkout.location_label : checkout.block;
  const lines: { key: QolipCheckoutDetailKey; value: string }[] = [
    { key: 'issued_to', value: checkout.issued_to_name }, { key: 'product', value: checkout.item_name },
    { key: 'item_code', value: checkout.item_code }, { key: 'mold_code', value: checkout.qolip_code },
    { key: 'size', value: String(checkout.size) }, { key: 'quantity', value: quantity }, { key: 'block', value: checkout.block },
    { key: 'cell', value: location }, { key: 'warehouse', value: checkout.warehouse }, { key: 'issued_at', value: qolipCheckoutIssuedAt(checkout.issued_at) },
  ];
  return lines.map(line => ({ ...line, value: trimDart(line.value) })).filter(line => !!line.value);
}

/** Retain source IDs after reload, and derive bulk order from loaded entries rather than selection order. */
export function qolipCheckoutSelection(entries: readonly QolipCheckoutEntry[], selectedIds: ReadonlySet<string>) {
  const available = new Set(entries.map(entry => entry.id));
  const retained = new Set([...selectedIds].filter(id => available.has(id)));
  return { retained, selected: entries.filter(entry => retained.has(entry.id)) };
}

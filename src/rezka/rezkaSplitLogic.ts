import type { RezkaSource, RezkaOutputRequest } from './rezkaSplitApi';

export type RezkaDraft = { item_code: string; item_name: string; qty: string; uom: string; warehouse: string; reason: string; print_qr: boolean };
/** @v2 _RezkaOutputDraft.fromSource */
export function draftFromSource(source: RezkaSource): RezkaDraft {
  return { item_code: '', item_name: '', qty: '', uom: source.uom.trim() ? source.uom : 'kg', warehouse: source.warehouse, reason: '', print_qr: true };
}
/** @v2 _extractLookupBarcode */
export function extractRezkaBarcode(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const uri = new URL(value);
    if ((uri.protocol === 'http:' || uri.protocol === 'https:') && uri.pathname.replace(/^\//, '').length > 0) {
      const query = (uri.searchParams.getAll('barcode').at(-1) ?? uri.searchParams.getAll('epc').at(-1) ?? '').trim();
      if (query) return query;
      const segments = uri.pathname.split('/').map(segment => decodeURIComponent(segment)).filter(segment => !!segment.trim());
      if (!segments.length || segments[0].trim().toUpperCase() === 'A') return null;
      return segments[segments.length - 1].trim();
    }
  } catch { /* A non-URL QR value remains a plain barcode. */ }
  return value.includes('/A/') ? null : value;
}
/** @v2 _validateOutputTotal */
export function rezkaOutputTotal(source: RezkaSource, quantities: readonly number[]): { total: number; difference: number; kind: 'equal' | 'remainder' | 'excess' } {
  const total = quantities.reduce((sum, qty) => sum + qty, 0), difference = source.qty - total;
  return { total, difference, kind: Math.abs(difference) <= 0.0001 ? 'equal' : difference > 0 ? 'remainder' : 'excess' };
}
/** @v2 _addRemainderOutput */
export function remainderDraft(source: RezkaSource, remainder: number, scrap: boolean): RezkaDraft {
  const draft = draftFromSource(source);
  draft.qty = formatRezkaQty(remainder);
  if (scrap) Object.assign(draft, { item_code: source.item_code, item_name: source.item_name, print_qr: false,
    warehouse: 'brak - ombori - A', reason: 'Atxot / brak mahsulot' });
  return draft;
}
export function formatRezkaQty(value: number): string { return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3); }
function parseQty(value: string): number {
  const input = value.trim();
  return /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(input) ? Number(input) : 0;
}
/** @v2 _submit */
export function buildRezkaOutputs(source: RezkaSource, drafts: readonly RezkaDraft[]): RezkaOutputRequest[] | null {
  const result: RezkaOutputRequest[] = [];
  for (const draft of drafts) {
    const qty = parseQty(draft.qty);
    const itemCode = !draft.item_code.trim() && !draft.print_qr ? source.item_code : draft.item_code;
    const itemName = !draft.item_name.trim() && !draft.print_qr ? source.item_name : draft.item_name;
    if ((draft.print_qr && !itemCode.trim()) || qty <= 0 || !draft.warehouse.trim()) return null;
    result.push({ item_code: itemCode, item_name: itemName, qty, uom: draft.uom.trim() || source.uom,
      target_warehouse: draft.warehouse.trim(), reason: draft.reason, print_qr: draft.print_qr });
  }
  return result;
}

import type { AdminApparatus } from '../apparatusApi';

type PaddonBatchDisplay = { order_id: string; label_item_name: string; payload_json: Record<string, unknown> };

// V2 calls toString on payload values. JSON collections have Dart-style
// delimiters; JSON number spelling is not retained by JavaScript's decoder.
function dartJsonString(value: unknown): string {
  if (value == null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartJsonString).join(', ')}]`;
  if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${key}: ${dartJsonString(item)}`).join(', ')}}`;
  return String(value);
}
function payloadText(value: unknown): string { return value == null ? '' : dartJsonString(value).trim(); }

/** @v2 AparatchiPaddonDisplay */
export function rezkaPaddonOrderSummary(batch: PaddonBatchDisplay): string {
  const payloadNumber = payloadText(batch.payload_json.order_number), orderId = batch.order_id.trim();
  const number = payloadNumber || /^zakaz-(\d+)$/.exec(orderId)?.[1] || (/^\d+$/.test(orderId) ? orderId : '—');
  const payloadTitle = payloadText(batch.payload_json.order_title);
  const title = payloadTitle || batch.label_item_name.split(/,\s*apparat:/i)[0]
    .replace(/\s+(?:yarim tayyor(?: mahsulot)?|tayyor mahsulot)\s*$/i, '').trim();
  return `${number} - ${title || '—'}`;
}

/** Replaces canonical apparatus references for display only; identities are never changed. */
export function rezkaPaddonApparatusOrLocation(value: string, catalog: readonly AdminApparatus[], unspecified: string): string {
  const name = (id: string) => {
    for (const row of catalog) {
      if (row.id.trim() === id || row.physical_asset_id.trim() === id || row.work_unit_id.trim() === id) {
        const label = row.name.trim();
        if (label && !label.includes('apparatus:')) return label;
      }
    }
    return unspecified;
  };
  return value.trim().replace(/apparatus:[a-zA-Z0-9_.:-]+/gi, match => name(match));
}

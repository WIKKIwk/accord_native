import { localizedMethod } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';
import type { WerkaArchiveKind, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaDeliveryQuantity } from './werkaDeliveryPresentation';

type ArchiveData = ReturnType<typeof werkaArchiveResponseFromJson>;
export type WerkaArchiveListContentProps = { kind: WerkaArchiveKind; data: ArchiveData | null; loading: boolean; error: unknown | null;
  locale: string; onRefresh: () => Promise<void> };
/** Source's loose Paddon identity extraction; actual Paddon route remains held. */
export function werkaArchivePaddonCode(item: DispatchRecord): string {
  const ref = item.supplier_ref.trim();
  if (ref.toLowerCase().startsWith('paddon:')) { const code = ref.slice(7).trim(); if (code) return code; }
  const id = item.id.trim();
  if (id.toLowerCase().startsWith('paddon:')) { const rest = id.slice(7), sep = rest.indexOf(':');
    const code = (sep < 0 ? rest : rest.slice(0, sep)).trim(); if (code) return code; }
  const name = item.supplier_name.trim();
  if (name.toLowerCase().startsWith('paddon')) { const tail = name.slice(6).trim(), sep = tail.indexOf('•');
    const code = (sep < 0 ? tail : tail.slice(0, sep)).trim(); if (code) return code; }
  return '';
}
export function werkaArchivePaddonWarehouse(item: DispatchRecord): string {
  if (item.highlight.trim()) return item.highlight.trim();
  const name = item.supplier_name.trim(), sep = name.indexOf('•');
  return sep < 0 ? '' : name.slice(sep + 1).trim();
}
function metric(item: DispatchRecord, kind: WerkaArchiveKind): string {
  const qty = kind === 'received' ? (item.accepted_qty > 0 ? item.accepted_qty : item.sent_qty)
    : kind === 'returned' ? Math.max(0, item.sent_qty - item.accepted_qty) : item.sent_qty;
  return `${werkaDeliveryQuantity(qty)} ${item.uom}`;
}
export function werkaArchiveGroups(items: readonly DispatchRecord[], kind: WerkaArchiveKind) {
  const groups = new Map<string, DispatchRecord[]>();
  for (const item of items) {
    const code = werkaArchivePaddonCode(item), key = code ? `paddon:${code}` : `single:${item.id}`;
    const group = groups.get(key); if (group) group.push(item); else groups.set(key, [item]);
  }
  return [...groups].map(([key, lines]) => {
    const first = lines[0], code = werkaArchivePaddonCode(first), warehouse = werkaArchivePaddonWarehouse(first);
    return { key, code, title: code ? `Paddon ${code}` : first.supplier_name.trim() || first.item_name.trim() || first.item_code.trim(),
      subtitle: code ? warehouse : `${first.item_code} • ${first.item_name}`,
      trailing: code ? `${lines.length} ta rulon` : metric(first, kind) };
  });
}
export function werkaArchiveSummary(data: ArchiveData, locale: string) {
  return { count: localizedMethod('archiveRecordCountLabel', locale, { count: data.summary.recordCount }),
    totals: data.summary.totalsByUOM.map(total => `${werkaDeliveryQuantity(total.qty)} ${total.uom}`) };
}

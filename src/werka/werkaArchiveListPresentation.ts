import { localizedMethod } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';
import type { WerkaArchiveKind, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaDeliveryQuantity } from './werkaDeliveryPresentation';
import { werkaDartTrim } from './werkaBatchTrim';
import type { ReactNode } from 'react';

type ArchiveData = ReturnType<typeof werkaArchiveResponseFromJson>;
/** Supply only for a daily list. Calendar selection/loading remains the guarded owner's responsibility. */
export type WerkaArchiveListDailyFilter = {
  selectedDateLabel: string;
  calendarOpen: boolean;
  /** Keep the child type/key stable and pass enabled to its own callbacks. */
  renderCalendar: (enabled: boolean) => ReactNode;
  onToggle: () => void;
};
export type WerkaArchiveListContentProps = { kind: WerkaArchiveKind; data: ArchiveData | null; loading: boolean; error: unknown | null;
  locale: string; onRefresh: () => Promise<void>; dailyFilter?: WerkaArchiveListDailyFilter };
/** Source's loose Paddon identity extraction; actual Paddon route remains held. */
export function werkaArchivePaddonCode(item: DispatchRecord): string {
  const ref = werkaDartTrim(item.supplier_ref);
  if (ref.toLowerCase().startsWith('paddon:')) { const code = werkaDartTrim(ref.slice(7)); if (code) return code; }
  const id = werkaDartTrim(item.id);
  if (id.toLowerCase().startsWith('paddon:')) { const rest = id.slice(7), sep = rest.indexOf(':');
    const code = werkaDartTrim(sep < 0 ? rest : rest.slice(0, sep)); if (code) return code; }
  const name = werkaDartTrim(item.supplier_name);
  if (name.toLowerCase().startsWith('paddon')) { const tail = werkaDartTrim(name.slice(6)), sep = tail.indexOf('•');
    const code = werkaDartTrim(sep < 0 ? tail : tail.slice(0, sep)); if (code) return code; }
  return '';
}
export function werkaArchivePaddonWarehouse(item: DispatchRecord): string {
  if (werkaDartTrim(item.highlight)) return werkaDartTrim(item.highlight);
  const name = werkaDartTrim(item.supplier_name), sep = name.indexOf('•');
  return sep < 0 ? '' : werkaDartTrim(name.slice(sep + 1));
}
function metric(item: DispatchRecord, kind: WerkaArchiveKind): string {
  let qty: number;
  if (kind === 'received') qty = item.accepted_qty > 0 ? item.accepted_qty : item.sent_qty;
  else if (kind === 'returned') {
    const difference = item.sent_qty - item.accepted_qty;
    // Dart double.clamp orders NaN above +Infinity, unlike Math.max.
    qty = Number.isNaN(difference) ? Infinity : Math.max(0, difference);
  } else qty = item.sent_qty;
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
    return { key, code, title: code ? `Paddon ${code}` : werkaDartTrim(first.supplier_name) || werkaDartTrim(first.item_name) || werkaDartTrim(first.item_code),
      subtitle: code ? warehouse : `${first.item_code} • ${first.item_name}`,
      trailing: code ? `${lines.length} ta rulon` : metric(first, kind) };
  });
}
export function werkaArchiveSummary(data: ArchiveData, locale: string) {
  return { count: localizedMethod('archiveRecordCountLabel', locale, { count: data.summary.recordCount }),
    totals: data.summary.totalsByUOM.map(total => `${werkaDeliveryQuantity(total.qty)} ${total.uom}`) };
}

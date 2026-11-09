import type { DispatchRecord } from '../shared/notificationApi';
import { adminActivityMetricLine, adminActivityViewState, adminActivityVisibleItems } from './adminActivityModel';
import type { AdminActivityScreenProps } from './adminActivityScreenTypes';
import { adminActivitySymbol } from './adminActivitySymbols';
import { dartTrim } from './dartJsonString';

export type AdminActivityRow = { id: string; title: string; subtitle: string; value: string | null; icon: ReturnType<typeof adminActivitySymbol> };
function activityRow(item: DispatchRecord, locale: string): AdminActivityRow {
  return { id: item.id, title: item.supplier_name, subtitle: adminActivityMetricLine(item, locale),
    value: dartTrim(item.created_label) ? item.created_label : null, icon: adminActivitySymbol(item.status) };
}
/** Shared presentation projection, preserving source order and static-row behavior. */
export function adminActivityScreenModel(snapshot: AdminActivityScreenProps['snapshot'], hiddenIds: ReadonlySet<string>, locale: string) {
  return { view: adminActivityViewState(snapshot, hiddenIds), rows: adminActivityVisibleItems(snapshot.activityItems, hiddenIds).map(item => activityRow(item, locale)) };
}

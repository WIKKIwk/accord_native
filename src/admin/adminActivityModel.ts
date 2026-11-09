import type { DispatchRecord } from '../shared/notificationApi';
import { adminText } from '../shared/localization';
import type { AdminStoreSnapshot } from './adminStore';

// The V2 activity view filters by the per-profile hidden-ID set.
export function adminActivityVisibleItems(items: readonly DispatchRecord[], hiddenIds: ReadonlySet<string>): DispatchRecord[] {
  return items.filter(item => !hiddenIds.has(item.id));
}
/** @v2 _AdminActivityScreenState.build */
export function adminActivityViewState(store: Pick<AdminStoreSnapshot, 'loadingActivity' | 'loadedActivity' | 'activityError' | 'activityItems'>,
  hiddenIds: ReadonlySet<string>): 'loading' | 'error' | 'empty' | 'list' {
  const items = adminActivityVisibleItems(store.activityItems, hiddenIds);
  if (store.loadingActivity && !store.loadedActivity && !items.length) return 'loading';
  if (store.activityError != null && !store.loadedActivity && !items.length) return 'error';
  return items.length ? 'list' : 'empty';
}
/** @v2 _AdminActivityScreenState._clearAll */
export function adminActivityClearIds(items: readonly DispatchRecord[]): string[] { return items.map(item => item.id); }
/** @v2 _AdminActivityScreenState._handlePushRefresh */
export function adminActivityShouldRefresh(topic: string, version: number, lastVersion: number): boolean {
  return topic === 'admin' && version !== lastVersion;
}
/** @v2 _ActivityStatusBadge.icon */
export function adminActivityStatusIcon(status: DispatchRecord['status']): string {
  switch (status) {
    case 'draft': return 'schedule_rounded';
    case 'pending': return 'schedule_outlined';
    case 'accepted': return 'done_all_rounded';
    case 'partial': return 'check_rounded';
    case 'rejected': return 'close_rounded';
    case 'cancelled': return 'remove_rounded';
  }
}
/** @v2 _AdminActivityCard._metricLine */
export function adminActivityMetricLine(item: Pick<DispatchRecord, 'sent_qty' | 'accepted_qty' | 'uom'>, locale: string): string {
  const fixed = (value: number) => Object.is(value, -0) ? '-0' : value.toFixed(0);
  const sent = adminText('activity.sent', locale, { quantity: fixed(item.sent_qty), uom: item.uom });
  return item.accepted_qty > 0 ? adminText('activity.accepted', locale,
    { sent, quantity: fixed(item.accepted_qty), uom: item.uom }) : sent;
}

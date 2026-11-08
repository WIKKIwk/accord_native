import { Host, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import type { SupplierCategory } from './supplierScreenModel';
import { supplierCategoryItems, supplierCategoryTitleKey, supplierPendingItems, supplierRecentItem, supplierStatusTitleKey } from './supplierScreenModel';
import type { SupplierBreakdownProps, SupplierCategoryProps, SupplierHomeProps, SupplierRecentProps, SupplierStatusDetailProps } from './supplierOverviewTypes';
import { useSupplierBreakdown, useSupplierCategory, useSupplierRootRefresh, useSupplierStatusDetail, useSupplierStore, useSupplierText } from './useSupplierOverview';

function Page({ title, subtitle, onAction, menu, footer, refresh, refreshing, children }: { title: string; subtitle?: string; onAction: () => void;
  menu?: boolean; footer?: ReactNode; refresh?: () => Promise<void>; refreshing?: boolean; children: ReactNode }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), { t } = useSupplierText();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={title} subtitle={subtitle} navigation={{ icon: menu ? 'menu' : 'back', label: t(menu ? 'Menyu' : 'Orqaga'), onPress: onAction }} />
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 2 }}
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={() => { void refresh(); }} /> : undefined}>{children}</ScrollView>
    {footer}
  </View>;
}
function Retry({ onRetry }: { onRetry: () => void }) {
  const { l } = useSupplierText();
  return <View style={{ padding: 24, gap: 16 }}><PreparationText>{l('serverDisconnectedRetry')}</PreparationText>
    <Host matchContents={{ vertical: true }}><TextButton onClick={onRetry}><Text>{l('retry')}</Text></TextButton></Host></View>;
}
function Loading() { return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>; }

// @v2 SupplierHomeScreen
export function SupplierHomeScreen(props: SupplierHomeProps) {
  const store = useSupplierStore(props.store), { l } = useSupplierText();
  useSupplierRootRefresh(store, 'home');
  const pending = supplierPendingItems(store.historyItems), summary = store.summary;
  const loading = !store.loadedHistory && !store.historyError, failed = !store.loadedHistory && store.historyError != null;
  return <Page title={l('supplierRoleName')} onAction={props.onOpenDrawer} menu footer={props.footer}
    refresh={!loading ? () => store.refreshAll() : undefined} refreshing={store.loadingHistory || store.loadingSummary}>
    {loading ? <Loading /> : failed ? <Retry onRetry={() => { void store.refreshAll(); }} /> : <>
      {(['pending', 'submitted', 'returned'] as const).map(kind => <PreparationRow key={kind}
        title={l(supplierStatusTitleKey(kind))} subtitle={String(kind === 'pending' ? summary.pendingCount
          : kind === 'submitted' ? summary.submittedCount : summary.returnedCount)} onPress={() => props.onStatus(kind)} />)}
      {pending.length > 0 && <><PreparationText title>{l('inProgressItemsTitle')}</PreparationText>
        {pending.map((record, index) => <PreparationRow key={`${record.id}:${index}`} title={record.item_name}
          subtitle={`${record.item_code}\n${record.sent_qty.toFixed(0)} ${record.uom}\n${record.created_label}`} onPress={() => props.onReceipt(record.id)} />)}</>}
    </>}
  </Page>;
}

// @v2 SupplierRecentScreen
export function SupplierRecentScreen(props: SupplierRecentProps) {
  const store = useSupplierStore(props.store), { l } = useSupplierText();
  useSupplierRootRefresh(store, 'history');
  const loading = !store.loadedHistory && !store.historyError, failed = !store.loadedHistory && store.historyError != null;
  return <Page title={l('recentTitle')} subtitle={l('recentSubtitle')} onAction={props.onOpenDrawer} menu footer={props.footer}
    refresh={failed || store.historyItems.length > 0 ? () => store.refreshHistory() : undefined} refreshing={store.loadingHistory}>
    {loading ? <Loading /> : failed ? <Retry onRetry={() => { void store.refreshHistory(); }} /> : !store.historyItems.length
      ? <PreparationText>{l('noSupplierShipmentsYet')}</PreparationText> : store.historyItems.map((record, index) => {
        const amount = record.amount > 0 ? `\n${trimNotificationText(`${record.amount.toFixed(0)} ${record.currency}`)}` : '';
        return <PreparationRow key={`${record.id}:${index}`} title={trimNotificationText(record.item_name) ? record.item_name : record.item_code}
          subtitle={`${record.sent_qty.toFixed(0)} ${record.uom}${amount}\n${record.created_label}`}
          onPress={() => props.onRepeat(supplierRecentItem(record), record.sent_qty)} />;
      })}
  </Page>;
}

// @v2 SupplierStatusBreakdownScreen
export function SupplierStatusBreakdownScreen(props: SupplierBreakdownProps) {
  const store = useSupplierStore(props.store), { l, lm, t } = useSupplierText(), ready = useSupplierBreakdown(store, props.kind);
  const grouped = props.kind === 'pending' || props.kind === 'submitted';
  const categories: SupplierCategory[] = props.kind === 'pending' ? ['pendingDispatches', 'pendingUnannounced'] : ['acceptedByWerka', 'approvedUnannounced'];
  const items = store.breakdownItems(props.kind), error = grouped ? store.historyError : store.breakdownError(props.kind);
  const waiting = !ready || (grouped ? store.loadingHistory && !store.loadedHistory : store.loadingBreakdown(props.kind) && !items.length);
  const failed = grouped ? !!error && !store.loadedHistory : !!error && !items.length;
  const reload = () => grouped ? store.refreshHistory() : store.refreshBreakdown(props.kind);
  return <Page title={l(supplierStatusTitleKey(props.kind))} onAction={props.onBack} footer={props.footer}
    refresh={!waiting && !failed && (grouped || items.length > 0) ? reload : undefined}
    refreshing={grouped ? store.loadingHistory : store.loadingBreakdown(props.kind)}>
    {waiting ? <Loading /> : failed ? <PreparationText>{t(String(error))}</PreparationText> : grouped
      ? categories.map(category => <PreparationRow key={category} title={l(supplierCategoryTitleKey(category))}
        subtitle={String(supplierCategoryItems(store.historyItems, category).length)} onPress={() => props.onCategory(category)} />)
      : !items.length ? <PreparationText>{l('noStatusRecords')}</PreparationText> : items.map((item, index) =>
        <PreparationRow key={`${item.item_code}:${index}`} title={item.item_name} subtitle={`${lm('sentQtyStatus', { qty: item.total_returned_qty,
          uom: item.uom, statusWord: l('returnedStatus').toLowerCase() })}\n${lm('receiptCountLabel', { count: item.receipt_count })}`}
          onPress={() => props.onDetail(props.kind, item.item_code, item.item_name)} />)}
  </Page>;
}

// @v2 SupplierSubmittedCategoryDetailScreen
export function SupplierSubmittedCategoryDetailScreen(props: SupplierCategoryProps) {
  const store = useSupplierStore(props.store), { l, t } = useSupplierText();
  useSupplierCategory(store);
  const items = supplierCategoryItems(store.historyItems, props.category);
  const loading = !store.loadedHistory && !store.historyError, failed = !store.loadedHistory && store.historyError != null;
  return <Page title={l(supplierCategoryTitleKey(props.category))} onAction={props.onBack} footer={props.footer}
    refresh={!loading && !failed && items.length ? () => store.refreshHistory() : undefined} refreshing={store.loadingHistory}>
    {loading ? <Loading /> : failed ? <PreparationText>{t(String(store.historyError))}</PreparationText>
      : !items.length ? <PreparationText>{l('noRecordsYet')}</PreparationText> : items.map((record, index) =>
        <PreparationRow key={`${record.id}:${index}`} title={`${record.sent_qty.toFixed(0)} ${record.uom}`}
          subtitle={`${record.created_label}${trimNotificationText(record.note) ? `\n${record.note}` : ''}`}
          onPress={() => props.onReceipt(record.id)} />)}
  </Page>;
}

// @v2 SupplierStatusDetailScreen
export function SupplierStatusDetailScreen(props: SupplierStatusDetailProps) {
  const store = useSupplierStore(props.store), { l, lm, t } = useSupplierText();
  const ready = useSupplierStatusDetail(store, props.kind, props.itemCode), items = store.detailItems(props.kind, props.itemCode);
  const error = store.detailError(props.kind, props.itemCode), waiting = !ready || (store.loadingDetail(props.kind, props.itemCode) && !items.length);
  return <Page title={props.itemName} onAction={props.onBack} footer={props.footer}
    refresh={!waiting && items.length ? () => store.refreshDetail(props.kind, props.itemCode) : undefined}
    refreshing={store.loadingDetail(props.kind, props.itemCode)}>
    {waiting ? <Loading /> : error != null && !items.length ? <PreparationText>{t(String(error))}</PreparationText>
      : !items.length ? <PreparationText>{l('noSupplierReceiptsYet')}</PreparationText> : items.map((record, index) => {
        const accepted = record.accepted_qty > 0 ? `\n${lm('acceptedQtyLabel', { qty: record.accepted_qty, uom: record.uom })}` : '';
        const note = trimNotificationText(record.note) ? `\n${record.note}` : '';
        return <PreparationRow key={`${record.id}:${index}`} title={`${record.sent_qty.toFixed(0)} ${record.uom}`}
          subtitle={`${record.created_label}${accepted}${note}`} onPress={() => props.onReceipt(record.id)} />;
      })}
  </Page>;
}

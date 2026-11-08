import { Button, HStack, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { PlatformColor, Text as NativeText, View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import type { SupplierCategory } from './supplierScreenModel';
import { supplierCategoryItems, supplierCategoryTitleKey, supplierPendingItems, supplierRecentItem, supplierStatusTitleKey } from './supplierScreenModel';
import type { SupplierBreakdownProps, SupplierCategoryProps, SupplierHomeProps, SupplierRecentProps, SupplierStatusDetailProps } from './supplierOverviewTypes';
import { useSupplierBreakdown, useSupplierCategory, useSupplierRootRefresh, useSupplierStatusDetail, useSupplierStore, useSupplierText } from './useSupplierOverview';

function Header({ title, subtitle, onAction, menu = false }: { title: string; subtitle?: string; onAction: () => void; menu?: boolean }) {
  const { t } = useSupplierText();
  return <Stack.Screen options={{ title, headerLeft: () => <RoleHeaderButton icon={menu ? 'menu' : 'back'}
    label={t(menu ? 'Menyu' : 'Orqaga')} onPress={onAction} tintColor={PlatformColor('label')} />,
    ...(subtitle ? { headerTitle: () => <View><NativeText style={{ color: PlatformColor('label'), fontWeight: '600' }}>{title}</NativeText>
      <NativeText style={{ color: PlatformColor('secondaryLabel'), fontSize: 12 }}>{subtitle}</NativeText></View> } : {}) }} />;
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const { l } = useSupplierText();
  return <Section><Text>{l('serverDisconnectedRetry')}</Text><Button label={l('retry')} onPress={onRetry} /></Section>;
}

// @v2 SupplierHomeScreen
export function SupplierHomeScreen(props: SupplierHomeProps) {
  const store = useSupplierStore(props.store), { l } = useSupplierText();
  useSupplierRootRefresh(store, 'home');
  const pending = supplierPendingItems(store.historyItems), summary = store.summary;
  const loading = !store.loadedHistory && !store.historyError;
  return <View style={{ flex: 1 }}><Header title={l('supplierRoleName')} onAction={props.onOpenDrawer} menu />
    <PreparationList refresh={!loading ? () => store.refreshAll() : undefined}>
      {loading ? <ProgressView /> : !store.loadedHistory && store.historyError != null
        ? <Retry onRetry={() => { void store.refreshAll(); }} /> : <>
          <Section>{(['pending', 'submitted', 'returned'] as const).map(kind => <Button key={kind} onPress={() => props.onStatus(kind)}>
            <HStack><Text>{l(supplierStatusTitleKey(kind))}</Text><Spacer /><Text>{String(kind === 'pending' ? summary.pendingCount
              : kind === 'submitted' ? summary.submittedCount : summary.returnedCount)}</Text></HStack>
          </Button>)}</Section>
          {pending.length > 0 && <Section><Text>{l('inProgressItemsTitle')}</Text>{pending.map((record, index) =>
            <Button key={`${record.id}:${index}`} onPress={() => props.onReceipt(record.id)}><VStack alignment="leading" spacing={4}>
              <Text>{record.item_name}</Text><Text>{record.item_code}</Text>
              <Text>{`${record.sent_qty.toFixed(0)} ${record.uom}`}</Text><Text>{record.created_label}</Text>
            </VStack></Button>)}</Section>}
        </>}
    </PreparationList>{props.footer}</View>;
}

// @v2 SupplierRecentScreen
export function SupplierRecentScreen(props: SupplierRecentProps) {
  const store = useSupplierStore(props.store), { l } = useSupplierText();
  useSupplierRootRefresh(store, 'history');
  const failed = !store.loadedHistory && store.historyError != null;
  return <View style={{ flex: 1 }}><Header title={l('recentTitle')} subtitle={l('recentSubtitle')} onAction={props.onOpenDrawer} menu />
    <PreparationList refresh={failed || store.historyItems.length > 0 ? () => store.refreshHistory() : undefined}>
      {!store.loadedHistory && !store.historyError ? <ProgressView /> : !store.loadedHistory && store.historyError != null
        ? <Retry onRetry={() => { void store.refreshHistory(); }} /> : store.historyItems.length === 0
          ? <Section><Text>{l('noSupplierShipmentsYet')}</Text></Section>
          : <Section>{store.historyItems.map((record, index) => <Button key={`${record.id}:${index}`}
            onPress={() => props.onRepeat(supplierRecentItem(record), record.sent_qty)}>
            <VStack alignment="leading" spacing={4}><Text>{trimNotificationText(record.item_name) ? record.item_name : record.item_code}</Text>
              <Text>{`${record.sent_qty.toFixed(0)} ${record.uom}`}</Text>
              {record.amount > 0 && <Text>{trimNotificationText(`${record.amount.toFixed(0)} ${record.currency}`)}</Text>}
              <Text>{record.created_label}</Text></VStack>
          </Button>)}</Section>}
    </PreparationList>{props.footer}</View>;
}

// @v2 SupplierStatusBreakdownScreen
export function SupplierStatusBreakdownScreen(props: SupplierBreakdownProps) {
  const store = useSupplierStore(props.store), { l, lm, t } = useSupplierText(), ready = useSupplierBreakdown(store, props.kind);
  const grouped = props.kind === 'pending' || props.kind === 'submitted';
  const categories: SupplierCategory[] = props.kind === 'pending' ? ['pendingDispatches', 'pendingUnannounced']
    : ['acceptedByWerka', 'approvedUnannounced'];
  const items = store.breakdownItems(props.kind), error = grouped ? store.historyError : store.breakdownError(props.kind);
  const waiting = !ready || (grouped ? store.loadingHistory && !store.loadedHistory : store.loadingBreakdown(props.kind) && items.length === 0);
  const failed = grouped ? !!error && !store.loadedHistory : !!error && items.length === 0;
  const reload = () => grouped ? store.refreshHistory() : store.refreshBreakdown(props.kind);
  return <View style={{ flex: 1 }}><Header title={l(supplierStatusTitleKey(props.kind))} onAction={props.onBack} />
    <PreparationList refresh={!waiting && !failed && (grouped || items.length > 0) ? reload : undefined}>
      {waiting ? <ProgressView /> : failed ? <Section><Text>{t(String(error))}</Text></Section> : grouped
        ? <Section>{categories.map(category => <Button key={category} onPress={() => props.onCategory(category)}><HStack>
          <Text>{l(supplierCategoryTitleKey(category))}</Text><Spacer /><Text>{String(supplierCategoryItems(store.historyItems, category).length)}</Text>
        </HStack></Button>)}</Section>
        : items.length === 0 ? <Section><Text>{l('noStatusRecords')}</Text></Section>
          : <Section>{items.map((item, index) => <Button key={`${item.item_code}:${index}`}
            onPress={() => props.onDetail(props.kind, item.item_code, item.item_name)}><VStack alignment="leading" spacing={8}>
              <Text>{item.item_name}</Text><Text>{lm('sentQtyStatus', { qty: item.total_returned_qty, uom: item.uom,
                statusWord: l('returnedStatus').toLowerCase() })}</Text><Text>{lm('receiptCountLabel', { count: item.receipt_count })}</Text>
            </VStack></Button>)}</Section>}
    </PreparationList>{props.footer}</View>;
}

// @v2 SupplierSubmittedCategoryDetailScreen
export function SupplierSubmittedCategoryDetailScreen(props: SupplierCategoryProps) {
  const store = useSupplierStore(props.store), { l, t } = useSupplierText();
  useSupplierCategory(store);
  const items = supplierCategoryItems(store.historyItems, props.category);
  const loading = !store.loadedHistory && !store.historyError, failed = !store.loadedHistory && store.historyError != null;
  return <View style={{ flex: 1 }}><Header title={l(supplierCategoryTitleKey(props.category))} onAction={props.onBack} />
    <PreparationList refresh={!loading && !failed && items.length ? () => store.refreshHistory() : undefined}>
      {loading ? <ProgressView /> : failed
        ? <Section><Text>{t(String(store.historyError))}</Text></Section> : items.length === 0
          ? <Section><Text>{l('noRecordsYet')}</Text></Section> : <Section>{items.map((record, index) =>
            <Button key={`${record.id}:${index}`} onPress={() => props.onReceipt(record.id)}><VStack alignment="leading" spacing={8}>
              <HStack><Text>{`${record.sent_qty.toFixed(0)} ${record.uom}`}</Text><Spacer /><Text>{record.created_label}</Text></HStack>
              {!!trimNotificationText(record.note) && <Text>{record.note}</Text>}
            </VStack></Button>)}</Section>}
    </PreparationList>{props.footer}</View>;
}

// @v2 SupplierStatusDetailScreen
export function SupplierStatusDetailScreen(props: SupplierStatusDetailProps) {
  const store = useSupplierStore(props.store), { l, lm, t } = useSupplierText();
  const ready = useSupplierStatusDetail(store, props.kind, props.itemCode), items = store.detailItems(props.kind, props.itemCode);
  const error = store.detailError(props.kind, props.itemCode), waiting = !ready || (store.loadingDetail(props.kind, props.itemCode) && !items.length);
  return <View style={{ flex: 1 }}><Header title={props.itemName} onAction={props.onBack} />
    <PreparationList refresh={!waiting && items.length ? () => store.refreshDetail(props.kind, props.itemCode) : undefined}>
      {waiting ? <ProgressView />
        : error != null && !items.length ? <Section><Text>{t(String(error))}</Text></Section>
          : !items.length ? <Section><Text>{l('noSupplierReceiptsYet')}</Text></Section>
            : <Section>{items.map((record, index) => <Button key={`${record.id}:${index}`} onPress={() => props.onReceipt(record.id)}>
              <VStack alignment="leading" spacing={8}><HStack><Text>{`${record.sent_qty.toFixed(0)} ${record.uom}`}</Text>
                <Spacer /><Text>{record.created_label}</Text></HStack>
                {record.accepted_qty > 0 && <Text>{lm('acceptedQtyLabel', { qty: record.accepted_qty, uom: record.uom })}</Text>}
                {!!trimNotificationText(record.note) && <Text>{record.note}</Text>}
              </VStack></Button>)}</Section>}
    </PreparationList>{props.footer}</View>;
}

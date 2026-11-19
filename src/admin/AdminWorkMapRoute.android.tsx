import { Redirect, useIsFocused, useNavigation } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueConnectionProgress } from '../components/WorkerQueueConnectionProgress';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { ORDERS_TAB_BAR_HEIGHT } from '../shared/orders/ordersWorkspaceTypes';
import { AdminBottomBar } from './AdminBottomBar.android';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminWorkMapMove } from './AdminWorkMapMove';
import { AdminWorkMapPendingRow } from './AdminWorkMapPendingRow';
import { AdminWorkMapClosedRow } from './AdminWorkMapClosedRow';
import { AdminWorkMapAudit } from './AdminWorkMapAudit';
import { AdminWorkMapSequenceFilter } from './AdminWorkMapControls';
import { useAdminShellNotice } from './AdminShellNoticeProvider';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';
import type { AdminWorkMapRow } from './adminWorkMapController';
import { adminWorkMapTabs } from './adminWorkMapControlsTypes';
import { adminWorkMapPresentation } from './adminWorkMapPresentation';
import { useAdminShell } from './AdminShellContext';
import { useAdminShellTheme } from './useAdminShellTheme';
import { useAdminWorkMapView } from './useAdminWorkMapView';

const passthrough = () => true;

function BoundWorkMap({ footer }: { footer?: ReactNode } = {}) {
  const view = useAdminWorkMapView(), { shell, locale, state, controls } = view;
  const { chromeBackground, colors } = useAdminShellTheme(), insets = useSafeAreaInsets();
  const notice = useAdminShellNotice();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), goBack = view.goBack;
  const focused = useIsFocused(), navigation = useNavigation();
  const tabs = adminWorkMapTabs.filter(tab => tab.id !== 'move' || shell.session.profile?.role !== 'sales_manager');
  const canInteract = () => shell.isCurrent() && navigation.isFocused();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack, navigation]);

  const rows = controls.module === 'closed' ? view.closed : state.rows;
  const pagination = state.hasMore && !view.error && !view.loading ? {
    distance: 400,
    loadMore: () => { if (canInteract()) void view.next(controls.module); },
  } : undefined;
  return <View style={[styles.fill, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <SafeAreaView edges={['left', 'right']}><OrdersHeader search={view.query} searchPlaceholder={productionText('worker.queue.search.open', locale)}
      onSearchChange={view.search} onBack={view.goBack} onProfile={view.onProfile} profileAction={<AdminShellProfileAction />} /></SafeAreaView>
    {notice.topNotice}
    <AdminShellBodyFrame hasFooter={footer !== null} testID="admin-work-map-body-frame">
      <OrdersWorkspace session={shell.session} tabs={tabs} selected={controls.module} swipeEnabled={focused}
        onSelect={id => {
          const tab = tabs.find(item => item.id === id);
          if (tab && canInteract()) controls.onModule(tab.id);
        }}>
        {(tab, pagerGesture) => {
          if (tab !== controls.module) return null;
          if (tab === 'move') return <View style={styles.page}><AdminWorkMapMove {...view.move} active={focused} pagerGesture={pagerGesture} /></View>;
          if (tab === 'audit') return <AdminWorkMapAudit model={view.audit} onRefresh={view.refresh}
            active={focused} pagerGesture={pagerGesture} topInset={ORDERS_TAB_BAR_HEIGHT} userScrollPagination={pagination} />;
          return <View style={styles.fill}>
            <OrdersList<AdminWorkMapRow | ClosedRow> active={focused} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight} topInset={ORDERS_TAB_BAR_HEIGHT}
              passthrough={passthrough} rows={rows} onRefresh={view.refresh} userScrollPagination={pagination}
              rowKey={row => 'kind' in row ? `${row.kind}:${row.id}` : row.id}
              renderRow={(row, index) => {
                const first = index === 0, last = index === rows.length - 1;
                if (!('kind' in row)) return <AdminWorkMapClosedRow row={row} first={first} last={last} />;
                const item = adminWorkMapPresentation(tab === 'sequence' ? { ...row, position: undefined } : row, locale);
                const onPress = () => { if (canInteract()) view.open(row); };
                if (row.kind === 'pending') return <AdminWorkMapPendingRow headline={item.headline} supportingText={item.supporting}
                  infoLabel={productionText('worker.order.info', locale)} first={first} last={last} onPress={onPress} />;
                return <OrderListItem session={shell.session} orderId={row.id} imageId={row.imageId} imageActive={focused}
                  headline={item.headline} supportingText={item.supporting} cardTone={item.tone} first={first} last={last} onPress={onPress}
                  leadingAdornment={tab === 'sequence' ? <View style={styles.rank}><AdminClosedRank position={String(row.position ?? index + 1)} /></View> : undefined} />;
              }}>
              {tab === 'sequence' && <AdminWorkMapSequenceFilter {...controls} locale={locale} profileRef={view.filterProfileRef}
                isCurrent={view.sequenceCurrent} onError={notice.onErrorNotice} />}
              {view.loading && !state.loaded && <WorkerQueueConnectionProgress active />}
              {!!view.emptyText && <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{view.emptyText}</Text>}
            </OrdersList>
            {!!view.error && <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant }}>{view.error}</Text>
              <WorkerSheetButton variant="text" label={localizedGetter('retry', locale)} onPress={() => { if (canInteract()) void view.refresh(); }} />
            </View>}
          </View>;
        }}
      </OrdersWorkspace>
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{footer === undefined ? <AdminBottomBar active="home" /> : footer}</View>
  </View>;
}

export function AdminWorkMapRoute({ footer }: { footer?: ReactNode } = {}) {
  const shell = useAdminShell();
  if (!shell.isCurrent()) return <View style={styles.fill} />;
  if (!shell.destination(appRoutes.adminProductionMapOrders, Platform.OS)) return <Redirect href="/" />;
  return <BoundWorkMap footer={footer} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, page: { flex: 1, marginTop: ORDERS_TAB_BAR_HEIGHT },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  message: { padding: 16, textAlign: 'center' }, error: { paddingHorizontal: 16, paddingTop: 8 },
  rank: { marginStart: 8 },
});

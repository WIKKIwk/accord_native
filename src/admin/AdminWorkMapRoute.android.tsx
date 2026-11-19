import { useAdminShellTheme } from './useAdminShellTheme';
import { ListItem } from '@expo/ui';
import { Redirect } from 'expo-router';
import { isValidElement, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminBottomBar } from './AdminBottomBar.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminWorkMapMove } from './AdminWorkMapMove';
import { AdminWorkMapPendingRow } from './AdminWorkMapPendingRow';
import { AdminWorkMapSequenceRow } from './AdminWorkMapSequenceRow';
import { AdminWorkMapClosedRow } from './AdminWorkMapClosedRow';
import { AdminWorkMapAudit } from './AdminWorkMapAudit';
import { AdminWorkMapApparatusFilter, AdminWorkMapModules } from './AdminWorkMapControls';
import { adminWorkMapPresentation } from './adminWorkMapPresentation';
import { adminWorkMapText } from './adminWorkMapText';
import { useAdminShell } from './AdminShellContext';
import { useAdminWorkMapView } from './useAdminWorkMapView';
function BoundWorkMap({ footer }: { footer?: ReactNode } = {}) {
  const view = useAdminWorkMapView(), { shell, locale, state, controller } = view, { chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), label = adminWorkMapText(locale), goBack = view.goBack;
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => sub.remove(); }, [goBack]);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: chromeBackground }}>
    <SafeAreaView edges={['left', 'right']}><OrdersHeader search={view.query} searchPlaceholder={productionText('worker.queue.search.open', locale)}
      onSearchChange={view.search} onBack={view.goBack} onProfile={view.onProfile} profileAction={<AdminShellProfileAction />} /></SafeAreaView>
    <AdminShellBodyFrame hasFooter={footer !== null} testID="admin-work-map-body-frame">
    <BaseHost matchContents={{ vertical: true }}><AdminWorkMapModules {...view.controls} /></BaseHost>
    {view.controls.module === 'move' ? <AdminWorkMapMove {...view.move} /> : <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={view.refresh}
      onEndReached={() => { if (state.hasMore && !view.error) void controller.next(); }}
      passthrough={element => isValidElement(element) && (element.type === AdminWorkMapPendingRow || element.type === AdminWorkMapSequenceRow)}>
      {view.controls.module === 'sequence' && <AdminWorkMapApparatusFilter {...view.controls} />}
      {view.controls.module !== 'audit' && !!view.error && <ListItem supportingText={view.error} onPress={() => { void view.refresh(); }}>{localizedGetter('retry', locale)}</ListItem>}
      {!!view.emptyText && <ListItem>{view.emptyText}</ListItem>}
      {view.controls.module === 'audit' && <AdminWorkMapAudit model={view.audit} onRefresh={view.refresh} />}
      {state.rows.map((row, index) => { const item = adminWorkMapPresentation(view.controls.module === 'sequence' ? { ...row, position: undefined } : row, locale);
          if (view.controls.module === 'sequence') return <AdminWorkMapSequenceRow key={`${row.kind}:${row.id}`} headline={item.headline} supportingText={item.supporting}
            position={row.position ?? index + 1} tone={item.tone} first={index === 0} last={index === state.rows.length - 1} onPress={() => view.open(row)} />;
          if (row.kind === 'pending') return <AdminWorkMapPendingRow key={`${row.kind}:${row.id}`} headline={item.headline} supportingText={item.supporting} infoLabel={productionText('worker.order.info', locale)}
            first={index === 0} last={index === state.rows.length - 1} onPress={() => view.open(row)} />;
          return <OrderListItem key={`${row.kind}:${row.id}`}
        session={shell.session} orderId={row.id} imageId={row.imageId} imageActive={false} headline={item.headline} supportingText={item.supporting}
        cardTone={item.tone} first={index === 0} last={index === state.rows.length - 1} onPress={() => view.open(row)} />; })}
      {view.closed?.map(row => <AdminWorkMapClosedRow key={row.id} row={row} />)}
      {state.hasMore && !view.error && <ListItem onPress={() => { void controller.next(); }}>{label.more}</ListItem>}
    </OrdersList>}
    {view.controls.module !== 'audit' && view.controls.module !== 'move' && view.loading && !state.loaded && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: 60 }} />}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{footer === undefined ? <AdminBottomBar active="home" /> : footer}</View>
  </View>;
}
export function AdminWorkMapRoute({ footer }: { footer?: ReactNode } = {}) {
  const shell = useAdminShell();
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.adminProductionMapOrders, Platform.OS)) return <Redirect href="/" />;
  return <BoundWorkMap footer={footer} />;
}

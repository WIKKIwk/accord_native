import type { ReactNode } from 'react';
import { Button } from '@expo/ui/swift-ui';
import { ListItem } from '@expo/ui';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost';
import { useAdminShellTheme } from './useAdminShellTheme';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapMove } from './AdminWorkMapMove';
import { AdminWorkMapPendingRow } from './AdminWorkMapPendingRow';
import { AdminWorkMapSequenceRow } from './AdminWorkMapSequenceRow';
import { AdminWorkMapClosedRow } from './AdminWorkMapClosedRow';
import { AdminWorkMapAudit } from './AdminWorkMapAudit';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminWorkMapApparatusFilter, AdminWorkMapModules } from './AdminWorkMapControls';
import { adminWorkMapPresentation } from './adminWorkMapPresentation';
import { adminWorkMapText } from './adminWorkMapText';
import { useAdminShell } from './AdminShellContext';
import { useAdminWorkMapView } from './useAdminWorkMapView';

function BoundWorkMap({ footer }: { footer?: ReactNode }) {
  const view = useAdminWorkMapView(), { shell, locale, state, controller } = view, insets = useSafeAreaInsets();
  const { chromeBackground } = useAdminShellTheme();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), label = adminWorkMapText(locale);
  return <><Stack.Screen options={{ headerShown: false }} />
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: chromeBackground }}>
      <OrdersHeader search={view.query} searchPlaceholder={productionText('worker.queue.search.open', locale)} onSearchChange={view.search}
        onBack={view.goBack} onProfile={view.onProfile} profileAction={<AdminShellProfileAction />} />
      <AdminShellBodyFrame hasFooter={footer != null} testID="admin-work-map-body-frame">
      <BaseHost matchContents={{ vertical: true }}><AdminWorkMapModules {...view.controls} /></BaseHost>
      {view.controls.module === 'move' ? <AdminWorkMapMove {...view.move} /> : <BaseHost style={{ flex: 1 }}><OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}
        onRefresh={view.refresh}>
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
        {state.hasMore && !view.error && <Button label={label.more} onPress={() => { void controller.next(); }} />}
      </OrdersList></BaseHost>}
      {view.controls.module !== 'audit' && view.controls.module !== 'move' && view.loading && !state.loaded && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: 60 }} />}
      </AdminShellBodyFrame>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{footer}</View>
    </View>
  </>;
}
export function AdminWorkMapRoute({ footer }: { footer?: ReactNode } = {}) {
  const shell = useAdminShell();
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.adminProductionMapOrders, Platform.OS)) return <Redirect href="/" />;
  return <BoundWorkMap footer={footer} />;
}

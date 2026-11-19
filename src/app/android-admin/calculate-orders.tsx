import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { AdminLoadingIndicator } from '../../admin/AdminLoadingIndicator.android';
import { useAdminHomeShortcutRoute } from '../../admin/useAdminHomeShortcutRoute';
import { BrigaderCalculateOrdersContent, type CalculateOrdersListProps } from '../../brigader/BrigaderCalculateOrdersContent';
import { BaseHost } from '../../components/BaseHost.android';
import { appRoutes } from '../../shared/appRoutes';
import { OrdersList } from '../../shared/orders/OrdersList';

const passthrough = () => true;
function Templates({ rows, renderRow, empty, bottomPadding }: CalculateOrdersListProps) {
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <OrdersList rows={rows} renderRow={renderRow} rowKey={row => row.id} passthrough={passthrough} active
    headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} footer={<View style={{ height: bottomPadding }} />}>
    {rows.length ? null : empty}
  </OrdersList>;
}

/** @v2 AdminCalculateOrdersScreen */
export default function CalculateOrdersRoute() {
  const { current, shortcut } = useAdminHomeShortcutRoute(appRoutes.adminCalculateOrders);
  if (!current) return null;
  if (!shortcut) return <Redirect href="/" />;
  return <BrigaderCalculateOrdersContent renderList={props => <Templates {...props} />} loading={
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View>
  } />;
}

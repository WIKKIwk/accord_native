import type { ReactElement, ReactNode } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import { appRoutes } from '../shared/appRoutes';
import { adminText,localizedGetter } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { FeatureBusy,FeatureError } from './BrigaderList';
import { Form,Label } from './BrigaderForm';
import { useBrigaderCalculateOrders } from './useBrigaderCalculateOrders';
import { BrigaderCalculateOrderRow } from './BrigaderCalculateOrderRow';
import { BrigaderCalculateArgs } from './brigaderCalculateArgs';
export type CalculateOrdersListProps = {
  rows: readonly CalculateOrderTemplate[]; bottomPadding: number; empty: ReactElement;
  renderRow: (item: CalculateOrderTemplate, index: number) => ReactElement;
};

export function BrigaderCalculateOrdersContent({ renderList, loading }: {
  renderList?: (props: CalculateOrdersListProps) => ReactNode; loading?: ReactNode;
} = {}) {
  const { page, owner, state } = useBrigaderCalculateOrders();
  const flows = useBrigaderFlows(), drawer = useRoleDrawer(), insets = useSafeAreaInsets();
  const a = (key: string) => adminText(key, page.locale), rows = owner.visible();
  const header = <OrdersHeader search={state.query} onSearchChange={owner.search} searchPlaceholder={a('calculate.order_search')}
    enabled={page.interactive()} onMenu={() => { if (page.interactive()) drawer.open(); }}
    onSearchFocus={() => owner.focus(true)} onSearchBlur={() => owner.focus(false)} trailing={!state.focused ? <AdminShellProfileAction /> : null} />;
  const empty = <Form><Label>{a(state.query.trim() ? 'calculate.order_empty' : 'calculate.saved_templates_empty')}</Label></Form>;
  const bottomPadding = insets.bottom + 240;
  const renderRow = (item: CalculateOrderTemplate, index: number) => <BrigaderCalculateOrderRow template={item} index={index} count={rows.length}
    session={page.shell.session} witness={page.shell.witness} current={page.current} interactive={page.interactive} locale={page.locale}
    onPress={() => {
      if (page.interactive()) void flows.open({ route: appRoutes.adminCalculate, args: new BrigaderCalculateArgs(item) }, { isCurrent: page.current, canInteract: page.interactive });
    }}
    onDelete={page.shell.session.profile.role === 'sales_manager' ? undefined : () => { void owner.remove(item).catch(() => {}); }} />;

  return <BrigaderFeatureFrame route={appRoutes.adminCalculateOrders} title="" header={header} hideProfile drawer>
    {state.loading ? loading ?? <FeatureBusy /> : state.error ?
      <FeatureError message={localizedGetter('serverDisconnectedRetry', page.locale)} label={localizedGetter('retry', page.locale)} retry={() => { void owner.load(); }} /> :
      renderList ? renderList({ rows, bottomPadding, empty, renderRow }) :
        <FlatList data={rows} contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomPadding }} keyExtractor={item => item.id}
          ListEmptyComponent={empty} renderItem={({ item, index }) => renderRow(item, index)} />}
  </BrigaderFeatureFrame>;
}

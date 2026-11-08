import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerExpansion } from '../components/WorkerExpansion';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { BoyoqchiDock } from './BoyoqchiDock.android';
import { BoyoqchiMessage } from './BoyoqchiMessage';
import { BOYOQCHI_DEMO_UNAVAILABLE } from './returnedPaintDemoGuard';
import { BoyoqchiRequestContent } from './BoyoqchiRequestContent';
import { boyoqchiOrderLabel, boyoqchiRequestKey } from './boyoqchiLogic';
import { useBoyoqchiContext } from './BoyoqchiContext';
import { useBoyoqchiRequests } from './useBoyoqchiRequests';
import { useBoyoqchiText } from './useBoyoqchiText';
import { useReturnedPaintForm } from './useReturnedPaintForm';

// @v2 BoyoqchiHomeScreen
// @v2 BoyoqchiAstatkaScreen
export function BoyoqchiScreen({ home }: { home: boolean }) {
  const { session } = useBoyoqchiContext(), { state, controller } = useBoyoqchiRequests(session, home);
  const drawer = useRoleDrawer(), colors = useMaterialColors(), insets = useSafeAreaInsets(), t = useBoyoqchiText();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), open = useReturnedPaintForm(session, controller);
  const title = home ? 'Bo‘yoqchi' : 'Astatka';
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={t(title)} navigation={{ icon: 'menu', label: t('Bo‘yoqchi bo‘limlari'), onPress: drawer.open }} />
    {session.token === 'test-mode-token' ? <BoyoqchiMessage title={BOYOQCHI_DEMO_UNAVAILABLE} error />
      : state.phase === 'loading' ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : state.phase === 'error' ? <BoyoqchiMessage title={home ? 'Ma’lumotlar yuklanmadi' : 'Astatka ma’lumotlari yuklanmadi'}
        error onRefresh={() => { void controller.refresh(); }} />
        : !state.items.length ? <BoyoqchiMessage title={home ? 'Qaytarilgan bo‘yoq ma’lumotlari hali yo‘q' : 'Hisoblangan Astatka ma’lumotlari hali yo‘q'}
          error={false} onRefresh={() => { void controller.refresh(); }} />
          : <OrdersList active onRefresh={() => controller.refresh()} headerOffset={headerOffset} headerHeight={headerHeight}
            topInset={0} passthrough={() => true}>
            {state.items.map((request, index) => <WorkerQueueCard key={boyoqchiRequestKey(request)} backgroundColor={colors.surface}
              first={index === 0} last={index === state.items.length - 1}>
              <View style={{ flex: 1 }}><WorkerExpansion title={boyoqchiOrderLabel(request)} count=""
                expanded={state.expandedKey === boyoqchiRequestKey(request)} onPress={() => controller.toggle(request)} />
                {state.expandedKey === boyoqchiRequestKey(request) && <BoyoqchiRequestContent session={session} request={request} home={home}
                  apparatus={state.apparatus} onEdit={() => { void open(request).catch(() => {}); }} />}</View>
            </WorkerQueueCard>)}
          </OrdersList>}
    <BoyoqchiDock active={home ? 'home' : 'astatka'} />
  </View>;
}

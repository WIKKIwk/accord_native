import { Host, RNHostView } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerExpansion } from '../components/WorkerExpansion';
import { useWorkerColors } from '../components/useWorkerColors';
import { OrdersList } from '../shared/orders/OrdersList';
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
  const colors = useWorkerColors(), t = useBoyoqchiText(), offset = useSharedValue(0), height = useSharedValue(0);
  const open = useReturnedPaintForm(session, controller);
  return <View style={{ flex: 1, backgroundColor: colors.background }}><Stack.Screen options={{ title: t(home ? 'Bo‘yoqchi' : 'Astatka') }} />
    {session.token === 'test-mode-token' ? <BoyoqchiMessage title={BOYOQCHI_DEMO_UNAVAILABLE} error />
      : state.phase === 'loading' ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : state.phase === 'error' ? <BoyoqchiMessage title={home ? 'Ma’lumotlar yuklanmadi' : 'Astatka ma’lumotlari yuklanmadi'}
        error onRefresh={() => { void controller.refresh(); }} />
        : !state.items.length ? <BoyoqchiMessage title={home ? 'Qaytarilgan bo‘yoq ma’lumotlari hali yo‘q' : 'Hisoblangan Astatka ma’lumotlari hali yo‘q'}
          error={false} onRefresh={() => { void controller.refresh(); }} />
          : <Host style={{ flex: 1 }}><OrdersList active onRefresh={() => controller.refresh()} headerOffset={offset} headerHeight={height} topInset={0}>
            {state.items.map(request => <RNHostView key={boyoqchiRequestKey(request)} matchContents>
              <View style={{ width: '100%', backgroundColor: colors.surface, borderRadius: 14, marginVertical: 2 }}>
                <WorkerExpansion title={boyoqchiOrderLabel(request)} count="" expanded={state.expandedKey === boyoqchiRequestKey(request)}
                  onPress={() => controller.toggle(request)} />
                {state.expandedKey === boyoqchiRequestKey(request) && <BoyoqchiRequestContent session={session} request={request} home={home}
                  apparatus={state.apparatus} onEdit={() => { void open(request).catch(() => {}); }} />}
              </View>
            </RNHostView>)}
          </OrdersList></Host>}
  </View>;
}

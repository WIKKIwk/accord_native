import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationText } from '../preparation/PreparationUI.android';
import { RoleFab } from '../shared/navigation/RoleFab.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { OrdersList } from '../shared/orders/OrdersList';
import { useMaterialContext } from './MaterialContext';
import { materialHomeActions, type MaterialHomeHandlers } from './materialHomeActions';
import { useMaterialScope } from './useMaterialScope';

// This partial shell is not tagged as V2 coverage until the actions and native FAB are implemented.
export function MaterialHome({ handlers }: { handlers?: MaterialHomeHandlers } = {}) {
  const { session } = useMaterialContext(), drawer = useRoleDrawer(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { groups, refresh } = useMaterialScope(session);
  const actions = materialHomeActions(session, handlers);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Material ta’minotchisi" navigation={{ icon: 'menu', label: 'Material bo‘limlari', onPress: drawer.open }} />
    <OrdersList onRefresh={refresh} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      {!groups.length && <View style={{ padding: 16, gap: 8 }}><PreparationText>Mahsulot guruhi biriktirilmagan</PreparationText>
        <PreparationText>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</PreparationText></View>}
      {actions.cards.map((item, index) => <WorkerQueueCard key={item.id} first={index === 0} last={index === actions.cards.length - 1}
        backgroundColor={colors.surface} onPress={() => actions.select(item.id)}>
        <SymbolView name={item.icon} size={23} tintColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1, padding: 14 }}><PreparationText>{item.label}</PreparationText></View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={22} tintColor={colors.onSurfaceVariant} />
      </WorkerQueueCard>)}
    </OrdersList>
    {!!actions.fab.length && <RoleFab actions={actions.fab.map(item => ({ id: item.id, label: item.label, icon: item.icon.android, width: item.width }))}
      onSelect={actions.select} bottomOffset={16} testIDPrefix="material-home-fab" openLabel="Amallar" closeLabel="Yopish" />}
  </View>;
}

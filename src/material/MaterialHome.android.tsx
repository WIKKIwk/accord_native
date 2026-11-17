import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Text, useColorScheme, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { RoleFab } from '../shared/navigation/RoleFab.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { OrdersList } from '../shared/orders/OrdersList';
import { useMaterialContext } from './MaterialContext';
import { materialHomeActions, type MaterialHomeHandlers } from './materialHomeActions';
import { useMaterialScope } from './useMaterialScope';

// @v2 MaterialTaminotchiHomeScreen
export function MaterialHome({ handlers }: { handlers?: MaterialHomeHandlers } = {}) {
  const { session, witness } = useMaterialContext(), drawer = useRoleDrawer(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { groups, refresh } = useMaterialScope(session, witness);
  const actions = materialHomeActions(session, handlers);
  const surface = useColorScheme() === 'dark' ? colors.surfaceContainer : colors.surfaceContainerLowest;
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Material ta’minotchisi" navigation={{ icon: 'menu', label: 'Material bo‘limlari', onPress: drawer.open }} />
    <OrdersList onRefresh={refresh} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      {!groups.length && <View style={{ marginBottom: 14, borderRadius: 24, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16,
        backgroundColor: colors.tertiaryContainer, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <SymbolView name={{ android: 'info' }} size={24} tintColor={colors.onTertiaryContainer} />
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.onTertiaryContainer, fontSize: 14, fontWeight: '800' }}>Mahsulot guruhi biriktirilmagan</Text>
          <Text style={{ color: colors.onTertiaryContainer, fontSize: 12, lineHeight: 15 }}>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</Text>
        </View>
      </View>}
      {actions.cards.map((item, index) => <WorkerQueueCard key={item.id} first={index === 0} last={index === actions.cards.length - 1}
        backgroundColor={surface} onPress={() => actions.select(item.id)} containerStyle={{ paddingHorizontal: 4 }}
        style={{ paddingHorizontal: 16, paddingVertical: 15, gap: 14 }}>
        <SymbolView name={item.icon} size={23} tintColor={colors.onSurfaceVariant} />
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 16, fontWeight: '500' }}>{item.label}</Text>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={22} tintColor={colors.onSurfaceVariant} />
      </WorkerQueueCard>)}
    </OrdersList>
    {!!actions.fab.length && <RoleFab actions={actions.fab.map(item => ({ id: item.id, label: item.label, icon: item.icon.android, width: item.width }))}
      onSelect={actions.select} bottomOffset={16} testIDPrefix="material-home-fab" openLabel="Amallar" closeLabel="Yopish" />}
  </View>;
}

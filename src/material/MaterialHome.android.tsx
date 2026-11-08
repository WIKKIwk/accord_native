import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreparationText } from '../preparation/PreparationUI.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { OrdersList } from '../shared/orders/OrdersList';
import { useMaterialContext } from './MaterialContext';
import { useMaterialScope } from './useMaterialScope';

// This partial shell is not tagged as V2 coverage until the actions and native FAB are implemented.
export function MaterialHome() {
  const { session } = useMaterialContext(), drawer = useRoleDrawer(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { groups, refresh } = useMaterialScope(session);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Material ta’minotchisi" navigation={{ icon: 'menu', label: 'Material bo‘limlari', onPress: drawer.open }} />
    <OrdersList onRefresh={refresh} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      {!groups.length && <View style={{ padding: 16, gap: 8 }}><PreparationText>Mahsulot guruhi biriktirilmagan</PreparationText>
        <PreparationText>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</PreparationText></View>}
    </OrdersList>
  </View>;
}

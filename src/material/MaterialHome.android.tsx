import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreparationText } from '../preparation/PreparationUI.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { useMaterialContext } from './MaterialContext';
import { useMaterialScope } from './useMaterialScope';

// This partial shell is not tagged as V2 coverage until the actions and native FAB are implemented.
export function MaterialHome() {
  const { session } = useMaterialContext(), drawer = useRoleDrawer(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { groups, refreshing, refresh } = useMaterialScope(session);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Material ta’minotchisi" navigation={{ icon: 'menu', label: 'Material bo‘limlari', onPress: drawer.open }} />
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 8 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} />}>
      {!groups.length && <><PreparationText>Mahsulot guruhi biriktirilmagan</PreparationText>
        <PreparationText>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</PreparationText></>}
    </ScrollView>
  </View>;
}

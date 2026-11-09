import { useCallback } from 'react';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useMaterialContext } from './MaterialContext';
import { materialProfileCurrent } from './materialProfileGuard';
export function MaterialProfile() {
  const { session, witness, onLogout } = useMaterialContext(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  const current = useCallback(() => materialProfileCurrent(session, witness), [session, witness]);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Profil" navigation={{ icon: 'back', label: 'Orqaga', onPress: () => {
      if (router.canGoBack()) router.back(); else router.navigate('/android-material' as Href);
    } }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} isCurrent={current} settingsUnavailableMessage="Sozlamalar vaqtincha mavjud emas." /></View>
  </View>;
}

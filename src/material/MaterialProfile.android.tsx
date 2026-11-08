import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useMaterialContext } from './MaterialContext';
export function MaterialProfile() {
  const { session, onLogout } = useMaterialContext(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Profil" navigation={{ icon: 'back', label: 'Orqaga', onPress: () => {
      if (router.canGoBack()) router.back(); else router.navigate('/android-material' as Href);
    } }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} /></View>
  </View>;
}

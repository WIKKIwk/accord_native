import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../components/ProfileScreen';
import { RoleHeader } from '../../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../../shared/navigation/roleDrawerContext';
import { BoyoqchiDock } from '../../boyoqchi/BoyoqchiDock.android';
import { useBoyoqchiContext } from '../../boyoqchi/BoyoqchiContext';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiProfile() {
  const { session, onLogout } = useBoyoqchiContext(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const drawer = useRoleDrawer(), getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={getter('profileTitle')} navigation={{ icon: 'menu', label: t('Bo‘yoqchi bo‘limlari'), onPress: drawer.open }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/android-boyoqchi' as Href)} /></View>
    <BoyoqchiDock active="profile" />
  </View>;
}

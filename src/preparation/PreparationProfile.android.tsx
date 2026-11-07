import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { usePreparationContext } from './PreparationContext.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { PreparationDock, usePreparationText } from './PreparationUI.android';

export function PreparationProfileScreen() {
  const { session, onLogout } = usePreparationContext(), insets = useSafeAreaInsets(), colors = useMaterialColors(), t = usePreparationText();
  const home = () => router.replace('/android-preparation' as Href);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={t('Profil')} navigation={{ icon: 'back', label: t('Orqaga'), onPress: () => { if (router.canGoBack()) router.back(); else home(); } }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} onDailyWork={home} /></View>
    <PreparationDock profile />
  </View>;
}

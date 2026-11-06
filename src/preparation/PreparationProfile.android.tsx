import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationDock, PreparationText, usePreparationText } from './PreparationUI.android';

export function PreparationProfileScreen() {
  const { session, onLogout } = usePreparationContext(), insets = useSafeAreaInsets(), colors = useMaterialColors(), t = usePreparationText();
  const home = () => router.replace('/android-preparation' as Href);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={() => { if (router.canGoBack()) router.back(); else home(); }}
        style={{ padding: 8 }}><PreparationText>‹</PreparationText></Pressable>
      <View style={{ flex: 1 }}><PreparationText title>{t('Profil')}</PreparationText></View>
    </View>
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} onDailyWork={home} /></View>
    <PreparationDock profile />
  </View>;
}

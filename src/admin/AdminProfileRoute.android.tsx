import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { adminProfileSettingsUnavailable } from './adminProfileText';
import { AdminBottomBar } from './AdminBottomBar.android';
import { useAdminShell } from './AdminShellContext';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const goBack = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/android-admin' as Href); }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => sub.remove(); }, [goBack]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, Platform.OS)) return <Redirect href="/" />;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={localizedGetter('profileTitle', locale)} navigation={{ icon: 'back', label: adminActivityBackLabel(locale), onPress: goBack }} />
    <View style={{ flex: 1 }}><ProfileScreen session={shell.session} isCurrent={shell.isCurrent} onLogout={() => { if (shell.isCurrent()) shell.onLogout(); }}
      showDirectLogout={false} settingsUnavailableMessage={adminProfileSettingsUnavailable(locale)} /></View>
    <AdminBottomBar active="user" />
  </View>;
}

import { Redirect, Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Platform, PlatformColor, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminProfileSettingsUnavailable } from './adminProfileText';
import { useAdminShell } from './AdminShellContext';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, Platform.OS)) return <Redirect href="/" />;
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('profileTitle', locale) }} />
    <SafeAreaView edges={['left', 'right']} style={styles.screen}><ProfileScreen session={shell.session} isCurrent={shell.isCurrent}
      onLogout={() => { if (shell.isCurrent()) shell.onLogout(); }} showDirectLogout={false}
      settingsUnavailableMessage={adminProfileSettingsUnavailable(locale)} /></SafeAreaView>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') } });

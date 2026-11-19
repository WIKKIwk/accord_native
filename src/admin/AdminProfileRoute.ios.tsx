import { Redirect, Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { useAdminShellTheme } from './useAdminShellTheme';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useAdminShell } from './AdminShellContext';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), { chromeBackground } = useAdminShellTheme();
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, Platform.OS)) return <Redirect href="/" />;
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('profileTitle', locale), headerStyle: { backgroundColor: chromeBackground } }} />
    <View style={[styles.screen, { backgroundColor: chromeBackground }]}><AdminShellBodyFrame hasFooter testID="admin-profile-body-frame"><ProfileScreen session={shell.session} isCurrent={shell.isCurrent}
      onLogout={() => { if (shell.isCurrent()) shell.onLogout(); }} showDirectLogout={false}
      settingsDisabled /></AdminShellBodyFrame></View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 } });

import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { useBaseTheme } from '../components/useBaseTheme';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminProfileHeader } from './AdminProfileHeader.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { AdminBottomBar } from './AdminBottomBar.android';
import { useAdminShell } from './AdminShellContext';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const { colors } = useBaseTheme();
  const goBack = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/android-admin' as Href); }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => sub.remove(); }, [goBack]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, Platform.OS)) return <Redirect href="/" />;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>
    <AdminProfileHeader title={localizedGetter('profileTitle', locale)} backLabel={adminActivityBackLabel(locale)} onBack={goBack} />
    <AdminShellBodyFrame hasFooter testID="admin-profile-body-frame"><ProfileScreen session={shell.session} isCurrent={shell.isCurrent} onLogout={() => { if (shell.isCurrent()) shell.onLogout(); }}
      showDirectLogout={false} settingsDisabled /></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}><AdminBottomBar active="user" /></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

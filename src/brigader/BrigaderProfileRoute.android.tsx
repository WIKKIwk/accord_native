import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { useBaseTheme } from '../components/useBaseTheme';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminProfileHeader } from '../admin/AdminProfileHeader.android';
import { AdminShellBodyFrame } from '../admin/AdminShellBodyFrame';
import { adminActivityBackLabel } from '../admin/adminActivityBackLabel';
import { useAdminShell } from '../admin/AdminShellContext';
import { BrigaderBottomBar } from './BrigaderBottomBar.android';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function BrigaderProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), { colors } = useBaseTheme();
  const goBack = useCallback(() => {
    if (!shell.isCurrent()) return;
    if (router.canGoBack()) router.back();
    else { const home = shell.destination(homeRoute(shell.session), 'android'); if (home) router.replace(home as Href); }
  }, [shell]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => sub.remove(); }, [goBack]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, 'android')) return <Redirect href="/" />;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>
    <AdminProfileHeader title={localizedGetter('profileTitle', locale)} backLabel={adminActivityBackLabel(locale)} onBack={goBack} />
    <AdminShellBodyFrame hasFooter testID="brigader-profile-body-frame"><ProfileScreen session={shell.session} isCurrent={shell.isCurrent}
      onLogout={() => { if (shell.isCurrent()) shell.onLogout(); }} showDirectLogout={false} /></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}><BrigaderBottomBar active="user" /></View>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

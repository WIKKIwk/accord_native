import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { AdminBottomBar } from './AdminBottomBar.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { useAdminShellNotice } from './AdminShellNoticeProvider';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminScreenHeader } from './AdminTopBar.android';
import { useAdminHomeShortcutRoute, type AdminHomeShortcutRouteProps } from './useAdminHomeShortcutRoute';
import { useAdminShellTheme } from './useAdminShellTheme';

export function AdminHomeShortcutRoute({ route, children, drawer: useDrawer }: AdminHomeShortcutRouteProps & {
  children?: ReactNode; drawer?: boolean;
}) {
  const { current, shortcut, backLabel, goBack, locale, canInteract } = useAdminHomeShortcutRoute(route);
  const { chromeBackground } = useAdminShellTheme();
  const insets = useSafeAreaInsets();
  const drawer = useRoleDrawer();
  const notice = useAdminShellNotice();
  if (!current) return null;
  if (!shortcut) return <Redirect href="/" />;

  const navigation = useDrawer ? { icon: 'menu' as const, label: localizedGetter('adminDrawerSections', locale), onPress: () => { if (canInteract()) drawer.open(); } } :
    { icon: 'back' as const, label: backLabel, onPress: goBack, testID: 'admin-home-shortcut-back' };
  return <View style={[styles.fill, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <AdminScreenHeader title={shortcut.title} profileAction={<AdminShellProfileAction />} navigation={navigation} />
    {notice.topNotice}
    <AdminShellBodyFrame hasFooter testID="admin-home-shortcut-body">{children}</AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}><AdminBottomBar active="home" /></View>
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, footer: { position: 'absolute', bottom: 0, left: 0, right: 0 } });

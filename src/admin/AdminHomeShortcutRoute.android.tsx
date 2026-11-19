import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminBottomBar } from './AdminBottomBar.android';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminScreenHeader } from './AdminTopBar.android';
import { useAdminHomeShortcutRoute, type AdminHomeShortcutRouteProps } from './useAdminHomeShortcutRoute';
import { useAdminShellTheme } from './useAdminShellTheme';

export function AdminHomeShortcutRoute({ route }: AdminHomeShortcutRouteProps) {
  const { current, shortcut, backLabel, goBack } = useAdminHomeShortcutRoute(route);
  const { chromeBackground } = useAdminShellTheme();
  const insets = useSafeAreaInsets();
  if (!current) return null;
  if (!shortcut) return <Redirect href="/" />;

  return <View style={[styles.fill, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <AdminScreenHeader title={shortcut.title} profileAction={<AdminShellProfileAction />}
      navigation={{ icon: 'back', label: backLabel, onPress: goBack, testID: 'admin-home-shortcut-back' }} />
    <View style={styles.fill} />
    <AdminBottomBar active="home" />
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

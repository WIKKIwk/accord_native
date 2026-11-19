import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { useAdminHomeShortcutRoute, type AdminHomeShortcutRouteProps } from './useAdminHomeShortcutRoute';
import { useAdminShellTheme } from './useAdminShellTheme';

export function AdminHomeShortcutRoute({ route }: AdminHomeShortcutRouteProps) {
  const { current, shortcut, backLabel, goBack } = useAdminHomeShortcutRoute(route);
  const { colors, chromeBackground } = useAdminShellTheme();
  if (!current) return null;
  if (!shortcut) return <Redirect href="/" />;

  return <>
    <Stack.Screen options={{ headerShown: true, title: shortcut.title, headerBackVisible: false,
      headerStyle: { backgroundColor: chromeBackground },
      headerLeft: () => <RoleHeaderButton icon="back" label={backLabel} onPress={goBack}
        tintColor={colors.onSurface} testID="admin-home-shortcut-back" />,
      headerRight: () => <AdminShellProfileAction />,
    }} />
    <View style={{ flex: 1, backgroundColor: chromeBackground }} />
  </>;
}

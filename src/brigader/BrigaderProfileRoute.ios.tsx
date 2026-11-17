import { Redirect, router, Stack, type Href } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { useAdminShell } from '../admin/AdminShellContext';
import { AdminShellBodyFrame } from '../admin/AdminShellBodyFrame';
import { adminActivityBackLabel } from '../admin/adminActivityBackLabel';
import { ProfileScreen } from '../components/ProfileScreen';
import { useBaseTheme } from '../components/useBaseTheme';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function BrigaderProfileRoute() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const { colors } = useBaseTheme();
  const goBack = useCallback(() => {
    if (!shell.isCurrent()) return;
    if (router.canGoBack()) router.back();
    else router.replace('/ios-brigader' as Href);
  }, [shell]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.profile, 'ios')) return <Redirect href="/" />;
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('profileTitle', locale),
    headerStyle: { backgroundColor: colors.surfaceContainerHigh }, headerLeft: () =>
      <RoleHeaderButton icon="back" label={adminActivityBackLabel(locale)} onPress={goBack} tintColor={PlatformColor('label')} /> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>
      <AdminShellBodyFrame hasFooter testID="brigader-profile-body-frame">
        <ProfileScreen session={shell.session} isCurrent={shell.isCurrent} onLogout={() => {
          if (shell.isCurrent()) shell.onLogout();
        }} showDirectLogout={false} />
      </AdminShellBodyFrame>
    </View>
  </>;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });

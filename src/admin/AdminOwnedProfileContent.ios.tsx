import { Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Button } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, foregroundStyle, frame, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { ProfileScreen } from '../components/ProfileScreen';
import { useAdminShellTheme } from './useAdminShellTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import type { AdminOwnedRouteContentProps } from './AdminOwnedRouteContentTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminOwnedProfileContent(props: AdminOwnedRouteContentProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), { colors, chromeBackground } = useAdminShellTheme();
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('profileTitle', locale), headerBackVisible: false,
    headerStyle: { backgroundColor: chromeBackground }, headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={() => { if (props.canInteract()) props.onBack(false); }}
      modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), foregroundStyle(colors.onSurface), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel), accessibilityIdentifier('admin-profile-back')]} /></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: chromeBackground }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-profile-body-frame"><ProfileScreen session={props.session} isCurrent={props.isCurrent} onLogout={props.onLogout}
      showDirectLogout={false} settingsDisabled={props.session.profile.role !== 'brigader'} /></AdminShellBodyFrame>
      <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

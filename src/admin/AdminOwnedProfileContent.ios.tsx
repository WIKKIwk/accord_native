import { Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { adminProfileSettingsUnavailable } from './adminProfileText';
import type { AdminOwnedRouteContentProps } from './AdminOwnedRouteContentTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminOwnedProfileContent(props: AdminOwnedRouteContentProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('profileTitle', locale), headerBackVisible: false,
    headerLeft: () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={() => { if (props.canInteract()) props.onBack(false); }} tintColor={PlatformColor('label')} /> }} />
    <SafeAreaView edges={['left', 'right']} style={styles.screen}><ProfileScreen session={props.session} isCurrent={props.isCurrent} onLogout={props.onLogout}
      showDirectLogout={false} settingsUnavailableMessage={adminProfileSettingsUnavailable(locale)} />
      <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    </SafeAreaView>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

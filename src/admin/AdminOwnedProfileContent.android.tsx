import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { adminProfileSettingsUnavailable } from './adminProfileText';
import type { AdminOwnedRouteContentProps } from './AdminOwnedRouteContentTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminOwnedProfileContent(props: AdminOwnedRouteContentProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), { colors } = useBaseTheme(), insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }]}>
    <SafeAreaView edges={['left', 'right']} style={styles.screen}><RoleHeader title={localizedGetter('profileTitle', locale)} navigation={{ icon: 'back', label: props.backLabel, onPress: () => { if (props.canInteract()) props.onBack(false); } }} />
      <View style={styles.screen}><ProfileScreen session={props.session} isCurrent={props.isCurrent} onLogout={props.onLogout}
        showDirectLogout={false} settingsUnavailableMessage={adminProfileSettingsUnavailable(locale)} /></View>
    </SafeAreaView>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

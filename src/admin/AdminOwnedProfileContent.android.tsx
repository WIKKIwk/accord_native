import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { useAdminShellTheme } from './useAdminShellTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminProfileHeader } from './AdminProfileHeader.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import type { AdminOwnedRouteContentProps } from './AdminOwnedRouteContentTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminOwnedProfileContent(props: AdminOwnedRouteContentProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), { chromeBackground } = useAdminShellTheme();
  return <View style={[styles.screen, { backgroundColor: chromeBackground }]}>
    <AdminProfileHeader title={localizedGetter('profileTitle', locale)} backLabel={props.backLabel} onBack={() => { if (props.canInteract()) props.onBack(false); }} />
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-profile-body-frame"><ProfileScreen session={props.session} isCurrent={props.isCurrent} onLogout={props.onLogout}
      showDirectLogout={false} settingsDisabled={props.session.profile.role !== 'brigader'} /></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

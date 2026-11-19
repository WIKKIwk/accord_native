import { Redirect, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { AdminOwnedDock } from './AdminOwnedDock.ios';
import { AdminProfileAction } from './AdminProfileAction';
import { useAdminShell } from './AdminShellContext';
import { AdminUsersRoute } from './AdminUsersRoute.ios';
import { useAdminUsersPage } from './useAdminUsersPage';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminUsersPage() {
  const shell = useAdminShell(), page = useAdminUsersPage(), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), providers = page.context.providers;
  if (!page.context.current()) return null;
  if (!page.context.ready() || !providers) return <Redirect href={(page.context.rootPath ?? "/ios-admin") as Href} />;
  if (!page.admitted) return null;
  return <View style={styles.screen}><AdminUsersRoute session={shell.session} witness={shell.witness} isCurrent={page.current} canInteract={page.interactive}
    backLabel={adminActivityBackLabel(locale)} onBack={page.back} onOpenUser={page.openUser}
    profileAction={<AdminProfileAction session={shell.session} witness={shell.witness} isCurrent={page.current} canInteract={page.interactive} onProfile={page.openProfile} />}
    footer={<View pointerEvents="box-none" style={styles.footer}><AdminOwnedDock active="user" isCurrent={page.current} canInteract={page.interactive} /></View>} />
    {providers.renderPrimaryAction({ isCurrent: page.current, canInteract: page.interactive })}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

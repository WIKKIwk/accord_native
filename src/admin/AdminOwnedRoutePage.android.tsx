import { Redirect } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { AdminOwnedBackProvider } from './AdminOwnedBackContext';
import { AdminOwnedDock } from './AdminOwnedDock.android';
import { AdminOwnedRouteContent } from './AdminOwnedRouteContent.android';
import { AdminOwnedRouteNotice } from './AdminOwnedRouteNotice.android';
import { AdminProfileAction } from './AdminProfileAction.android';
import { useAdminShell } from './AdminShellContext';
import { useAdminOwnedNotice } from './useAdminOwnedNotice';
import { useAdminOwnedPage } from './useAdminOwnedPage';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function AdminOwnedRoutePage() {
  const shell = useAdminShell(), page = useAdminOwnedPage(), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), notice = useAdminOwnedNotice(page.current);
  const providers = page.context.providers;
  if (!page.context.current()) return null;
  if (!page.context.ready() || !providers) return <Redirect href="/android-admin" />;
  if (!page.entry) return <Redirect href="/android-admin/users" />;
  if (!page.admitted || !page.registerBack) return null;
  const profileAction = <AdminProfileAction session={shell.session} witness={shell.witness} isCurrent={page.current} canInteract={page.interactive} onProfile={() => { void page.open({ kind: 'profile' }); }} />;
  const footer = <AdminOwnedDock active={page.entry.routeName === appRoutes.adminWerka ? 'settings' : 'user'} isCurrent={page.current} canInteract={page.interactive} />;
  return <AdminOwnedBackProvider register={page.registerBack}><View style={styles.screen}>
    <AdminOwnedRouteContent session={shell.session} witness={shell.witness} entry={page.entry} isCurrent={page.current} canInteract={page.interactive}
      backLabel={adminActivityBackLabel(locale)} onBack={page.back} open={page.open} profileAction={profileAction} footer={footer} providers={providers} onNotice={notice.show}
      onLogout={() => { if (page.interactive()) shell.onLogout(); }} />
    {providers.renderPrimaryAction({ isCurrent: page.current, canInteract: page.interactive })}
    <AdminOwnedRouteNotice notice={notice.notice} isCurrent={page.current} />
  </View></AdminOwnedBackProvider>;
}
const styles = StyleSheet.create({ screen: { flex: 1 } });

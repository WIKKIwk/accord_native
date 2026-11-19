import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { FactoryLocationsRoute } from './FactoryLocationsRoute';
import { useAdminShell } from './AdminShellContext';
import { AdminShellProfileAction } from './AdminShellProfileAction';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** Compose the real factory screen with the original shell admission and navigation. */
export function AdminFactoryLocationsRoute({ footer }: { footer?: ReactNode }) {
  const shell = useAdminShell(), drawer = useRoleDrawer();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.adminFactoryLocations, Platform.OS)) return <Redirect href="/" />;
  const canGoBack = router.canGoBack();
  const navigation = { icon: canGoBack ? 'back' as const : 'menu' as const,
    label: canGoBack ? adminActivityBackLabel(locale) : localizedGetter('adminDrawerSections', locale),
    onPress: () => {
      if (!mounted.current || !shell.isCurrent() || !shell.destination(appRoutes.adminFactoryLocations, Platform.OS)) return;
      if (canGoBack) { if (router.canGoBack()) router.back(); }
      else drawer.open();
    } };
  return <FactoryLocationsRoute session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} footer={footer} profileAction={<AdminShellProfileAction />} />;
}

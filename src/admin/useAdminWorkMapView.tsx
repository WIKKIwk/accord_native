import { router, type Href } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { AdminWorkMapDetail } from './AdminWorkMapDetail';
import type { AdminWorkMapRow } from './adminWorkMapController';
import { useAdminShell } from './AdminShellContext';
import { useAdminWorkMap } from './useAdminWorkMap';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeNow = () => localeController.locale;
export function useAdminWorkMapView() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, localeNow, localeNow), sheet = useNativeSheet();
  const { state, controller } = useAdminWorkMap(shell.session, shell.isCurrent), [query, setQuery] = useState('');
  const goBack = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace(`/${Platform.OS}-admin` as Href); }, []);
  const onProfile = useCallback(() => {
    const path = shell.isCurrent() ? shell.destination(appRoutes.profile, Platform.OS) : null;
    if (path) router.push(path as Href);
  }, [shell]);
  const search = (value: string) => { setQuery(value); controller.setQuery(value); };
  const open = (row: AdminWorkMapRow) => {
    if (!shell.isCurrent() || !shell.destination(appRoutes.adminProductionMapOrders, Platform.OS)) return;
    const ticket = controller.detailTicket(row); if (!ticket) return;
    sheet.open(<AdminWorkMapDetail session={shell.session} isCurrent={shell.isCurrent} controller={controller} row={row} ticket={ticket} close={sheet.close} />,
      { dismissible: true });
  };
  return { shell, locale, state, controller, query, goBack, onProfile, search, open };
}

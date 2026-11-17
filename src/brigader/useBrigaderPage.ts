import { router, useIsFocused, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useAdminShell } from '../admin/AdminShellContext';
import { useAdminPageAuthority } from '../admin/useAdminPageAuthority';
import { adminActivityBackLabel } from '../admin/adminActivityBackLabel';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
/** Reads survive a legitimate child push; commands belong to the original focused native page. */
export function useBrigaderPage(route: string) {
  const shell = useAdminShell(), focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const parent = useCallback(() => shell.isCurrent() && canOpenRoute(shell.session, route), [shell, route]);
  const canInteract = useCallback(() => focus.current, []);
  const authority = useAdminPageAuthority(parent, canInteract);
  const { current, interactive } = authority;
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const back = useCallback(() => {
    if (!interactive()) return;
    if (router.canGoBack()) router.back();
    else { const path = shell.destination(homeRoute(shell.session), Platform.OS); if (path) router.replace(path as Href); }
  }, [interactive, shell]);
  const profile = useCallback(() => {
    const path = interactive() ? shell.destination(appRoutes.profile, Platform.OS) : null;
    if (path) router.push(path as Href);
  }, [interactive, shell]);
  return { shell, current, interactive, back, profile, locale, backLabel: adminActivityBackLabel(locale) };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { localeController } from '../shared/localization/runtime';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import { adminSettingsSession } from './adminSettingsSession';
import type { AdminSettingsField } from './adminSettingsController';
import type { AdminSettingsScreenProps } from './AdminSettingsTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminSettings({ session, witness, isCurrent, navigation, onNavigate, isRouteAvailable }: AdminSettingsScreenProps) {
  const owner = useMemo(() => adminSettingsSession(session, witness, isCurrent), [session, witness, isCurrent]);
  const { controller } = owner;
  const focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useEffect(() => {
    controller.start();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate();
    return () => { unsubscribe(); controller.dispose(); };
  }, [owner, controller]);
  useEffect(() => {
    if (state.notice === null) return;
    const timer = setTimeout(() => controller.dismissNotice(state.notice!), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const back = navigation ? { ...navigation, onPress: () => { if (focus.current) controller.runCurrent(() => navigation.onPress(controller.getSnapshot().changed)); } } : null;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !navigation) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!focus.current || !controller.isCurrent()) return false;
      controller.runCurrent(() => navigation.onPress(controller.getSnapshot().changed)); return true;
    });
    return () => subscription.remove();
  }, [controller, navigation]));
  const available = (route: string) => canOpenRoute(session, route) &&
    (!isRouteAvailable || isProfileSessionCurrent(() => isRouteAvailable(route)));
  const navigate = (route: string) => { if (focus.current) controller.runCurrent(() => { if (available(route) && controller.isCurrent()) onNavigate(route); }); };
  const additional = available(appRoutes.adminAdditionalSettings), push = available(appRoutes.adminPushConfig);
  return { state, controller,
    change: (key: AdminSettingsField, value: string) => { if (focus.current) controller.change(key, value); },
    reload: () => { if (focus.current) void controller.reload(); }, current: owner.current(), navigation: back, navigate,
    additional, push,
    t: (key: string) => localizedGetter(key, locale), a: (key: string) => adminText(key, locale), p: (key: string) => productionText(key, locale),
    save: () => { if (focus.current) void controller.save().catch(() => { /* V2 shows no additional save-failure message. */ }); } };
}

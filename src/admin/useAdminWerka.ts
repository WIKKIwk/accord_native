import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWerkaScreenProps } from './AdminWerkaScreenTypes';
import { createAdminWerkaSession } from './adminWerkaSession';
import { adminWerkaInitials } from './adminWerkaPresentation';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminWerka(props: AdminWerkaScreenProps) {
  const { onBack } = props;
  const owner = useMemo(() => createAdminWerkaSession(props.session, props.witness, props.isCurrent), [props.session, props.witness, props.isCurrent]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const focused = useIsFocused(), focus = useRef(focused), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useEffect(() => {
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate(); return unsubscribe;
  }, [owner, controller]);
  useEffect(() => {
    if (state.copiedNotice === null) return;
    const serial = state.copiedNotice, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [state.copiedNotice, controller]);
  const generation = controller.interactionGeneration, current = useCallback(() => owner.current() && controller.isCurrent(generation), [owner, controller, generation]);
  const interactive = () => focus.current && current();
  const back = () => { if (interactive()) onBack(controller.getSnapshot().changed); };
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!focus.current || !current()) return false;
      onBack(controller.getSnapshot().changed); return true;
    });
    return () => subscription.remove();
  }, [controller, current, onBack]));
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  // Source locale/parent rebuilds read live controllers; a snackbar-only change does not rebuild that parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fields = useMemo(() => controller.currentFields, [controller, locale, state.fields]);
  const displayName = dartTrim(fields.name) || a('profile.name_placeholder');
  return { state, fields, a, t: (key: string) => localizedGetter(key, locale), current, interactive, focused, generation, displayName,
    initials: adminWerkaInitials(displayName), back,
    toggle: () => { if (interactive()) controller.toggle(); },
    changeName: (value: string) => { if (interactive()) controller.change('name', value); },
    changePhone: (value: string) => { if (interactive()) controller.change('phone', value); },
    reload: () => { if (interactive()) void controller.reload(); },
    save: async () => {
      if (!interactive() || controller.getSnapshot().phase !== 'content' || controller.getSnapshot().saving) return false;
      try { await controller.save(); return current(); } catch { return false; }
    },
    regenerate: () => { if (interactive()) void controller.regenerate().catch(() => {}); },
    copy: () => { if (interactive()) void controller.copy().catch(() => {}); },
  };
}
export type AdminWerkaScreenModel = ReturnType<typeof useAdminWerka>;

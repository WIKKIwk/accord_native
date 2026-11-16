import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWorkerProfileScreenProps } from './AdminWorkerProfileScreenTypes';
import { adminWorkerProfileCards } from './adminWorkerProfilePresentation';
import { createAdminWorkerProfileSession } from './adminWorkerProfileSession';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminWorkerProfile(props: AdminWorkerProfileScreenProps) {
  const { session, witness, isCurrent, entry, onBack } = props;
  const owner = useMemo(() => createAdminWorkerProfileSession(session, witness, isCurrent, entry), [session, witness, isCurrent, entry]), { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false), leaving = useRef(false);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; leaving.current = false; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const remove = subscribeSessionWitness(retire); retire(); return remove; }, [owner, controller]);
  const generation = controller.interactionGeneration;
  const hostInteractive = props.canInteract;
  const current = useCallback(() => mounted.current && !leaving.current && controller.isCurrent(generation), [controller, generation]);
  const back = useCallback(() => {
    if (!focus.current || !current() || hostInteractive !== undefined && !isSynchronouslyTrue(hostInteractive) || !current()) return false; leaving.current = true;
    try { onBack(); } catch (error) { leaving.current = false; throw error; } return true;
  }, [current, onBack, hostInteractive]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return; const sub = BackHandler.addEventListener('hardwareBackPress', back); return () => sub.remove();
  }, [back]));
  return { state, current, back, title: adminText('detail.worker_title', locale), retryLabel: adminText('detail.reload', locale),
    cards: state.phase === 'content' && state.data ? adminWorkerProfileCards(state.data.detail, state.data.apparatus, locale) : [],
    reload: async () => { if (focus.current && current() && (hostInteractive === undefined || isSynchronouslyTrue(hostInteractive)) && current()) await controller.reload(); } };
}
export type AdminWorkerProfileScreenModel = ReturnType<typeof useAdminWorkerProfile>;

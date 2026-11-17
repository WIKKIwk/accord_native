import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { MobileApiException } from '../shared/mobileApiException';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminQueuePolicySession } from './adminQueuePolicySession';
import { adminQueuePolicyEffective, adminQueuePolicyVisible, type ApparatusQueuePolicy } from './adminQueuePolicyModel';
import type { AdminQueuePolicyScreenProps } from './AdminQueuePolicyTypes';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminQueuePolicy(props: AdminQueuePolicyScreenProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), { onErrorNotice } = props;
  const owner = useMemo(() => adminQueuePolicySession({ session: props.session, witness: props.witness, isCurrent: props.isCurrent }),
  [props.session, props.witness, props.isCurrent]);
  const controller = owner.controller, focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.start(); const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate(); return () => { unsubscribe(); controller.dispose(); };
  }, [controller, owner]);
  useEffect(() => {
    const notice = state.errorNotice;
    if (!notice || !controller.isCurrent()) return;
    controller.dismissError(notice.serial);
    if (controller.isCurrent()) onErrorNotice(notice.error instanceof MobileApiException ? notice.error.message : adminText('queue.save_failed', locale));
  }, [controller, state.errorNotice, locale, onErrorNotice]);
  const back = () => { if (focus.current && controller.isCurrent()) props.navigation.onPress(); };
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!focus.current || !controller.isCurrent()) return false; props.navigation.onPress(); return true;
    }); return () => subscription.remove();
  }, [controller, props.navigation]));
  const rows = state.data ? adminQueuePolicyVisible(state.data, props.apparatusId).map(apparatus => {
    const policy = adminQueuePolicyEffective(apparatus, state.policies), saving = state.saving.has(dartTrim(apparatus.id));
    return { apparatus, title: dartTrim(apparatus.name), policy, saving, enabled: !policy.locked && !saving,
      change: (value: ApparatusQueuePolicy) => { if (focus.current) void controller.update(apparatus, value); } };
  }) : [];
  return { state, rows, current: owner.current(), navigation: { ...props.navigation, onPress: back },
    reload: () => { if (focus.current) void controller.reload(); }, a: (key: string) => adminText(key, locale), t: (key: string) => localizedGetter(key, locale) };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminPushConfigScreenProps } from './AdminPushConfigScreenTypes';
import { adminPushConfigErrorKey, type AdminPushConfigPlatform } from './adminPushConfigModel';
import { adminPushConfigSession } from './adminPushConfigSession';

export function useAdminPushConfig(props: AdminPushConfigScreenProps) {
  const { session, witness, isCurrent, device, deviceTokenProvider, pickFile, onBack } = props;
  const owner = useMemo(() => adminPushConfigSession({ session, witness, isCurrent, device, deviceTokenProvider, pickFile }),
    [session, witness, isCurrent, device, deviceTokenProvider, pickFile]);
  const { controller } = owner, focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const subscribeDevice = useCallback((listener: () => void) => device.subscribe(listener), [device]);
  const readDevice = useCallback(() => device.getSnapshot(), [device]);
  const deviceState = useSyncExternalStore(subscribeDevice, readDevice, readDevice);
  const locale = useSyncExternalStore(listener => localeController.addListener(listener), () => localeController.locale, () => localeController.locale);
  useEffect(() => {
    if (owner.allowed()) controller.start();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.allowed()) controller.invalidate(); });
    return () => { unsubscribe(); controller.dispose(); };
  }, [owner, controller]);
  const back = useCallback(() => { if (focus.current && owner.current()) onBack(); }, [owner, onBack]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!focus.current || !owner.current()) return false;
      back(); return true;
    }); return () => listener.remove();
  }, [owner, back]));
  const interact = (action: () => Promise<void>) => { if (focus.current && owner.allowed()) void action(); };
  return { state, deviceState, current: owner.current(), allowed: owner.allowed(), back, backLabel: props.backLabel,
    t: (key: string) => adminText(`push.${key}`, locale), errorKey: adminPushConfigErrorKey,
    changeJson: (value: string) => { if (focus.current) controller.changeJson(value); },
    pick: () => interact(controller.pick), save: () => interact(controller.save), check: () => interact(controller.check),
    test: () => interact(controller.test), reload: () => interact(controller.reload), applyDevice: () => interact(controller.applyDevice),
    pickMobile: (platform: AdminPushConfigPlatform) => interact(() => controller.pickMobile(platform)),
    enabled: owner.allowed() && !state.busy, configuredEnabled: owner.allowed() && !state.busy && state.config?.configured === true };
}
export type AdminPushConfigScreenModel = ReturnType<typeof useAdminPushConfig>;

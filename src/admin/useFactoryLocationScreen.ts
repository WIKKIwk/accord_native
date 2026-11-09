import { useEffect, useSyncExternalStore } from 'react';
import type { FactoryLocationScreenProps } from './factoryLocationScreenTypes';

export function useFactoryLocationScreen({ controller }: FactoryLocationScreenProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useEffect(() => {
    if (!state.notice) return;
    const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  return state;
}

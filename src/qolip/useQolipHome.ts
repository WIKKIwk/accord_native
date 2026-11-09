import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { registerSessionResetHook, type Session } from '../auth';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { createQolipHomeState } from './qolipHomeRuntime';

export function useQolipHome(session: Session) {
  const controller = useMemo(() => createQolipHomeState(session), [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unsubscribe = qolipDataRevision.subscribe(() => controller.locationsChanged());
    const unregister = registerSessionResetHook(async () => { controller.invalidateSession(); });
    const appState = AppState.addEventListener('change', value => { if (value === 'active') controller.appResumed(); });
    void controller.start().catch(() => {});
    return () => { appState.remove(); unregister(); unsubscribe(); controller.dispose(); };
  }, [controller]);
  useFocusEffect(useCallback(() => { controller.routeChanged(true); return () => controller.routeChanged(false); }, [controller]));
  return { ...state, displayBlocks: controller.displayBlocks, controller };
}

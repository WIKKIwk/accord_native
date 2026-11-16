import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeAdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';
import { adminShellFrameLayout } from './adminShellLayoutPolicy';
import { AdminShellLayoutController } from './adminShellLayoutRuntime';

/** Admin-owned frame geometry; footer/list/content padding is chosen by each source screen. */
export function useAdminShellLayout(hasFooter: boolean, bottomDockHeight?: number) {
  const controller = useMemo(() => new AdminShellLayoutController(), []), state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const window = useWindowDimensions(), safe = useSafeAreaInsets();
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useLayoutEffect(() => { void controller.refresh(); }, [controller, window.width, window.height, window.scale, safe.top, safe.right, safe.bottom, safe.left]);
  useEffect(() => {
    const refresh = controller.refresher(), native = subscribeAdminSystemInsets(refresh), foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const names = Platform.OS === 'ios' ? ['keyboardWillShow', 'keyboardDidShow', 'keyboardWillHide', 'keyboardDidHide', 'keyboardWillChangeFrame', 'keyboardDidChangeFrame'] as const : ['keyboardDidShow', 'keyboardDidHide'] as const;
    const keyboard = names.map(name => Keyboard.addListener(name, refresh));
    return () => { native(); foreground.remove(); keyboard.forEach(subscription => subscription.remove()); };
  }, [controller]);
  const frame = adminShellFrameLayout(state.metrics, hasFooter, state.thinGestureBottom, bottomDockHeight);
  return { ...frame, metricsReady: state.metrics !== null, navigationResolved: state.navigationResolved, thinGestureBottom: state.thinGestureBottom };
}

import { isRunningInExpoGo } from 'expo';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeAdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';
import { androidRoleBottomBarHeight } from '../shared/navigation/roleNavigationMetrics';
import { adminShellDockHeight, adminShellFrameLayout } from './adminShellLayoutPolicy';
import { AdminShellLayoutController } from './adminShellLayoutRuntime';
import { useAdminShellSourceWindowLayout } from './AdminShellSourceWindowLayoutContext';

const inactiveState = Object.freeze({ metrics: null, thinGestureBottom: false, navigationResolved: false });
const inactiveSnapshot = () => inactiveState, inactiveSubscribe = () => () => {};
/** Admin-owned frame geometry; footer/list/content padding is chosen by each source screen. */
export function useAdminShellLayout(hasFooter: boolean, bottomDockHeight?: number) {
  const source = useAdminShellSourceWindowLayout(), sourceWindow = source !== null;
  const expoGo = isRunningInExpoGo(), [keyboardVisible, setKeyboardVisible] = useState(() => expoGo && Keyboard.isVisible());
  const controller = useMemo(() => sourceWindow ? null : new AdminShellLayoutController(), [sourceWindow]);
  const getSnapshot = controller?.getSnapshot ?? inactiveSnapshot, state = useSyncExternalStore(controller?.subscribe ?? inactiveSubscribe, getSnapshot, getSnapshot);
  const window = useWindowDimensions(), safe = useSafeAreaInsets();
  useLayoutEffect(() => { if (!controller) return; controller.start(); return () => controller.dispose(); }, [controller]);
  useLayoutEffect(() => { if (controller) void controller.refresh(); }, [controller, window.width, window.height, window.scale, safe.top, safe.right, safe.bottom, safe.left]);
  useEffect(() => {
    if (!controller) return;
    const refresh = controller.refresher(), native = subscribeAdminSystemInsets(refresh), foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const names = Platform.OS === 'ios' ? ['keyboardWillShow', 'keyboardDidShow', 'keyboardWillHide', 'keyboardDidHide', 'keyboardWillChangeFrame', 'keyboardDidChangeFrame'] as const : ['keyboardDidShow', 'keyboardDidHide'] as const;
    const keyboard = names.map(name => Keyboard.addListener(name, () => {
      if (expoGo && name.endsWith('Show')) setKeyboardVisible(true);
      if (expoGo && name.endsWith('Hide')) setKeyboardVisible(false);
      refresh();
    }));
    return () => { native(); foreground.remove(); keyboard.forEach(subscription => subscription.remove()); };
  }, [controller, expoGo]);
  const metrics = sourceWindow ? source.metrics : state.metrics, thinGestureBottom = sourceWindow ? source.thinGestureBottom : state.thinGestureBottom;
  const dockHeight = bottomDockHeight ?? (Platform.OS === 'android' ? androidRoleBottomBarHeight : adminShellDockHeight);
  const frame = adminShellFrameLayout(metrics, hasFooter, thinGestureBottom === true, dockHeight);
  // Expo Go exposes the activity safe area, but not the app's native layout module or a source window's metrics.
  const preview = expoGo && !sourceWindow && metrics === null;
  const previewBottomReserve = hasFooter && !keyboardVisible ? dockHeight + safe.bottom : 0;
  return { ...frame, bottomReserve: preview ? previewBottomReserve : frame.bottomReserve,
    dockBottomInset: preview ? safe.bottom : frame.dockBottomInset,
    metrics, metricsReady: metrics !== null || preview, navigationResolved: sourceWindow ? typeof thinGestureBottom === 'boolean' : state.navigationResolved,
    thinGestureBottom, sourceWindow, safeInsets: sourceWindow ? source.safeInsets : safe };
}

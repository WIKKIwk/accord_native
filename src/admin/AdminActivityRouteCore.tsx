import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, BackHandler, Platform, View } from 'react-native';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { refreshHub } from '../shared/notificationStoresRuntime';
import { AdminActivityPending } from './AdminActivityPending';
import { AdminActivityScreen } from './AdminActivityScreen';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import type { AdminActivityBinding } from './adminActivityBinding';
import { AdminActivityController } from './adminActivityController';
import { useAdminShell } from './AdminShellContext';

type Shell = ReturnType<typeof useAdminShell>;
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const afterFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function BoundActivity({ shell, binding, footer }: { shell: Shell; binding: AdminActivityBinding; footer?: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), { session, store, isCurrent } = shell;
  const controller = useMemo(() => new AdminActivityController({ store, hidden: binding.hidden, hub: refreshHub,
    isCurrent, scope: () => sessionReadScope(session), generation: binding.generation,
    canOpen: () => canOpenRoute(session, appRoutes.adminActivity), afterFrame }), [store, isCurrent, session, binding]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const captured = binding.generation(); controller.start();
    const unsubscribe = binding.subscribe(() => {
      if (!isCurrent() || captured === null || binding.generation() !== captured || !canOpenRoute(session, appRoutes.adminActivity)) controller.invalidate();
    });
    if (!isCurrent() || captured === null || binding.generation() !== captured || !canOpenRoute(session, appRoutes.adminActivity)) controller.invalidate();
    return () => { unsubscribe(); controller.dispose(); };
  }, [binding, controller, session, isCurrent]);
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back(); else router.replace(`/${Platform.OS}-admin` as Href);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack]);
  const requestClear = () => {
    const serial = controller.requestClear(); if (serial === null) return;
    Alert.alert(localizedGetter('clearTitle', locale), localizedGetter('clearAllNotificationsPrompt', locale), [
      { text: localizedGetter('no', locale), style: 'cancel', onPress: () => { void controller.resolveClear(serial, false); } },
      { text: localizedGetter('yes', locale), onPress: () => { void controller.resolveClear(serial, true); } },
    ], { cancelable: true, onDismiss: () => { void controller.resolveClear(serial, false); } });
  };
  const navigation = { icon: 'back' as const, label: adminActivityBackLabel(locale), onPress: goBack };
  if (state.invalidated) return <View style={{ flex: 1 }} />;
  if (state.hiddenState !== 'ready') return <AdminActivityPending status={state.hiddenState} onRetry={() => { void controller.reload(); }}
    navigation={navigation} footer={footer} />;
  return <AdminActivityScreen snapshot={state.activity} hiddenIds={state.hiddenIds} navigation={navigation} footer={footer}
    onRefresh={() => controller.reload()} onRequestClear={requestClear} />;
}
/** No fallback storage: direct entry is denied until the real safe binding is supplied. */
export function AdminActivityRoute({ footer }: { footer?: ReactNode }) {
  const shell = useAdminShell();
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.activityBinding || !shell.destination(appRoutes.adminActivity, Platform.OS)) return <Redirect href="/" />;
  return <BoundActivity shell={shell} binding={shell.activityBinding} footer={footer} />;
}

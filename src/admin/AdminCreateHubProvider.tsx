import { useIsFocused } from 'expo-router';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminCreateHubHost } from './AdminCreateHubHost';
import type { AdminCreateHubProviderProps, AdminPrimaryActionProps } from './AdminCreateHubTypes';
import { adminCreateHubLayout } from './adminCreateHubModel';
import { createAdminCreateHubSession } from './adminCreateHubSession';
import { useAdminShellLayout } from './useAdminShellLayout';

type Owner = ReturnType<typeof createAdminCreateHubSession>;
const HubContext = createContext<Owner | null>(null);
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const nextFrame = (callback: () => void) => { const id = requestAnimationFrame(callback); return () => cancelAnimationFrame(id); };

/** Must surround the genuine native stack once, inside its original Admin font/account scope. */
export function AdminCreateHubProvider(props: AdminCreateHubProviderProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const owner = useMemo(() => createAdminCreateHubSession(props.session, props.witness, props.isCurrent, props.isRouteAvailable, props.onOpenRoute, currentLocale, nextFrame),
    [props.session, props.witness, props.isCurrent, props.isRouteAvailable, props.onOpenRoute]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot), metrics = useAdminShellLayout(true);
  useLayoutEffect(() => { owner.controller.start(); const unsubscribe = subscribeSessionWitness(() => owner.controller.recheck()); return () => { unsubscribe(); owner.controller.dispose(); }; }, [owner]);
  useLayoutEffect(() => { owner.controller.setProfileOnStack(props.profileOnStack); }, [owner, props.profileOnStack]);
  useLayoutEffect(() => { owner.controller.refreshLocale(); }, [owner, locale]);
  const primary = owner.controller.primary(), layout = adminCreateHubLayout(metrics.dockBottomInset, primary?.hasPrimary ?? false, primary?.visible ?? false);
  return <HubContext.Provider value={owner}><View style={styles.root}>{props.children}
    <AdminCreateHubHost controller={owner.controller} state={state} primary={primary} layout={layout}
      labels={{ trigger: localizedGetter('adminCreateTitle', locale), closed: localizedGetter('createHubTitle', locale), close: localizedGetter('closeAction', locale) }} />
  </View></HubContext.Provider>;
}

function useOwner() { const owner = useContext(HubContext); if (!owner) throw new Error('AdminCreateHubProvider is required'); return owner; }
/** Registers a real root-owned FAB. The root host paints it above the native stack. */
export function AdminPrimaryAction(props: AdminPrimaryActionProps) {
  const owner = useOwner(), focused = useIsFocused(), { isCurrent, canInteract, showPrimaryFab, actions, replacement } = props;
  useEffect(() => {
    const ticket = owner.controller.register({ isCurrent, canInteract, showPrimaryFab, actions, replacement, hasReplacement: replacement != null, isFocused: () => focused });
    return () => { if (ticket) owner.controller.unregister(ticket); };
  }, [owner, focused, isCurrent, canInteract, showPrimaryFab, actions, replacement]);
  return null;
}
/** A held route can inspect genuine destination readiness before it admits the source surface. */
export function useAdminCreateHubReadiness() {
  const owner = useOwner(); useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  return owner.controller.readiness();
}
/** Source Scaffold receives the whole dock/FAB host, separately from AppShell's60px reserve. */
export function useAdminCreateHubHostHeight() {
  const owner = useOwner(); useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  const metrics = useAdminShellLayout(true), primary = owner.controller.primary();
  return adminCreateHubLayout(metrics.dockBottomInset, primary?.hasPrimary ?? false, primary?.visible ?? false).hostHeight;
}
const styles = StyleSheet.create({ root: { flex: 1 } });

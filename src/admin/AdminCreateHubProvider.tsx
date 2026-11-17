import { useIsFocused } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminCreateHubHost } from './AdminCreateHubHost';
import type { AdminCreateHubProviderProps, AdminPrimaryActionProps } from './AdminCreateHubTypes';
import { adminCreateHubLayout } from './adminCreateHubModel';
import { createAdminCreateHubSession } from './adminCreateHubSession';
import { useAdminShellLayout } from './useAdminShellLayout';
import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';

type Owner = ReturnType<typeof createAdminCreateHubSession>;
type PlacementProps = AdminCreateHubProviderProps & { placementCurrent: boolean };
const HubContext = createContext<Owner | null>(null);
export type AdminCreateHubScaffoldLayout = Readonly<{ metrics: AdminSystemInsets | null; hostHeight: number | null }>;
const ScaffoldLayoutContext = createContext<AdminCreateHubScaffoldLayout | null>(null);
const SourceWindowContext = createContext<Owner['controller'] | null>(null);
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const nextFrame = (callback: () => void) => { const id = requestAnimationFrame(callback); return () => cancelAnimationFrame(id); };

/** Must surround the genuine native stack once, inside its original Admin font/account scope. */
function useHubOwner(props: PlacementProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const owner = useMemo(() => createAdminCreateHubSession(props.session, props.witness, props.isCurrent, props.isRouteAvailable, props.onOpenRoute, currentLocale, nextFrame),
    [props.session, props.witness, props.isCurrent, props.isRouteAvailable, props.onOpenRoute]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  useLayoutEffect(() => { owner.controller.start(); const unsubscribe = subscribeSessionWitness(() => owner.controller.recheck()); return () => { unsubscribe(); owner.controller.dispose(); }; }, [owner]);
  useLayoutEffect(() => { if (!props.placementCurrent) owner.controller.invalidate(); }, [owner, props.placementCurrent]);
  useLayoutEffect(() => { owner.controller.setProfileOnStack(props.profileOnStack); }, [owner, props.profileOnStack]);
  useLayoutEffect(() => { owner.controller.refreshLocale(); }, [owner, locale]);
  return { owner, state, locale };
}
function LegacyHubProvider(props: PlacementProps) {
  const { owner, state, locale } = useHubOwner(props), metrics = useAdminShellLayout(true);
  const primary = owner.controller.primary(), layout = adminCreateHubLayout(metrics.dockBottomInset, primary?.hasPrimary ?? false, primary?.visible ?? false);
  // A missing original trigger or a held visible FAB has no faithful source footer measurement yet.
  const sourceHostHeight = primary === null || primary.visible && !primary.ready ? null : layout.hostHeight;
  const scaffoldLayout = useMemo(() => Object.freeze({ metrics: metrics.metrics, hostHeight: sourceHostHeight }), [metrics.metrics, sourceHostHeight]);
  return <HubContext.Provider value={owner}><View style={styles.root}><ScaffoldLayoutContext.Provider value={scaffoldLayout}>{props.children}</ScaffoldLayoutContext.Provider>
    <AdminCreateHubHost controller={owner.controller} state={state} primary={primary} layout={layout}
      labels={{ trigger: localizedGetter('adminCreateTitle', locale), closed: localizedGetter('createHubTitle', locale), close: localizedGetter('closeAction', locale) }} />
  </View></HubContext.Provider>;
}
function SourceWindowHubProvider(props: PlacementProps) {
  const { owner } = useHubOwner(props);
  return <HubContext.Provider value={owner}><SourceWindowContext.Provider value={owner.controller}>{props.children}</SourceWindowContext.Provider></HubContext.Provider>;
}
/** One original global account owner in either placement. Source-window mode has no Activity reader or inferred global paint. */
export function AdminCreateHubProvider(props: AdminCreateHubProviderProps) {
  const [sourceWindows] = useState(() => props.sourceWindows ?? false);
  if (props.sourceWindows !== undefined && typeof props.sourceWindows !== 'boolean') throw TypeError('An explicit Hub placement mode is required');
  const placementCurrent = sourceWindows === (props.sourceWindows ?? false);
  return sourceWindows ? <SourceWindowHubProvider {...props} placementCurrent={placementCurrent} /> : <LegacyHubProvider {...props} placementCurrent={placementCurrent} />;
}

function useOwner() { const owner = useContext(HubContext); if (!owner) throw new Error('AdminCreateHubProvider is required'); return owner; }
/** Structural owner availability; individual default destinations retain their separate readiness gate. */
export function useAdminCreateHubOwnerCurrent() {
  const owner = useOwner();
  return useCallback(() => owner.controller.isCurrent(), [owner]);
}
/** The SAME global controller; constructing a page-local Hub session is not supported. */
export function useAdminCreateHubSourceController() {
  const owner = useOwner(), controller = useContext(SourceWindowContext);
  if (controller !== owner.controller) throw Error('The genuine source-window Hub placement is required'); return controller;
}
/** A genuine Reader-backed page snapshot, separate from its semantic Source sizing target. */
export function AdminCreateHubSourceLayout({ layout, children }: { layout: AdminCreateHubScaffoldLayout; children: ReactNode }) {
  useAdminCreateHubSourceController(); return <ScaffoldLayoutContext.Provider value={layout}>{children}</ScaffoldLayoutContext.Provider>;
}
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
  return useAdminCreateHubScaffoldLayout().hostHeight;
}
/** The raw IME measurement and the real dock/FAB host are from one root layout snapshot. */
export function useAdminCreateHubScaffoldLayout(): AdminCreateHubScaffoldLayout {
  const layout = useContext(ScaffoldLayoutContext); if (!layout) throw new Error('AdminCreateHubProvider is required'); return layout;
}
const styles = StyleSheet.create({ root: { flex: 1 } });

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, findNodeHandle, Platform, View, type ViewInstance } from 'react-native';
import { useIsFocused } from 'expo-router';
import { readAdminScaffoldLayoutObserver } from '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout';
import { AdminFixedSnackBarProvider, useAdminFixedSnackBarTarget } from '../admin/AdminFixedSnackBarProvider';
import { AdminFixedSnackBarReaderOwner, type AdminScaffoldLayoutBinding } from '../admin/adminFixedSnackBarReader';
import type { AdminFixedSnackBarNativeReader, AdminFixedSnackBarSourceVisibility } from '../admin/AdminFixedSnackBarTypes';
import { useAdminTopNoticeTarget } from '../admin/AdminTopNoticeProvider';
import { AdminRouteScaffoldContext, useAdminTopNoticeScaffold } from '../admin/useAdminTopNoticeScaffold';
import type { AdminTopNoticeScaffold } from '../admin/adminTopNoticeModel';
import { createAdminPresentationWindowTicket } from '../admin/adminPresentationWindowTicket';
import { useAdminCreateHubScaffoldLayout, type AdminCreateHubScaffoldLayout } from '../admin/AdminCreateHubProvider';
import { useAdminShell } from '../admin/AdminShellContext';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminTopNoticeMessenger } from '../admin/adminTopNoticeMessenger';
import { useBrigaderSnackPalette } from './useBrigaderSnackPalette';

type Page = { binding: AdminScaffoldLayoutBinding; interactive: () => boolean };
type Runtime = { reader: AdminFixedSnackBarReaderOwner; pages: Map<AdminTopNoticeScaffold, Page>; publish: () => void; subscribe: (listener: () => void) => () => void };
const Context = createContext<Runtime | null>(null);
const HostClaims = createContext<{ claim: () => () => void; layout: AdminCreateHubScaffoldLayout } | null>(null);
function DefaultFixedHost(props: Parameters<ReturnType<typeof useAdminFixedSnackBarTarget>['render']>[0]) {
  const target = useAdminFixedSnackBarTarget();
  return target.render(props);
}
function FixedHost(props: Parameters<ReturnType<typeof useAdminFixedSnackBarTarget>['render']>[0]) {
  const slot = useContext(HostClaims), target = useAdminFixedSnackBarTarget();
  useLayoutEffect(() => slot?.claim(), [slot]);
  return target.render({ ...props, sourceLayout: slot?.layout ?? props.sourceLayout });
}
export function useBrigaderFixedSnackBars() {
  const target = useAdminFixedSnackBarTarget();
  return useMemo(() => ({ ...target, render: (host: Parameters<typeof target.render>[0]) => <FixedHost {...host} /> }), [target]);
}
function Bound({ children, owner }: { children: ReactNode; owner: AdminFixedSnackBarReaderOwner }) {
  const { isCurrent } = useAdminShell(), palette = useBrigaderSnackPalette(), [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const runtime = useMemo<Runtime>(() => { const listeners = new Set<() => void>(); return { reader: owner, pages: new Map(), publish: () => listeners.forEach(listener => listener()), subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } }; }, [owner]);
  useEffect(() => { let active = true; const stop = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { if (active) setReduceMotion(value); }); void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }); return () => { active = false; stop.remove(); }; }, []);
  useEffect(() => { const stop = AppState.addEventListener('change', runtime.publish); return () => stop.remove(); }, [runtime]);
  const visibility = useMemo<AdminFixedSnackBarSourceVisibility>(() => ({ subscribe: runtime.subscribe, canInteract: scaffold => isCurrent() && AppState.currentState === 'active' && !!runtime.pages.get(scaffold)?.interactive(), tickerEnabled: scaffold => isCurrent() && !!runtime.pages.get(scaffold)?.interactive() }), [runtime, isCurrent]);
  const reader = useMemo<AdminFixedSnackBarNativeReader>(() => ({ isAvailable: owner.reader.isAvailable, observe: (request, receive) => {
    let stopNative: (() => void) | undefined, stopBinding: (() => void) | undefined, bound: AdminScaffoldLayoutBinding | undefined, revision = -1, closed = false;
    const refresh = () => {
      if (closed) return; const page = runtime.pages.get(request.scaffold);
      if (bound !== page?.binding) { stopBinding?.(); bound = page?.binding; stopBinding = bound?.subscribe(refresh); }
      const state = bound?.getSnapshot();
      if (revision === state?.revision) return; revision = state?.revision ?? -1; stopNative?.(); stopNative = undefined;
      if (!state?.viewport || state.dockHeight === null || !request.isCurrent()) { receive(null); return; }
      stopNative = owner.reader.observe({ ...request, sourceLayout: { ...request.sourceLayout, hostHeight: state.dockHeight } }, receive);
    };
    const stop = runtime.subscribe(refresh); refresh();
    return () => { closed = true; stop(); stopBinding?.(); stopNative?.(); };
  } }), [owner, runtime]);
  if (reduceMotion === null) return null;
  return <Context.Provider value={runtime}><AdminFixedSnackBarProvider reader={reader} visibility={visibility} palette={palette} disableAnimations={reduceMotion} dismissLabel={localizedGetter('closeAction', localeController.locale)}>{children}</AdminFixedSnackBarProvider></Context.Provider>;
}
class FeedbackResource {
  private leases = 0;
  private owner: AdminFixedSnackBarReaderOwner | null = null;
  private pending: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly messenger: AdminTopNoticeMessenger, private readonly current: () => boolean) {}
  getSnapshot = () => this.owner;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  attach = () => {
    this.leases++;
    if (!this.owner && !this.pending) this.pending = readAdminScaffoldLayoutObserver(Platform.OS).then(observer => {
      if (!this.leases || !observer || !this.current()) return;
      this.owner = new AdminFixedSnackBarReaderOwner({ observer, messenger: this.messenger, isCurrent: this.current });
      this.listeners.forEach(listener => listener());
    }).finally(() => { this.pending = null; });
    return () => { this.leases--; queueMicrotask(() => { if (!this.leases) { this.owner?.dispose(); this.owner = null; } }); };
  };
}
export function BrigaderFeedbackProvider({ children }: { children: ReactNode }) {
  const { isCurrent } = useAdminShell(), { messenger } = useAdminTopNoticeTarget();
  const resource = useMemo(() => new FeedbackResource(messenger, isCurrent), [messenger, isCurrent]);
  const owner = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  useEffect(() => resource.attach(), [resource]);
  return owner ? <Bound owner={owner}>{children}</Bound> : null;
}
/** One genuine native route owns this source Scaffold and the native viewport/dock registrations. */
export function BrigaderNativePage({ children }: { children: ReactNode }) {
  const runtime = useContext(Context), shell = useAdminShell(), focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false);
  const scaffold = useAdminTopNoticeScaffold(null), layout = useAdminCreateHubScaffoldLayout();
  const viewport = useRef<ViewInstance>(null), dock = useRef<ViewInstance>(null), [ids] = useState(() => ({ viewport: createAdminPresentationWindowTicket(), dock: createAdminPresentationWindowTicket() }));
  const sentDock = useRef<number | null>(null), binding = useRef<AdminScaffoldLayoutBinding | null>(null), [ready, setReady] = useState(false), [measured, setMeasured] = useState<number | null>(null), [claims, setClaims] = useState(0);
  const claim = useMemo(() => () => { setClaims(value => value + 1); return () => setClaims(value => value - 1); }, []);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { focus.current = focused; runtime?.publish(); return () => { focus.current = false; runtime?.publish(); }; }, [focused, runtime]);
  const current = useMemo(() => () => mounted.current && shell.isCurrent(), [shell]);
  const capture = () => {
    if (!runtime || !scaffold.ticket || !current()) return;
    const tag = findNodeHandle(viewport.current);
    if (!binding.current && typeof tag === 'number') {
      const value = runtime.reader.registerScaffold({ scaffold: scaffold.ticket, viewportMarker: { tag, nativeID: ids.viewport }, isCurrent: current });
      if (!value) return; binding.current = value; runtime.pages.set(scaffold.ticket, { binding: value, interactive: () => focus.current && current() });
      value.subscribe(() => { if (current()) setMeasured(value.getSnapshot().dockHeight); }); runtime.publish(); setReady(true);
    }
    const dockTag = findNodeHandle(dock.current); if (typeof dockTag === 'number' && layout.hostHeight !== null && sentDock.current !== dockTag && binding.current) { sentDock.current = dockTag; binding.current.setDockMarker({ tag: dockTag, nativeID: ids.dock }); }
  };
  useLayoutEffect(() => () => { binding.current?.dispose(); binding.current = null; sentDock.current = null; if (runtime && scaffold.ticket) { runtime.pages.delete(scaffold.ticket); runtime.publish(); } }, [runtime, scaffold.ticket]);
  useLayoutEffect(() => { capture(); });
  const nativeLayout = useMemo(() => ({ ...layout, hostHeight: measured ?? layout.hostHeight }), [layout, measured]);
  const slot = useMemo(() => ({ claim, layout: nativeLayout }), [claim, nativeLayout]);
  return <AdminRouteScaffoldContext.Provider value={scaffold}><HostClaims.Provider value={slot}><View ref={viewport} collapsable={false} nativeID={ids.viewport} style={{ flex: 1 }} onLayout={capture}>
    {children}
    <View ref={dock} collapsable={false} nativeID={ids.dock} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: layout.hostHeight ?? 0 }} onLayout={capture} />
    {ready && !claims ? <DefaultFixedHost scaffold={scaffold} sourceLayout={nativeLayout} isCurrent={current} /> : null}
  </View></HostClaims.Provider></AdminRouteScaffoldContext.Provider>;
}

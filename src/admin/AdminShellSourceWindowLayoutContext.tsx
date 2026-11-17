import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';
import type { AdminSourceDockScaffoldOwner, AdminSourceDockSnapshot } from './AdminSourceDockScaffoldOwner';

type Insets = Readonly<{ top: number; left: number; right: number }>;
export type AdminShellSourceWindowLayoutFacts = Readonly<{
  metrics: AdminSystemInsets | null; thinGestureBottom: boolean | null; safeInsets: Insets | null;
}>;
const Context = createContext<AdminShellSourceWindowLayoutFacts | null>(null);
/** An explicit unknown original-window scope must never fall back to Activity geometry. */
export function adminShellSourceWindowLayout(snapshot: AdminSourceDockSnapshot, thinGestureBottom: boolean | null, available: boolean, current: boolean): AdminShellSourceWindowLayoutFacts {
  const native = current && !snapshot.retired ? snapshot.native : null;
  const viewport = native?.windowIdentity && native.phase !== 'retired' && native.phase !== 'unavailable' ? native.viewport : null;
  const safeInsets = viewport ? Object.freeze({ top: viewport.safeTop, left: viewport.safeLeft, right: viewport.safeRight }) : null;
  return Object.freeze({ safeInsets, thinGestureBottom,
    metrics: available && snapshot.geometryReady && native?.phase === 'bound' && typeof thinGestureBottom === 'boolean' ? native.metrics : null });
}
/** Only the caller's actual Reader-backed original page owner supplies these facts. No synthetic SafeAreaProvider. */
export function AdminShellSourceWindowLayout({ owner, thinGestureBottom, available, children }: {
  owner: AdminSourceDockScaffoldOwner; thinGestureBottom: boolean | null; available: boolean; children: ReactNode;
}) {
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot), current = owner.current(snapshot.generation);
  const value = useMemo(() => adminShellSourceWindowLayout(snapshot, thinGestureBottom, available, current), [snapshot, thinGestureBottom, available, current]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminShellSourceWindowLayout() { return useContext(Context); }

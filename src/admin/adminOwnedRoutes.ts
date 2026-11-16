import type { NavigationAction, NavigationState } from 'expo-router';
import { appRoutes } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminUsersDetailTicket } from './adminUsersController';
import { adminUserDetailRoute, adminUserKinds, adminUserPrincipalRoleFromJson, type AdminUserListEntry } from './adminUsersModel';

export type AdminOwnedRouteTarget = Readonly<
  { kind: 'user'; ticket: AdminUsersDetailTicket } |
  { kind: 'supplier-items'; mode: 'view' | 'add'; supplierRef: string } |
  { kind: 'worker-profile'; entry: AdminUserListEntry } |
  { kind: 'profile' }
>;
export type AdminOwnedRouteParent = Readonly<{ isCurrent: () => boolean; canInteract: () => boolean }>;
export type AdminOwnedRouteEntry = Readonly<{ id: string; target: AdminOwnedRouteTarget; routeName: string;
  isCurrent: () => boolean; canInteract: () => boolean }>;
type Navigation = { getState(): NavigationState | undefined; dispatch(action: NavigationAction): void };
type Entry = { value: AdminOwnedRouteEntry; parent: AdminOwnedRouteParent; generation: number; retired: boolean; checking: boolean;
  closing: boolean; changed: boolean; nativeKey: string | null; attachments: Set<object>; resolve: (changed: boolean) => void };
let routeSequence = 0;

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function userEntry(value: unknown): value is AdminUserListEntry {
  return record(value) && ['id', 'name', 'phone', 'avatar_url', 'principal_role', 'apparatus_display', 'apparatus_id'].every(name => typeof value[name] === 'string') &&
    adminUserPrincipalRoleFromJson(value.principal_role) === value.principal_role && typeof value.kind === 'string' && adminUserKinds.includes(value.kind as AdminUserListEntry['kind']) &&
    typeof value.blocked === 'boolean' && (value.role_label === null || typeof value.role_label === 'string');
}
function captureTarget(value: unknown): { target: AdminOwnedRouteTarget; routeName: string } | null {
  try {
    if (!record(value)) return null; const kind = value.kind;
    if (kind === 'user') {
      const ticket = value.ticket; if (!record(ticket)) return null;
      const item = ticket.item, routeName = ticket.routeName;
      if (!userEntry(item) || typeof routeName !== 'string' || routeName !== adminUserDetailRoute(item)) return null;
      return { target: Object.freeze({ kind: 'user', ticket: Object.freeze({ item, routeName }) }), routeName };
    }
    if (kind === 'supplier-items') {
      const mode = value.mode, supplierRef = value.supplierRef;
      return (mode === 'view' || mode === 'add') && key(supplierRef) ? { target: Object.freeze({ kind, mode, supplierRef }), routeName: mode === 'view' ? appRoutes.adminSupplierItemsView : appRoutes.adminSupplierItemsAdd } : null;
    }
    if (kind === 'worker-profile') { const entry = value.entry; return userEntry(entry) ? { target: Object.freeze({ kind, entry }), routeName: appRoutes.adminWorkerProfileDetail } : null; }
    return kind === 'profile' ? { target: Object.freeze({ kind }), routeName: appRoutes.profile } : null;
  } catch { return null; }
}
function captureParent(value: unknown): AdminOwnedRouteParent | null {
  try { if (!record(value)) return null; const isCurrent = value.isCurrent, canInteract = value.canInteract;
    return typeof isCurrent === 'function' && typeof canInteract === 'function' ? Object.freeze({ isCurrent: isCurrent as () => boolean, canInteract: canInteract as () => boolean }) : null; }
  catch { return null; }
}

/** Original arguments and awaited results for real Admin pushes; no data is serialized into the URL. */
export class AdminOwnedRoutes {
  private active = false; private retired = false; private checking = false; private issuing = false; private generation = 0; private version = 0;
  private readonly entries = new Map<string, Entry>(); private readonly listeners = new Set<() => void>();
  private readonly deps: Readonly<{ isCurrent: () => boolean; canOpen: (route: string) => boolean; push: (id: string) => void; defer?: (callback: () => void) => void }>;
  constructor(deps: AdminOwnedRoutes['deps']) { this.deps = Object.freeze({ ...deps }); }
  getSnapshot = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.version++; for (const listener of [...this.listeners]) { try { listener(); } catch { /* One observer cannot strand an awaited route. */ } } }
  start() { if (this.active || this.retired) return; this.active = true; this.generation++; this.publish(); }
  private current(generation = this.generation): boolean {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const allowed = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!allowed || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  }
  private entryCurrent(entry: Entry): boolean {
    if (entry.retired || this.entries.get(entry.value.id) !== entry || !this.current(entry.generation)) return false;
    if (entry.checking) { this.settle(entry, false); return false; } entry.checking = true;
    const allowed = isSynchronouslyTrue(entry.parent.isCurrent) && isSynchronouslyTrue(() => this.deps.canOpen(entry.value.routeName)); entry.checking = false;
    if (!allowed || entry.retired || !this.current(entry.generation) || this.entries.get(entry.value.id) !== entry) { this.settle(entry, false); return false; } return true;
  }
  get(id: unknown): AdminOwnedRouteEntry | null { const entry = key(id) ? this.entries.get(id) : undefined; return entry && this.entryCurrent(entry) ? entry.value : null; }
  open(target: AdminOwnedRouteTarget, parent: AdminOwnedRouteParent): Promise<boolean> {
    if (this.issuing) return Promise.resolve(false); this.issuing = true;
    try {
      const generation = this.generation, captured = captureTarget(target), original = captureParent(parent);
      if (!captured || !original || !this.current(generation) || !isSynchronouslyTrue(original.isCurrent) || !isSynchronouslyTrue(original.canInteract) ||
        !isSynchronouslyTrue(() => this.deps.canOpen(captured.routeName)) || !this.current(generation)) return Promise.resolve(false);
      const { routeName } = captured, id = String(++routeSequence); let resolve!: (changed: boolean) => void;
      const result = new Promise<boolean>(done => { resolve = done; });
      const entry: Entry = { value: Object.freeze({ id, target: captured.target, routeName, isCurrent: () => this.entryCurrent(entry), canInteract: () => this.entryCurrent(entry) && !entry.closing && entry.attachments.size > 0 }),
        parent: original, generation, retired: false, checking: false, closing: false, changed: false, nativeKey: null, attachments: new Set(), resolve };
      this.entries.set(id, entry);
      try {
        if (!this.entryCurrent(entry) || !isSynchronouslyTrue(original.canInteract) || !this.active || this.retired || generation !== this.generation || this.entries.get(id) !== entry) { this.finish(entry, false); return result; }
        this.deps.push(id); this.entryCurrent(entry);
      }
      catch { this.finish(entry, false); }
      return result;
    } finally { this.issuing = false; }
  }
  /** Attach before admitting the real child view. A StrictMode reconnect keeps the same native route key. */
  mount(id: string, routeKey: string): (() => void) | null {
    const entry = key(id) ? this.entries.get(id) : undefined; if (!entry || !key(routeKey) || !this.entryCurrent(entry) || entry.nativeKey !== null && entry.nativeKey !== routeKey) return null;
    const attachment = {}; entry.nativeKey = routeKey; entry.attachments.add(attachment); this.publish();
    if (!this.entryCurrent(entry) || !entry.attachments.has(attachment)) return null;
    return () => {
      if (!entry.attachments.delete(attachment)) return;
      const finish = () => { if (this.entries.get(id) === entry && entry.nativeKey === routeKey && entry.attachments.size === 0) this.finish(entry, entry.changed); };
      try {
        const scheduled: unknown = (this.deps.defer ?? queueMicrotask)(finish);
        if (scheduled !== null && (typeof scheduled === 'object' || typeof scheduled === 'function')) void Promise.resolve(scheduled).catch(() => queueMicrotask(finish));
      } catch { queueMicrotask(finish); }
    };
  }
  /** Source/target POP removes only this original page, even if another route was pushed meanwhile. */
  pop(id: string, routeKey: string, navigation: Navigation, changed = false): boolean {
    const entry = key(id) ? this.entries.get(id) : undefined; if (!entry || !key(routeKey) || entry.closing || !entry.attachments.size || entry.nativeKey !== routeKey || !this.entryCurrent(entry)) return false;
    try {
      const state = navigation.getState(); if (!state || state.type !== 'stack' || !key(state.key) || !Array.isArray(state.routes) || !Number.isInteger(state.index) || state.index < 0 || state.index >= state.routes.length) return false;
      const index = state.routes.findIndex(route => route.key === routeKey), route = state.routes[index];
      if (index <= 0 || index > state.index || state.routes.filter(route => route?.key === routeKey).length !== 1 || route?.name !== 'owned/[id]' || !record(route.params) || !Object.hasOwn(route.params, 'id') || route.params.id !== id || !this.entryCurrent(entry) || !entry.attachments.size) return false;
      entry.changed = entry.value.target.kind === 'user' && changed === true; entry.closing = true;
      try { navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: routeKey, target: state.key }); }
      catch { if (this.entries.get(id) === entry) { entry.closing = false; entry.changed = false; } return false; }
      if (this.entryCurrent(entry)) this.publish(); return true;
    } catch { return false; }
  }
  private finish(entry: Entry, changed: boolean) {
    if (this.entries.get(entry.value.id) !== entry) return;
    const accepted = changed === true && this.entryCurrent(entry);
    // Authorization callbacks may already have disposed and settled this exact entry.
    if (this.entries.get(entry.value.id) === entry) this.settle(entry, accepted);
  }
  private settle(entry: Entry, changed: boolean) {
    if (this.entries.get(entry.value.id) !== entry) return;
    entry.retired = true; this.entries.delete(entry.value.id); entry.attachments.clear(); entry.resolve(changed === true); this.publish();
  }
  invalidate() { if (this.retired) return; this.retired = true; this.dispose(); }
  dispose() { if (!this.active && !this.entries.size) return; this.active = false; this.generation++; const entries = [...this.entries.values()]; this.entries.clear(); entries.forEach(entry => { entry.retired = true; entry.attachments.clear(); entry.resolve(false); }); this.publish(); }
}

import type { NavigationAction, NavigationState } from 'expo-router';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export type AdminOwnedNavigationAdapter = { getState: () => NavigationState | undefined; dispatch: (action: NavigationAction) => void };
type Stack = NavigationState & { key: string; index: number };
const stack = (value: NavigationState | undefined): value is Stack => !!value && value.type === 'stack' && typeof value.key === 'string' &&
  Array.isArray(value.routes) && Number.isInteger(value.index) && value.index >= 0 && value.index < value.routes.length;
function sameAction(actual: NavigationAction, expected: NavigationAction): boolean {
  const a = actual.payload as { count?: unknown; name?: unknown } | undefined, b = expected.payload as { count?: unknown; name?: unknown } | undefined;
  return actual.type === expected.type && actual.source === expected.source && actual.target === expected.target &&
    (actual.type === 'POP' ? a?.count === b?.count && a?.count === 1 : actual.type === 'POP_TO' && a?.name === b?.name);
}

/** A real dock POP_TO is distinct from source detail Back. Its original active prefix cannot acquire a successor. */
export class AdminOwnedRootRemoval {
  private permit: { action: NavigationAction; keys: readonly string[]; destination: string; generation: number; used: Set<string> } | null = null;
  private generation = 0; private checking = false;
  constructor(private readonly isCurrent: () => boolean) {}
  clear() { this.generation++; this.permit = null; }
  private current(): boolean {
    if (this.checking) { this.clear(); return false; } this.checking = true;
    const allowed = isSynchronouslyTrue(this.isCurrent); this.checking = false; return allowed;
  }
  dispatch(name: 'index' | 'users' | 'activity' | 'chat', navigation: AdminOwnedNavigationAdapter, binding: { routeKey: string; navigatorKey: string }): boolean {
    try {
      if (!this.current()) return false;
      const state = navigation.getState(); if (!stack(state) || state.key !== binding.navigatorKey || state.routes[state.index].key !== binding.routeKey) return false;
      const routes = state.routes.slice(0, state.index + 1), destination = routes.findLastIndex(route => route.name === name);
      if (destination < 0 || destination >= state.index) return false;
      const action: NavigationAction = { type: 'POP_TO', payload: { name }, source: routes.at(-1)!.key, target: state.key };
      const original = { action, keys: Object.freeze(routes.map(route => route.key)), destination: routes[destination].key, generation: ++this.generation, used: new Set<string>() };
      this.permit = original;
      if (!this.current() || this.permit !== original) return false;
      const before = navigation.getState(); if (!stack(before) || before.key !== binding.navigatorKey || before.index + 1 !== original.keys.length || before.routes.slice(0, before.index + 1).some((route, index) => route.key !== original.keys[index])) { this.clear(); return false; }
      if (!this.current() || this.permit !== original) return false;
      navigation.dispatch(action); return true;
    } catch { this.clear(); return false; }
  }
  accept(action: NavigationAction, routeKey: string, navigatorKey: string, navigation: AdminOwnedNavigationAdapter): boolean {
    try {
      const permit = this.permit;
      if (!permit || permit.generation !== this.generation || permit.used.has(routeKey) || !sameAction(action, permit.action) || navigatorKey !== permit.action.target || !this.current()) return false;
      const state = navigation.getState(); if (!stack(state) || state.key !== navigatorKey) return false;
      const routes = state.routes.slice(0, state.index + 1);
      if (routes.length !== permit.keys.length || routes.some((route, index) => route.key !== permit.keys[index])) { this.clear(); return false; }
      const destination = permit.keys.indexOf(permit.destination), original = permit.keys.indexOf(routeKey);
      if (original <= destination || this.permit !== permit || !this.current() || this.permit !== permit) return false;
      permit.used.add(routeKey); return true;
    } catch { this.clear(); return false; }
  }
}

type Dependencies = { id: string; routeKey: string; navigatorKey: string; isCurrent: () => boolean; canInteract: () => boolean;
  navigation: AdminOwnedNavigationAdapter; rootRemoval: AdminOwnedRootRemoval;
  pop: (navigation: AdminOwnedNavigationAdapter, changed: boolean) => boolean };
type Snapshot = Readonly<{ active: boolean; generation: number; permitRemove: boolean }>;

/** Source PopScope invokes the real model Back. Only an exact accepted native action may be repeated. */
export class AdminOwnedRemoval {
  private state: Snapshot = Object.freeze({ active: false, generation: 0, permitRemove: false });
  private expected: { action: NavigationAction; generation: number; repeated: boolean } | null = null;
  private back: { handler: () => unknown; generation: number; ticket: object } | null = null;
  private issuing = false; private checking = false; private invokingBack = false; private readonly listeners = new Set<() => void>();
  private readonly deps: Readonly<Dependencies>;
  constructor(deps: Dependencies) { this.deps = Object.freeze({ ...deps }); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<Snapshot>) { this.state = Object.freeze({ ...this.state, ...patch }); for (const listener of [...this.listeners]) { try { listener(); } catch { /* An observer cannot consume the original native removal decision. */ } } }
  activate() { if (!this.state.active) this.publish({ active: true, generation: this.state.generation + 1, permitRemove: false }); }
  detach() { this.expected = null; this.back = null; this.publish({ active: false, generation: this.state.generation + 1, permitRemove: false }); }
  private current(generation = this.state.generation) {
    if (!this.state.active || generation !== this.state.generation) return false;
    if (this.checking) { this.detach(); return false; } this.checking = true; const allowed = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    return allowed && this.state.active && generation === this.state.generation;
  }
  private bound(top = false): boolean {
    const state = this.deps.navigation.getState(); if (!stack(state) || state.key !== this.deps.navigatorKey) return false;
    const index = state.routes.findIndex(route => route.key === this.deps.routeKey), route = state.routes[index];
    return index > 0 && index <= state.index && (!top || index === state.index) && route.name === 'owned/[id]' &&
      !!route.params && 'id' in route.params && route.params.id === this.deps.id;
  }
  register = (handler: () => unknown): (() => void) => {
    const original = { handler, generation: this.state.generation, ticket: {} }; this.back = original;
    return () => { if (this.back === original) this.back = null; };
  };
  pop(changed: boolean, generation = this.state.generation): boolean {
    if (this.issuing) return false; this.issuing = true;
    try {
      if (!this.current(generation) || !isSynchronouslyTrue(this.deps.canInteract) || !this.bound() || !this.current(generation)) return false;
      const navigation: AdminOwnedNavigationAdapter = { getState: this.deps.navigation.getState, dispatch: action => {
        if (!this.current(generation) || !this.bound() || !this.current(generation) || action.type !== 'POP' || action.source !== this.deps.routeKey || action.target !== this.deps.navigatorKey || (action.payload as { count?: unknown } | undefined)?.count !== 1) throw new Error('Admin owned pop changed');
        this.expected = { action: Object.freeze({ ...action, payload: Object.freeze({ count: 1 }) }), generation, repeated: false };
        this.deps.navigation.dispatch(action);
      } };
      const accepted = this.deps.pop(navigation, changed === true); if (!accepted) this.expected = null; return accepted;
    } catch { this.expected = null; return false; } finally { this.issuing = false; }
  }
  blocked(action: NavigationAction, repeat: () => void, generation = this.state.generation): boolean {
    try {
      if (!this.current(generation) || this.state.permitRemove || !this.bound()) return false;
      const expected = this.expected;
      const explicit = !!expected && expected.generation === generation && !expected.repeated && sameAction(action, expected.action);
      const root = !explicit && this.deps.rootRemoval.accept(action, this.deps.routeKey, this.deps.navigatorKey, this.deps.navigation);
      if (explicit || root) {
        if (expected && explicit) expected.repeated = true;
        this.publish({ permitRemove: true });
        if (!this.current(generation) || !this.bound()) return false;
        repeat(); return true;
      }
      const nativeBack = action.type === 'GO_BACK' || action.type === 'POP' && (action.payload as { count?: unknown } | undefined)?.count === 1;
      const original = this.back;
      if (!nativeBack || action.source !== undefined && action.source !== this.deps.routeKey || action.target !== undefined && action.target !== this.deps.navigatorKey ||
        this.invokingBack || !this.bound(true) || !isSynchronouslyTrue(this.deps.canInteract) || !original || original.generation !== generation || !this.current(generation)) return false;
      this.invokingBack = true; try { original.handler(); return true; } finally { this.invokingBack = false; }
    } catch { return false; }
  }
}

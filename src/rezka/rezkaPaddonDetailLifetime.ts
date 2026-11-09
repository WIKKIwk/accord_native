import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';

/** One original view lifetime; closing it is irreversible and never recaptures a witness. */
export type RezkaPaddonDetailOwner = Readonly<{ close(): void }>;
type Input = Readonly<{ snapshot: RezkaSessionSnapshot; apparatusId: string; code: string }>;
type State = { input: Input; closed: boolean; listeners: Set<() => void>; unregister(): void; unwatch(): void };
const owners = new WeakMap<RezkaPaddonDetailOwner, State>();

function retire(state: State, notify: boolean) {
  if (state.closed) return;
  state.closed = true;
  try { state.unregister(); } catch { /* Retiring the owner must continue. */ }
  try { state.unwatch(); } catch { /* Retiring the owner must continue. */ }
  const notifyListeners = () => {
    for (const listener of state.listeners) {
      try {
        const result: unknown = listener();
        if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
      } catch { /* A view subscriber cannot prevent redaction or a session reset. */ }
    }
    state.listeners.clear();
  };
  if (notify) notifyListeners();
  // A stale owner can also be detected during React render. Retire it now,
  // then notify other mounted fragments after the render rather than inside it.
  else if (state.listeners.size) queueMicrotask(notifyListeners);
}

function sessionCurrent(state: State) {
  const { snapshot } = state.input;
  try { return isRezkaSessionCurrent(snapshot, 'master') && canOpenRoute(snapshot.session, appRoutes.apparatusPaddonDetail); }
  catch { return false; }
}

/** The future host must create one per view and close it on unmount. */
export function createRezkaPaddonDetailOwner(snapshot: RezkaSessionSnapshot, apparatusId: string, code: string): RezkaPaddonDetailOwner {
  const state: State = { input: Object.freeze({ snapshot, apparatusId: apparatusId.trim(), code: code.trim() }),
    closed: false, listeners: new Set(), unregister: () => {}, unwatch: () => {} };
  const owner = Object.freeze({ close: () => retire(state, true) });
  owners.set(owner, state);
  state.unregister = registerSessionResetHook(async () => retire(state, true));
  state.unwatch = subscribeSessionWitness(() => { if (!sessionCurrent(state)) retire(state, true); });
  if (!sessionCurrent(state)) retire(state, false);
  return owner;
}

/** Null for a forged, closed or stale owner. An invalid owner can never be revived. */
export function rezkaPaddonDetailOwnerInput(owner: RezkaPaddonDetailOwner): Input | null {
  const state = owners.get(owner);
  if (!state || state.closed) return null;
  if (!sessionCurrent(state)) { retire(state, false); return null; }
  return state.input;
}

export function subscribeRezkaPaddonDetailOwner(owner: RezkaPaddonDetailOwner, listener: () => void): () => void {
  const state = owners.get(owner);
  if (!state || state.closed) return () => {};
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}

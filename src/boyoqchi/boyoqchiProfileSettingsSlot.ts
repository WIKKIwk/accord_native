import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';

export type BoyoqchiProfileSettingsHandle = { open: () => void };

/** Screen-scoped registration: retained old header callbacks cannot target a new screen or session. */
export function createBoyoqchiProfileSettingsSlot() {
  let current: BoyoqchiProfileSettingsHandle | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const getSnapshot = () => current;
  const register = (session: Session, open: () => void) => {
    const epoch = activeSessionEpoch(session), token = activeSessionToken(session);
    if (epoch === null || !token) return () => {};
    const scope = sessionReadScope(session);
    let focused = true;
    const handle: BoyoqchiProfileSettingsHandle = { open: () => {
      if (focused && current === handle && activeSessionEpoch(session) === epoch && activeSessionToken(session) === token &&
          sessionReadScope(session) === scope) open();
    } };
    current = handle; notify();
    return () => {
      focused = false;
      if (current === handle) { current = null; notify(); }
    };
  };
  return { subscribe, getSnapshot, register };
}
export type BoyoqchiProfileSettingsSlot = ReturnType<typeof createBoyoqchiProfileSettingsSlot>;

import { isSessionWitnessCurrent, type SessionWitness } from '../auth';

export type BoyoqchiProfileSettingsHandle = { open: () => void };

/** Screen-scoped registration: retained old header callbacks cannot target a new screen or session. */
export function createBoyoqchiProfileSettingsSlot() {
  let current: BoyoqchiProfileSettingsHandle | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const getSnapshot = () => current;
  const register = (witness: SessionWitness, open: () => void) => {
    if (!isSessionWitnessCurrent(witness)) return () => {};
    let focused = true;
    const handle: BoyoqchiProfileSettingsHandle = { open: () => {
      if (focused && current === handle && isSessionWitnessCurrent(witness)) open();
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

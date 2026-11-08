import type { BoyoqchiDockAction } from './boyoqchiDockScheduler';

export type BoyoqchiProfileNavigation = { dispatch: (action: BoyoqchiDockAction) => void; isMounted: () => boolean };
export type BoyoqchiProfileNavigationSlot = { current: BoyoqchiProfileNavigation | null };

/** Binds the drawer to the Profile screen's own role-stack navigator while mounted. */
export function registerBoyoqchiProfileNavigation(slot: BoyoqchiProfileNavigationSlot, dispatch: (action: BoyoqchiDockAction) => void) {
  let mounted = true;
  const registration: BoyoqchiProfileNavigation = {
    isMounted: () => mounted && slot.current === registration,
    dispatch: action => { if (mounted && slot.current === registration) dispatch(action); },
  };
  slot.current = registration;
  return () => {
    mounted = false;
    if (slot.current === registration) slot.current = null;
  };
}

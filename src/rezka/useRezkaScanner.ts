import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { RezkaScannerOwner } from './rezkaScannerOwner';

/** A scanner result belongs to a single focused, foregrounded split session and dialog generation. */
export function useRezkaScanner(snapshot: RezkaSessionSnapshot) {
  const owner = useMemo(() => new RezkaScannerOwner(() => isRezkaSessionCurrent(snapshot, 'split')), [snapshot]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useEffect(() => {
    owner.mount(); owner.setForeground(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', value => owner.setForeground(value === 'active'));
    const unregister = registerSessionResetHook(async () => owner.invalidate());
    const unwatch = subscribeSessionWitness(() => owner.recheckSession());
    owner.recheckSession();
    return () => { unwatch(); unregister(); listener.remove(); owner.unmount(); };
  }, [owner]);
  useFocusEffect(useCallback(() => { owner.setFocused(true); return () => owner.setFocused(false); }, [owner]));
  return { state, open: owner.open, isCurrent: owner.isCurrent, accepts: owner.accepts,
    accept: (ticket: number, value: string, generation?: number) => owner.accept(ticket, value, generation), cancel: (ticket?: number) => owner.cancel(ticket) };
}

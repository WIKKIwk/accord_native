import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAdminShell } from './AdminShellContext';

/** Resolve the home opener only when the real child returns, not immediately after push. */
export function useAdminRouteReturn() {
  const { destination, isCurrent } = useAdminShell(), pending = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => { const resolve = pending.current; pending.current = null; resolve?.(); }, []));
  useEffect(() => () => { const resolve = pending.current; pending.current = null; resolve?.(); }, []);
  return useCallback((route: string) => new Promise<void>(resolve => {
    const path = isCurrent() ? destination(route, Platform.OS) : null;
    if (!path || pending.current) { resolve(); return; }
    pending.current = resolve;
    try { router.push(path as Href); } catch { pending.current = null; resolve(); }
  }), [destination, isCurrent]);
}

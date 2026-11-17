import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { useAdminShell } from '../admin/AdminShellContext';
import { useInventorySurface } from '../components/useWorkerInventorySurface';
import { createBrigaderInventorySession } from './brigaderInventorySession';

export function useBrigaderInventorySurface() {
  const shell = useAdminShell();
  const session = useMemo(() => createBrigaderInventorySession(shell.session, shell.witness, shell.isCurrent),
    [shell.session, shell.witness, shell.isCurrent]);
  const state = useSyncExternalStore(session.owner.subscribe, session.owner.getSnapshot, session.owner.getSnapshot);
  useEffect(() => {
    session.store.configure(AppState.currentState == null || AppState.currentState === 'active');
    const foreground = AppState.addEventListener('change', value => { if (session.current()) session.store.configure(value === 'active'); });
    const changed = () => {
      if (!session.current()) session.retire();
      else session.store.configure(AppState.currentState == null || AppState.currentState === 'active');
    }, unsubscribe = subscribeSessionWitness(changed);
    changed(); session.mount();
    return () => { foreground.remove(); unsubscribe(); session.unmount(); };
  }, [session]);
  return useInventorySurface(shell.session, { owner: session.owner, state, scope: session.scope, valid: session.current() });
}

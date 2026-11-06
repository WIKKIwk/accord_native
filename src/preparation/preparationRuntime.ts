import { useEffect } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, currentSession, registerSessionResetHook, type Session } from '../auth';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { productionSnapshotStore } from '../shared/productionSnapshotRuntime';
import { preparationOrders } from './preparationOrdersApi';
import { PreparationOrdersWarmStore } from './preparationOrdersWarmStore';

function enabled(): boolean {
  const session = currentSession();
  return !!session && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
    session.profile.role === 'tayyorlov_masteri' && session.capabilities.includes('preparation.access');
}

export const preparationOrdersWarmStore = new PreparationOrdersWarmStore({
  session: currentSession,
  enabled,
  snapshots: productionSnapshotStore,
  selectionLoader: () => adminSequenceApparatusStore.loadSavedApparatusId(),
  loader: options => {
    const session = currentSession();
    if (!session || !enabled()) throw new Error('Akkaunt o‘zgargan');
    return preparationOrders(session, options);
  },
});

let foreground = AppState.currentState == null || AppState.currentState === 'active';
function synchronize() {
  if (!enabled()) preparationOrdersWarmStore.reset();
  else if (foreground) void preparationOrdersWarmStore.prepare();
}

AppState.addEventListener('change', state => {
  if (state === 'active') { foreground = true; synchronize(); }
  else if (state === 'background') { foreground = false; synchronize(); }
});
registerSessionResetHook(async () => { preparationOrdersWarmStore.reset(); });

// The entry screen receives both restored and newly authenticated sessions.
export function usePreparationRuntime(session: Session | null): void {
  useEffect(() => { synchronize(); }, [session]);
}

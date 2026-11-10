import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, ToastAndroid } from 'react-native';
import { captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness, type Session } from '../auth';
import { activeRezkaPaddon } from '../paddonsApi';
import { setActiveRezkaPaddon } from '../activePaddonSetApi';
import { adminPaddons } from '../paddonManagementApi';
import { sessionReadScope } from '../sessionReadScope';
import { productionDataRevision } from '../shared/productionDataRevisionRuntime';
import { WorkerActivePaddon } from '../workerActivePaddon';
import { useWorkerOrderText } from './useWorkerOrderText';

function createOwner(session: Session, apparatus: string, scope: string) {
  const witness = captureSessionWitness(session);
  let mounted = false, failed = () => {}, observedRevision: string | undefined;
  const current = () => mounted && !!apparatus && isSessionWitnessCurrent(witness) && scope === sessionReadScope(session) && session.assigned_apparatus.some(id => id.trim() === apparatus);
  const controller = new WorkerActivePaddon({ apparatus, current,
    read: guard => activeRezkaPaddon(session, apparatus, guard),
    list: guard => adminPaddons(session, { limit: 200, selectable_only: true, apparatus,
      beforeSend: () => { if (!guard()) throw new Error('worker.error.sync'); } }),
    save: (code, guard) => setActiveRezkaPaddon(session, apparatus, code, guard), failed: () => failed() });
  return { controller, current, mount: (value: boolean) => { mounted = value; }, onFailure: (value: () => void) => { failed = value; },
    revision: (next: string) => { const changed = observedRevision !== undefined && observedRevision !== next; observedRevision = next; if (changed) controller.notify(); } };
}

export function useWorkerActivePaddon(session: Session, apparatus: string, visible: boolean, revision: string) {
  const { p } = useWorkerOrderText(), scope = sessionReadScope(session);
  const owner = useMemo(() => createOwner(session, apparatus, scope), [session, apparatus, scope]);
  const { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [notice, setNotice] = useState<{ owner: typeof owner; message: string } | null>(null);
  useEffect(() => {
    owner.onFailure(() => {
      const message = p('worker.paddon.active.save_failed');
      if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.LONG);
      else setNotice({ owner, message });
    });
  }, [owner, p]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    owner.mount(true);
    const unwatch = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    const app = AppState.addEventListener('change', status => controller.setForeground(status === 'active'));
    controller.setForeground(!AppState.currentState || AppState.currentState === 'active');
    const unsubscribe = productionDataRevision.subscribe(() => { if (productionDataRevision.isCurrentScope) controller.notify(); });
    return () => { owner.mount(false); controller.invalidate(); unwatch(); app.remove(); unsubscribe(); };
  }, [owner, controller]);
  useFocusEffect(useCallback(() => { controller.setVisible(visible); return () => controller.setVisible(false); }, [controller, visible]));
  useEffect(() => { owner.revision(revision); }, [owner, revision]);
  const label = state.selection === 'error' ? p('worker.paddon.active.load_failed') : state.code === null
    ? p('worker.paddon.active.choose') : p('worker.paddon.active.selected', { code: state.code });
  return { state, controller, label, notice: notice?.owner === owner ? notice.message : '' };
}

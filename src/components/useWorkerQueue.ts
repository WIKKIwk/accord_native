import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, sessionWitnessVersion, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { WorkerQueueController } from '../workerQueueController';
import { loadWorkerQueueBaseline, loadWorkerQueueCatalog, loadWorkerQueueSnapshot, type WorkerQueue } from '../workerApi';
import { workerQueueReadCanRetry } from '../workerQueueReadError';
import { subscribeWorkerLive } from '../workerLive';
import { workerQueueWarmStore } from '../workerQueueWarmStore';
import { cancelPendingWorkerQueueSave, flushWorkerQueueSave, forgetWorkerQueue, restoreWorkerQueue, saveWorkerQueue } from '../workerQueueCache';
import { profile } from '../profileApi';
import type { QueueLimit } from '../workerQueueLimit';

/** @v2 _startWorkerLive */
export function useWorkerQueue(session: Session, search: string, limit: QueueLimit, enabled: boolean) {
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const scope = sessionReadScope(session);
  const owners = useRef(new Map<WorkerQueueController, number>());
  const createController = (display: WorkerQueue | null) => new WorkerQueueController(session, search, limit, {
    current: () => !!activeSessionToken(session),
    initial: () => loadWorkerQueueBaseline(session, search, limit),
    snapshot: (since, fresh) => loadWorkerQueueSnapshot(session, search, limit, { since, fresh }),
    catalog: () => loadWorkerQueueCatalog(session),
    live: (get, callbacks) => subscribeWorkerLive(session, search, callbacks.invalidate, callbacks.connection, get,
      callbacks.snapshot, limit, { isCurrent: () => !!activeSessionToken(session) && scope === sessionReadScope(session),
        manageAppState: false, onReady: callbacks.ready, onError: callbacks.error }),
    claim: () => workerQueueWarmStore.claim(session, limit, search),
    release: (lease, queue) => workerQueueWarmStore.release(lease, queue),
    restore: () => restoreWorkerQueue(session, limit, search),
    persist: (queue, flush) => {
      const pending = saveWorkerQueue(session, limit, search, queue);
      if (flush) void flushWorkerQueueSave(session, limit, search);
      return pending;
    },
    cancelPersist: () => cancelPendingWorkerQueueSave(session, limit, search),
    forget: () => forgetWorkerQueue(session, limit, search),
    refreshAssignments: () => profile(session, true),
    retryable: workerQueueReadCanRetry,
  }, workerQueueWarmStore.peek(session, limit, search) ?? display);
  const key = JSON.stringify([scope, search, limit]);
  const [owner, setOwner] = useState(() => ({ session, scope, key, controller: createController(null) }));
  let controller = owner.controller;
  if (owner.session !== session || owner.key !== key) {
    controller = createController(owner.scope === scope ? owner.controller.getSnapshot().queue : null);
    setOwner({ session, scope, key, controller });
  }
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    if (!enabled) return;
    const mounts = owners.current;
    mounts.set(controller, (mounts.get(controller) ?? 0) + 1);
    controller.reserve();
    let foreground = AppState.currentState !== 'background';
    const timer = setTimeout(() => { if (foreground) void controller.start(); }, 0);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && !foreground) { foreground = true; void controller.resume(); }
      else if (next === 'background' && foreground) { foreground = false; controller.pause(); }
    });
    return () => {
      clearTimeout(timer); subscription.remove();
      mounts.set(controller, (mounts.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (!mounts.get(controller)) { mounts.delete(controller); controller.dispose(); } });
    };
  }, [controller, enabled, search]);
  return { ...state, controller, reload: controller.reload };
}

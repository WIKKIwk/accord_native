import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { activeSessionToken, subscribeSessionWitness, type Session } from '../auth';
import { adminReturnScannedWip, adminScannedWips } from '../scannedWipApi';
import { sessionReadScope } from '../sessionReadScope';
import { WorkerScannedWipsController, scannedWipLabels } from '../workerScannedWips';
import { useWorkerOrderText } from './useWorkerOrderText';
import type { WorkerAlertData } from './workerDialogTypes';

export type WorkerScannedWipsProps = { session: Session; apparatus: string; orderId: string; stage: string;
  onClose(): void; onMutationAttempted(): void };

export function useWorkerScannedWips({ session, apparatus, orderId, stage, onMutationAttempted }: WorkerScannedWipsProps) {
  const controller = useMemo(() => {
    const scope = sessionReadScope(session);
    return new WorkerScannedWipsController({ current: () => !!activeSessionToken(session) && scope === sessionReadScope(session),
      canManage: () => session.capabilities.includes('apparatus.queue.manage'),
      read: () => adminScannedWips(session, apparatus, orderId, stage),
      returnWip: item => adminReturnScannedWip(session, apparatus, orderId, stage, item),
    });
  }, [session, apparatus, orderId, stage]);
  useLayoutEffect(() => { controller.setMutationListener(onMutationAttempted); }, [controller, onMutationAttempted]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unsubscribe = subscribeSessionWitness(() => { if (!controller.isCurrent()) controller.invalidate(); });
    return () => { unsubscribe(); controller.deactivate(); };
  }, [controller, session]);
  const { p, t } = useWorkerOrderText();
  const alert: WorkerAlertData | null = state.confirmation ? { title: p('worker.scanned_wip.return'),
    message: `${state.confirmation.qr_payload}\n\n${p('worker.scanned_wip.confirm')}`,
    confirmLabel: p('worker.scanned_wip.return'), cancelLabel: p('worker.cancel_start.back'),
    onConfirm: () => { void controller.confirmReturn(state.confirmation); } } : null;
  const rows = state.items.map(item => {
    const labels = scannedWipLabels(item), canReturn = controller.canReturn(item);
    return { item, key: `${item.session_id}:${item.batch_id}`, title: item.qr_payload || item.batch_id, canReturn,
      details: [p(labels.state), [item.worker_display_name, item.linked_at_unix > 0 ? new Date(item.linked_at_unix * 1000).toLocaleString() : ''].filter(Boolean).join(' · '),
        ...(!canReturn && item.state !== 'returned' ? [p(labels.reason)] : [])].filter(Boolean) };
  });
  return { state, controller, rows, alert, p, t, presentation: {
    fitContent: rows.length === 0,
    canReload: state.phase !== 'loading' && state.phase !== 'invalid' && !state.writing,
    canRetry: state.phase !== 'invalid' && !state.writing,
    loading: state.phase === 'loading',
    failed: state.phase === 'error' || state.phase === 'invalid',
    empty: state.phase === 'ready' && rows.length === 0,
  } };
}

import { captureSessionWitness, isSessionWitnessCurrent, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { adminOpeningWipQrReport } from './admin/openingWipApi';
import { adminProgressQrLookup } from './workerProgressApi';
import { adminLookupOpeningWip } from './workerOpeningWip';
import { adminOrderScanBootstrap } from './workerScanBootstrap';
import { adminProductionMapQueueSnapshot } from './productionMapQueueSnapshotApi';
import { validOrderControl } from './workerOrderLogic';
import { workerFabChanged, workerFabControl, type WorkerFabReads, type WorkerFabContext } from './workerFabQr';

type Obj = Record<string, any>;
const code = (error: unknown) => error && typeof error === 'object' && 'code' in error ? error.code : '';
/** @v2 _loadWorkerFabBootstrap */
export function workerFabQrReads(session: Session, apparatus: string, snapshot: () => Obj | null, alive: () => boolean): WorkerFabReads {
  const scope = sessionReadScope(session), witness = captureSessionWitness(session);
  const current = () => alive() && isSessionWitnessCurrent(witness) && scope === sessionReadScope(session) && session.assigned_apparatus.includes(apparatus);
  const check = () => { if (!current()) throw workerFabChanged(); };
  const context = async (order: string, qr: string): Promise<WorkerFabContext> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      check();
      let bootstrap = await adminOrderScanBootstrap(session, { apparatus, orderId: order, includeContext: true,
        automaticQolipConfirmation: true, ...(qr ? { qrPayload: qr } : {}), current }); check();
      let queue = bootstrap?.queue_context;
      if (!queue) {
        // Only a positively unsupported aggregate or missing additive context uses
        // the older scoped sequence read. Never turn a failed aggregate into fallback.
        queue = await adminProductionMapQueueSnapshot(session, { apparatus, order_id: order, fresh: true, current }); check();
        if (bootstrap) {
          bootstrap = await adminOrderScanBootstrap(session, { apparatus, orderId: order, includeSections: false,
            automaticQolipConfirmation: true, current }); check();
          if (!bootstrap) throw workerFabChanged();
        } else bootstrap = workerFabControl(queue, apparatus, order);
      }
      const state = bootstrap!.control_state, live = snapshot();
      if (state.epoch !== queue.epoch || state.rev !== (queue.revision ?? queue.rev) ||
          !validOrderControl(bootstrap, apparatus, order, live)) continue;
      if (!queue.maps?.some((row: Obj) => row.map?.id === order)) throw workerFabChanged();
      return { snapshot: queue, bootstrap: bootstrap! };
    }
    throw workerFabChanged();
  };
  return { current, snapshot, context,
    identify: async qr => {
      check();
      try { const batch = await adminProgressQrLookup(session, qr, { requireActiveOrder: true, current }); check(); return { batch }; }
      catch (error) {
        check();
        if (!['progress_batch_not_found', 'progress_qr_not_found'].includes(String(code(error)))) throw error;
        try {
          const opening = await adminOpeningWipQrReport(session, qr, check); check();
          const batch = opening.batches.find(batch => batch.qr_payload.trim().toUpperCase() === qr.trim().toUpperCase() || batch.batch_id.trim() === qr.trim());
          if (!batch) return null;
          if (!batch.order_id || opening.intake.order_id !== batch.order_id || opening.intake.status.toLowerCase() !== 'confirmed' ||
              !['waiting', 'in_use', 'processed', 'void'].includes(batch.wip_status.toLowerCase())) throw workerFabChanged();
          return { batch, opening };
        } catch (error) {
          check();
          if ((error as { statusCode?: number })?.statusCode === 404 || ['opening_wip_qr_not_found', 'opening_wip_not_found',
            'opening_wip_qr_mismatch', 'progress_batch_not_found', 'not_found'].includes(String(code(error)))) return null;
          throw error;
        }
      }
    },
    validate: async (wip, qr, orderId) => {
      check();
      const batch = wip.opening ? await adminLookupOpeningWip(session, { apparatus, orderId, qrPayload: qr, current })
        : await adminProgressQrLookup(session, qr, { apparatus, orderId, requireActiveOrder: true, current });
      check(); return batch;
    },
  };
}

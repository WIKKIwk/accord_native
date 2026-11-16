import { MobileApiException } from '../shared/mobileApiException';
import { productionOrderLogFromJson } from '../workerClosedOrders';
import { productionMapDefinitionFromJson } from '../workerProductionMapSaved';
import { progressBatchFromJson } from '../workerProgressBatch';
import { parseApparatusQueueStateMap, productionOrderStatusDetail } from '../workerQueueModels';
import { adminWorkerDetailRunFromJson } from './adminWorkerDetailModel';
import { adminProgressQrCorrectionFromJson, adminProgressQrLineageEdgeFromJson, adminProgressQrList, adminProgressQrObject,
  adminProgressQrOpenedByFromJson, adminProgressQrOptionalObject, adminProgressQrSessionResourcesFromJson, adminProgressQrText } from './adminProgressQrRecords';
import { dartTrim } from './dartJsonString';

/** @v2 AdminProgressQrReport
 * Canonical batch/order/log/queue/run decoders are imported, not replaced by a second model.
 */
export function adminProgressQrReportFromJson(value: unknown) {
  const row = adminProgressQrObject(value), scanned = adminProgressQrOptionalObject(row.scanned_batch);
  if (scanned === null) throw new MobileApiException({ code: 'progress_batch_not_found', message: 'Progress QR topilmadi' });
  const current = adminProgressQrOptionalObject(row.current_batch), order = adminProgressQrOptionalObject(row.order), opened = adminProgressQrOptionalObject(row.opened_by);
  return Object.freeze({ scanned_batch: progressBatchFromJson(scanned), current_batch: current === null ? null : progressBatchFromJson(current),
    is_stale: row.is_stale === true, stale_reason: adminProgressQrText(row.stale_reason), order: order === null ? null : productionMapDefinitionFromJson(order),
    order_status: productionOrderStatusDetail(row.order_status), queue_states: parseApparatusQueueStateMap(row.queue_states),
    logs: Object.freeze(adminProgressQrList(row.logs).map(productionOrderLogFromJson)),
    corrections: Object.freeze(adminProgressQrList(row.corrections).map(adminProgressQrCorrectionFromJson)),
    progress_batches: Object.freeze(adminProgressQrList(row.progress_batches).map(item => progressBatchFromJson(item))),
    run_sessions: Object.freeze(adminProgressQrList(row.run_sessions).map(adminWorkerDetailRunFromJson)),
    active_sessions: Object.freeze(adminProgressQrList(row.active_sessions).map(adminWorkerDetailRunFromJson)),
    opened_by: opened === null ? null : adminProgressQrOpenedByFromJson(opened), history_scope: dartTrim(adminProgressQrText(row.history_scope)), lineage_complete: row.lineage_complete === true,
    lineage_edges: Object.freeze(adminProgressQrList(row.lineage_edges).filter(value => adminProgressQrOptionalObject(value) !== null).map(adminProgressQrLineageEdgeFromJson)),
    current_batches: Object.freeze(adminProgressQrList(row.current_batches).filter(value => adminProgressQrOptionalObject(value) !== null).map(item => progressBatchFromJson(item))),
    session_resources: Object.freeze(adminProgressQrList(row.session_resources).filter(value => adminProgressQrOptionalObject(value) !== null).map(adminProgressQrSessionResourcesFromJson)) });
}
export type AdminProgressQrReport = ReturnType<typeof adminProgressQrReportFromJson>;
/** Legacy entire-order data does not establish this roll's verified provenance. */
export const adminProgressQrHasScopedHistory = (report: AdminProgressQrReport) => report.history_scope === 'batch_lineage';
export function adminProgressQrHistoryBatches(report: AdminProgressQrReport) {
  return adminProgressQrHasScopedHistory(report) ? report.progress_batches : Object.freeze([report.scanned_batch]);
}
export function adminProgressQrHistoryCurrentBatch(report: AdminProgressQrReport) {
  return adminProgressQrHasScopedHistory(report) && report.current_batches.length === 1 ? report.current_batches[0] : null;
}

const s = require('./adminWorkerDetailSupport.cjs');
const progress = s.load('workerProgressBatch', { './workerControlsApi': s.controls, './workerProgressModel': s.load('workerProgressModel') });
const closed = s.load('workerClosedOrders', { './authorizedFetch': {}, './workerControlsApi': s.controls, './workerProgressBatch': progress });
const saved = s.load('workerProductionMapSaved', { './workerControlsApi': s.controls });
const queue = s.load('workerQueueModels', { './workerControlsApi': s.controls });
const records = s.load('admin/adminProgressQrRecords', { './dartJsonString': s.strings });
const report = s.load('admin/adminProgressQrReportModel', { '../shared/mobileApiException': s.exception,
  '../workerClosedOrders': closed, '../workerProductionMapSaved': saved, '../workerProgressBatch': progress,
  '../workerQueueModels': queue, './adminWorkerDetailModel': s.workerModel, './adminProgressQrRecords': records, './dartJsonString': s.strings });
const apparatus = 'apparatus:default:press';
const batch = (batch_id = 'scanned', fields = {}) => ({ batch_id, apparatus, produced_qty: 2, ...fields });
const decode = (fields = {}) => report.adminProgressQrReportFromJson({ scanned_batch: batch(), ...fields });
module.exports = { ...s, records, report, apparatus, batch, decode };

const s = require('./adminProgressQrReportApiSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard'), uri = s.load('admin/dartUri');
const progress = s.load('workerProgressBatch', { './workerControlsApi': s.controls, './workerProgressModel': s.load('workerProgressModel') });
const paddon = s.load('paddonModels', { './workerProgressBatch': progress });
const openingBatch = s.load('workerOpeningWip', { './workerControlsApi': s.controls });
const opening = s.load('workerOpeningWipRecordsApi', { './authorizedFetch': {}, './workerControlsApi': s.controls, './workerOpeningWip': openingBatch });
const rawAssignments = s.load('workerRawMaterials', { './authorizedFetch': {}, './workerControlsApi': s.controls });
const saved = s.load('workerProductionMapSaved', { './workerControlsApi': s.controls });
const queue = s.load('workerQueueModels', { './workerControlsApi': s.controls });
const closed = s.load('workerClosedOrders', { './authorizedFetch': {}, './workerControlsApi': s.controls, './workerProgressBatch': progress });
const raw = s.load('rawMaterialLookupApi', { './apparatusApi': {}, './workerControlsApi': s.controls, './workerRawMaterials': rawAssignments,
  './workerProductionMapSaved': saved, './workerQueueModels': queue, './workerClosedOrders': closed });
const policy = s.load('admin/adminProgressQrFallbackPolicy', { '../shared/mobileApiException': s.exception, './dartJsonString': s.strings });
const model = s.load('admin/adminProgressQrFallbackModel', { '../rawMaterialLookupApi': raw });
function api(transport) {
  const production = s.load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': s.exception, '../workerControlsApi': s.controls });
  return s.load('admin/adminProgressQrFallbackApi', { '../authorizedFetch': transport, '../paddonModels': paddon, '../shared/mobileApiException': s.exception,
    '../shared/camera/synchronousGuard': strict, '../workerOpeningWipRecordsApi': opening, './adminProductionRequest': production,
    './dartJsonString': s.strings, './dartUri': uri });
}
const record = () => ({ intake: { intake_id: ' intake ', actor: { role: 'admin', ref_: ' ref ' } }, batches: [{ batch_id: ' batch ', quantity_basis: 'measured', quantity: 2.5 }] });
function transportFixture(t) {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const session = { token: 'old', baseUrl: 'https://erp.example' }, calls = []; let valid = true, joins = 0, legacy = 0, handler = async () => new Response('{}'), onJoin = () => {};
  const guard = () => { if (!valid) throw Error('original fallback expired'); }, witness = () => { guard(); return true; };
  const transport = s.load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { legacy++; return false; },
    joinRefreshForGuardedRead: async (_session, _token, check) => { joins++; check(); onJoin(); session.token = 'new'; check(); return true; } } });
  const client = api(transport); global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { session, calls, guard, witness, transport, client, handler: value => { handler = value; }, retire: () => { valid = false; }, onJoin: value => { onJoin = value; }, joins: () => joins, legacy: () => legacy,
    read: (kind, qr = '12345', originalWitness = witness) => kind === 'paddon' ? client.adminProgressQrPaddonReport(session, qr, guard, originalWitness) : client.adminProgressQrOpeningWipReport(session, qr, guard, originalWitness) };
}
module.exports = { ...s, strict, policy, model, paddon, opening, raw, api, record, transportFixture };

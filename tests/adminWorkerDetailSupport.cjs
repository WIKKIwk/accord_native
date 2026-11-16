const users = require('./adminUsersSupport.cjs');
const { load, strings, model, checked } = users;
const exception = load('shared/mobileApiException');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const rezka = load('rezka/rezkaMasterApi', { '../authorizedFetch': {}, '../workerControlsApi': controls, './rezkaSessionGuard': {} });
const labels = load('rezka/rezkaWorkerController', { '../workerControlsApi': controls, './rezkaSessionGuard': { RezkaScopeChanged: Error } });
const workerModel = load('admin/adminWorkerDetailModel', { '../workerControlsApi': controls, '../rezka/rezkaMasterApi': rezka,
  '../rezka/rezkaWorkerController': labels, '../workerProgressBatch': { progressBatchFromJson: value => ({ sharedBatch: value }) },
  '../workerClosedOrders': { productionOrderLogFromJson: value => ({ sharedLog: value }) }, './adminUsersModel': model, './dartJsonString': strings });
const errors = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const preparation = load('preparationReadApi', { './authorizedFetch': {}, './workerControlsApi': controls });
const gscale = load('gscale/gscaleAdminApi', { '../authorizedFetch': {}, '../workerControlsApi': controls, '../workerProductionMapSaved': {} });
const controller = load('admin/adminWorkerDetailController', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  './adminWorkerDetailModel': workerModel, './dartJsonString': strings });
const editor = load('admin/adminWorkerDetailEditorController', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  '../shared/mobileApiException': exception, '../qolip/qolipSearchRelevance': load('qolip/qolipSearchRelevance', {
    './qolipSearchEngine': load('qolip/qolipSearchEngine', { '../shared/searchNormalizer': load('shared/searchNormalizer') }) }), './adminWorkerDetailModel': workerModel, './dartJsonString': strings });
const id = 'apparatus:default:press';
const entry = (kind = 'worker', principal_role = 'aparatchi') => Object.freeze({ id: ' ref ', name: 'Entry name', phone: 'entry-phone', kind, principal_role,
  avatar_url: '', role_label: null, apparatus_display: '', apparatus_id: '', blocked: false });
const detail = (fields = {}) => workerModel.adminWorkerDetailFromJson({ id: 'ref', name: 'Loaded name', phone: 'phone', level: 'Level', code: '123', ...fields });
const profile = (fields = {}) => workerModel.adminWorkerDetailProfileFromJson({ worker: detail(), ...fields });
function apiFixture() {
  let valid = true, refreshes = 0, joins = 0; const legacy = [], session = { baseUrl: 'https://server.example', token: 'first' };
  const guard = () => { if (!valid) throw new Error('expired'); }, witness = () => { guard(); return true; };
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { refreshes++; session.token = 'fresh'; return true; },
    joinRefreshForGuardedRead: async () => { joins++; session.token = 'fresh'; return true; } } });
  const uri = load('admin/dartUri');
  const api = load('admin/adminWorkerDetailApi', { '../authorizedFetch': transport, './adminApiError': errors, './adminProductionRequest': checked, './adminWorkerDetailModel': workerModel, './dartUri': uri });
  const assignments = load('admin/adminWorkerDetailAssignmentsApi', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': gscale, '../preparationReadApi': preparation,
    '../shared/mobileApiException': exception, './adminProductionRequest': checked, './adminWorkerDetailModel': workerModel, './adminWorkerDetailApi': api,
    './adminWarehouseSettingsApi': { adminWarehouseSettingsAssignments: async (...args) => { legacy.push(args); args[2]?.(); return []; } }, './dartJsonString': strings, './dartUri': uri });
  return { session, guard, witness, api, assignments, legacy, retire: () => { valid = false; }, counts: () => ({ refreshes, joins }) };
}
module.exports = { ...users, exception, controls, rezka, labels, workerModel, preparation, gscale, controller, editor, id, entry, detail, profile, apiFixture };

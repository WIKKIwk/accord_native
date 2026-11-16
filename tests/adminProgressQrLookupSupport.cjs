const s = require('./adminProgressQrMaterialSupport.cjs');
const transport = s.load('authorizedFetch', { './auth': { activeSessionToken: session => session.token, joinRefreshForGuardedRead: async () => false, refreshSession: async () => false } });
const model = s.load('admin/adminProgressQrLookupModel', { '../authorizedFetch': transport, '../shared/mobileApiException': s.exception,
  './adminProgressQrFallbackPolicy': s.policy, './dartJsonString': s.strings });
const controllerModule = s.load('admin/adminProgressQrLookupController', { '../shared/camera/synchronousGuard': s.strict, './adminProgressQrFallbackModel': s.model,
  './adminProgressQrFallbackPolicy': s.policy, './adminProgressQrLookupModel': model, './dartJsonString': s.strings });
const report = id => s.report.adminProgressQrReportFromJson({ scanned_batch: s.batch(id) });
const paddon = id => s.paddon.paddonSnapshotFromJson({ paddon: { code: id }, items: [], available_items: [] });
const opening = id => s.opening.openingWipRecordFromJson({ ...s.record(), intake: { intake_id: id }, batches: [{ batch_id: id }] });
const material = id => s.model.adminProgressQrMaterialReportFromJson({ barcode: id });
const apiError = (code = 'progress_batch_not_found', statusCode) => new s.exception.MobileApiException({ code, message: code, statusCode });
function fixture({ scanOnly = false, role = 'admin', supported = true } = {}) {
  const calls = [], answers = { primary: async value => report(value), paddon: async value => paddon(value), opening: async value => opening(value), material: async value => material(value), apparatus: async () => [] };
  let current = () => true, focus = () => true, stop = async () => {}, retry = async () => true, phase = () => 'running', returned = () => {}, replaced = () => {};
  const deps = { isCurrent: () => current(), canInteract: () => focus(), scanner: supported ? { stop: async guard => { calls.push(['stop', guard]); guard(); await stop(); guard(); },
    retry: async guard => { calls.push(['retry', guard]); guard(); const result = await retry(); guard(); return result; }, phase: () => phase() } : null,
    returnScan: (...args) => { calls.push(['return', ...args]); args[1](); return returned(...args); }, replaceWorkerQueue: (...args) => { calls.push(['queue', ...args]); args[1](); return replaced(...args); } };
  for (const kind of ['primary', 'paddon', 'opening', 'material']) deps[kind] = async (...args) => { calls.push([kind, ...args]); args[1](); assertWitness(args[2]); const result = await answers[kind](...args); args[1](); return result; };
  deps.apparatus = async (...args) => { calls.push(['apparatus', ...args]); args[0](); assertWitness(args[1]); const result = await answers.apparatus(...args); args[0](); return result; };
  const controller = new controllerModule.AdminProgressQrLookupController(deps, scanOnly, role);
  return { controller, calls, answers, start: () => controller.start(), state: () => controller.getSnapshot(), current: value => { current = value; }, focus: value => { focus = value; },
    stop: value => { stop = value; }, retry: value => { retry = value; }, phase: value => { phase = value; }, returned: value => { returned = value; }, replaced: value => { replaced = value; } };
}
function assertWitness(witness) { if (witness() !== true) throw Error('invalid fixture witness'); }
async function nativeFailure(t, error) { const original = global.fetch; t.after(() => { global.fetch = original; }); global.fetch = async () => { throw error; };
  try { await transport.authorizedProgressQrReportSnapshot({ token: 'token', baseUrl: 'https://erp.example' }, 'QR', () => {}, () => true); } catch (failure) { if (failure !== error) throw failure; } return error; }
module.exports = { ...s, transport, lookupModel: model, controllerModule, report, paddon, opening, material, apiError, fixture, nativeFailure };

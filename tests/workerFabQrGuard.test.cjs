const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(name, mocks) {
  const filename = path.resolve(__dirname, '../src', `${name}.ts`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const station = 'apparatus:default:lamination', session = { token: 'token', profile: { role: 'aparatchi' } };
function setup() {
  const h = { valid: true, scope: 'scope', sends: 0, phase: '' }, current = () => h.valid;
  const auth = { authorizedFetch: async (_s, _path, _init, guard) => {
    guard?.(); h.sends++;
    return { status: 200, text: async () => { if (h.phase === 'body') h.valid = false; return '{}'; }, json: async () => { if (h.phase === 'body') h.valid = false; return { ok: true }; } };
  }, invalidateQueueSnapshotReads: () => {}, currentQueueSnapshotReadEpoch: () => 1 };
  const base = { './authorizedFetch': auth, './sessionReadScope': { sessionReadScope: () => h.scope }, './auth': { activeSessionToken: () => 'token' } };
  const controls = compile('workerControlsApi', base); base['./workerControlsApi'] = controls;
  const progress = compile('workerProgressApi', { ...base, './workerProgressBatch': {}, './productionMapQueueSnapshotApi': {} });
  const opening = compile('workerOpeningWip', base);
  const bootstrap = compile('workerScanBootstrap', { ...base, './workerRawMaterials': {}, './workerProgressBatch': {}, './productionMapSnapshot': {}, './workerQueueAction': {} });
  const queue = compile('productionMapQueueSnapshotApi', { ...base, './productionMapSnapshot': {} });
  h.calls = [
    () => progress.adminProgressQrLookup(session, 'QR', { requireActiveOrder: true, current }),
    () => opening.adminLookupOpeningWip(session, { apparatus: station, orderId: 'order', qrPayload: 'QR', current }),
    () => bootstrap.adminOrderScanBootstrap(session, { apparatus: station, orderId: 'order', current }),
    () => queue.adminProductionMapQueueSnapshot(session, { apparatus: station, order_id: 'order', fresh: true, current }),
    () => controls.adminTemporarilyPauseWork(session, station, 'order', { session_id: 'work', token: 'a'.repeat(64) }, current),
  ]; return h;
}
test('all FAB reads and temporary pause reject an expired owner before any request', async () => {
  const h = setup(); h.valid = false;
  for (const run of h.calls) await assert.rejects(async () => run(), error => error.code === 'session_scope_changed');
  assert.equal(h.sends, 0);
});
test('expired owner while decoding cannot return proof, occupancy or an acknowledged pause', async () => {
  for (let index = 0; index < 5; index++) {
    const h = setup(); h.phase = 'body'; await assert.rejects(h.calls[index], error => error.code === 'session_scope_changed'); assert.equal(h.sends, 1);
  }
});

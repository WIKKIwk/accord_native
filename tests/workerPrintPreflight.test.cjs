const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const logic = load('workerOrderLogic', { './workerControlsApi': controls });
const hold = { hold_id: 'hold', idempotency_key: 'key', order_id: 'order', apparatus: 'apparatus:default:p', status: 'running', revision: 3 };

test('preflight sends the V2 body including optional identifiers and revision', async () => {
  let sent;
  const api = load('workerPrintPreflight', { './workerOrderLogic': logic, './workerControlsApi': {
    WorkerControlException: controls.WorkerControlException,
    postWorkerApiRequest: async (...args) => { sent = args; return { hold }; },
  } });
  const session = {};
  const result = await api.adminPrintPreflight(session, { apparatus: hold.apparatus, order_id: 'order', action: 'hold',
    hold_id: ' hold ', idempotency_key: ' key ', expected_revision: 3 });
  assert.equal(sent[1], '/v1/mobile/admin/production-maps/print-preflight');
  assert.deepEqual(sent[2], { apparatus: hold.apparatus, order_id: 'order', action: 'hold', include_control: true,
    hold_id: 'hold', idempotency_key: 'key', expected_revision: 3 });
  assert.equal(sent[5], 'print_preflight_not_ready');
  assert.deepEqual(result, { hold, control_state: null });
});

test('preflight accepts a committed hold but drops malformed optional controls', () => {
  const api = load('workerPrintPreflight', { './workerOrderLogic': logic, './workerControlsApi': controls });
  assert.equal(api.printPreflightResponse({ hold, control_state: { rev: -1 } }).control_state, null);
  assert.throws(() => api.printPreflightResponse({ hold: { ...hold, idempotency_key: '' } }),
    error => error.code === 'print_preflight_invalid_response');
  assert.equal(api.printPreflightHold({ ...hold, status: ' PASSED ', revision: null }).status, 'passed');
  assert.equal(api.printPreflightHold({ ...hold, revision: -1 }), null);
});

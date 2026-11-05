const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');

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
const stem = 'order_scan_bootstrap_api_test';
const name = 'scan bootstrap synthetic 250ms RTT aggregate=false';
const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
function scan() {
  return JSON.parse(loadContract(stem).find(item => item.test === 'bootstrap sends one scoped GET and passes scanned barcodes').responseBody.text);
}
function setup() {
  const replay = contractFetch(stem, name, { onlyPaths: [
    '/v1/mobile/admin/raw-material-start-requirements', '/v1/mobile/admin/production-maps/qolip-validate',
  ] });
  const session = recordedSession(stem, name);
  const auth = { authorizedFetch: (s, p, init, guard) => {
    guard?.();
    return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } };
  const scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  const materials = load('workerRawMaterials', { './authorizedFetch': auth, './workerControlsApi': controls });
  const logic = load('workerOrderLogic', { './workerControlsApi': controls });
  const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
  const bootstrap = load('workerScanBootstrap', { './authorizedFetch': auth, './workerControlsApi': controls,
    './workerRawMaterials': materials, './workerOrderLogic': logic, './workerProgressBatch': batch });
  const qolips = load('workerQolips', { './workerControlsApi': controls, './workerScanBootstrap': bootstrap });
  return { replay, session, api: load('workerScanSections', { './sessionReadScope': scope, './workerControlsApi': controls,
    './workerRawMaterials': materials, './workerQolips': qolips }), qolips };
}

test('incomplete aggregate sections replay V2 independent material and mold readers', async () => {
  const { replay, session, api } = setup(), value = scan();
  value.sections.materials = { status: 'incomplete' };
  value.sections.qolips = { status: 'incomplete' };
  const result = await api.completeWorkerScanSections(session, value, []);
  assert.equal(result.sections.materials.status, 'ready');
  assert.deepEqual(result.sections.materials.data.assigned_barcodes, ['ROLL1']);
  assert.equal(result.sections.qolips.status, 'ready');
  assert.deepEqual(result.sections.qolips.data.qolip.required_qolip_codes, ['MOLD1']);
  assert.equal(result.control_state.apparatus, station);
  assert.equal(result.control_state.order_id, order);
  replay.assertDone();
});

test('missing automatic confirmation is rejected by the independent qolip decoder', () => {
  const { qolips } = setup();
  assert.throws(() => qolips.parseQolipRequirements({ ok: true }, true),
    error => error.code === 'qolip_automatic_confirmation_invalid');
  assert.deepEqual(qolips.parseQolipRequirements({ ok: true }, false).required_qolips, []);
});

test('legacy scoped queue reader replays the V2 snapshot and retains target authority', async () => {
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/production-maps/sequence'] });
  const session = recordedSession(stem, name);
  const auth = { authorizedFetch: (s, p, init, guard) => {
    guard?.();
    return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } };
  const scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  const logic = load('workerOrderLogic', { './workerControlsApi': controls });
  const queueModels = load('workerQueueModels', { './workerControlsApi': controls });
  const legacy = load('workerLegacyScan', { './authorizedFetch': auth, './sessionReadScope': scope,
    './workerControlsApi': controls, './workerOrderLogic': logic, './workerQueueModels': queueModels });
  const result = await legacy.legacyWorkerScanControl(session, station, order);
  assert.equal(result.control_state.control.state, 'pending');
  assert.equal(result.control_state.rev, 7);
  assert.ok(result.control_state.scope);
  replay.assertDone();
});

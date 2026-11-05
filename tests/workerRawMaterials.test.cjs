const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

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
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  return load('workerRawMaterials', { './authorizedFetch': auth, './workerControlsApi': controls });
}
const station = 'apparatus:default:bosma_7';

test('raw material assignments replay the V2 scoped request and prefer canonical apparatus ID', async () => {
  const stem = 'order_scan_bootstrap_api_test';
  const name = 'bootstrap scoped candidate sections match independent decoders';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-assignments'] });
  const session = recordedSession(stem, name);
  const api = apiWith((s, p, init) => replay(new URL(p, s.baseUrl), {
    ...init, headers: { Authorization: `Bearer ${s.token}` },
  }));
  const rows = await api.adminRawMaterialAssignments(session, ' zakaz-scan-bootstrap ', ` ${station} `);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].apparatus, station);
  assert.equal(rows[0].barcode, 'ROLL1');
  assert.equal(rows[0].received_qty, 12);
  assert.equal(rows[0].remaining_qty, 10);
  assert.equal(rows[0].roll_width_mm, null);
  replay.assertDone();
});

test('material start requirements replay V2 and normalize assignments and barcodes', async () => {
  const stem = 'order_scan_bootstrap_api_test', name = 'scan bootstrap synthetic 250ms RTT aggregate=false';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-start-requirements'] });
  const session = recordedSession(stem, name);
  const api = apiWith((s, p, init) => replay(new URL(p, s.baseUrl), {
    ...init, headers: { Authorization: `Bearer ${s.token}` },
  }));
  const requirements = await api.adminRawMaterialStartRequirements(session, ' zakaz-scan-bootstrap ', ` ${station} `);
  assert.deepEqual(requirements.assigned_barcodes, ['ROLL1']);
  assert.equal(requirements.start_assignments[0].apparatus, station);
  assert.equal(requirements.required_scan_count, 1);
  assert.equal(requirements.scan_satisfied, false);
  replay.assertDone();
  const normalized = api.rawMaterialStartRequirements({ policy: ' REQUIREMENT_GROUPS ', assigned_barcodes: [' a ', 'A', 'b'],
    requirement_groups: [{ requirement_id: ' film ', item_group_ids: [' film ', ''], minimum_required_count: '2' }] });
  assert.equal(normalized.policy, 'requirement_groups');
  assert.deepEqual(normalized.assigned_barcodes, ['A', 'B']);
  assert.deepEqual(normalized.requirement_groups, [{ name: 'film', item_groups: ['film'], min_required_count: 2 }]);
});

test('material candidates and receipt use V2 query, body and typed defaults', async () => {
  const sent = [];
  const api = apiWith(async (_session, url, init) => {
    sent.push({ url, init });
    const row = { apparatus_id: station, order_id: 'order', barcode: 'ROLL1' };
    return { status: 200, json: async () => init.method === 'POST' ? row : [row] };
  });
  const candidates = await api.adminRawMaterialIntakeCandidates({}, ' order ', ` ${station} `);
  assert.deepEqual(Object.fromEntries(new URL(sent[0].url, 'https://example.test').searchParams),
    { order_id: 'order', apparatus: station });
  assert.equal(candidates[0].stock_qty, 0);
  assert.equal(candidates[0].assigned_by_name, '');
  const received = await api.adminReceiveRawMaterialForActiveOrder({}, ' order ', ` ${station} `, ' ROLL1 ');
  assert.equal(sent[1].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent[1].init.body), { order_id: 'order', apparatus: station, barcode: 'ROLL1' });
  assert.equal(received.barcode, 'ROLL1');
});

test('material readers reject malformed apparatus, quantities and non-200 responses', async () => {
  let count = 0;
  const api = apiWith(async () => { count++; return { status: 201, json: async () => ({ error: 'denied' }) }; });
  await assert.rejects(api.adminRawMaterialIntakeCandidates({}, 'order', 'Bosma'), error => error.code === 'apparatus_id_invalid');
  assert.throws(() => api.rawMaterialAssignment({ apparatus: station, stock_qty: '2' }), TypeError);
  await assert.rejects(api.adminRawMaterialAssignments({}, 'order', station), error => error.code === 'denied');
  assert.equal(count, 1);
});

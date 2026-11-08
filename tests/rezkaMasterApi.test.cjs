const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '../src', `${relative}.ts`), loaded = new Module(file, module);
  loaded.filename = file; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id)), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return loaded.exports;
}
const exception = class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } };
const canonical = value => { const id = value.trim(), parts = id.split(':'); return !!id && id.length <= 128 && id === id.toLowerCase() && !/\s/.test(id) && parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean); };
const deps = { '../workerControlsApi': { WorkerControlException: exception, isCanonicalApparatusId: canonical },
  './rezkaSessionGuard': { currentRezkaScope: () => 'scope', guardedRezkaRequest: (_s, _access, _scope, _mutation, send) => send(() => {}) } };
const stem = 'f11910bb/rezka_master_role_test';
const name = 'master can move or add cutting apparatus and cannot save none';

test('selected V2 baseline: master loads workers, retries blocked move and adds a machine', async () => {
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/rezka-master/workers'] });
  const session = recordedSession(stem, name);
  const api = load('rezka/rezkaMasterApi', { ...deps, '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const one = 'apparatus:default:asset-010', two = 'apparatus:default:asset-011', snapshot = { session, epoch: 1, scope: 'scope' };
  let data = await api.rezkaMasterWorkers(session, snapshot);
  assert.deepEqual(data.workers.map(row => row.name), ['Bek', 'Ali']);
  assert.deepEqual(data.assignments[0].assigned_apparatus, [one]);
  await assert.rejects(api.rezkaMasterAssignWorker(session, 'worker-ali', [two], [one], snapshot), e =>
    e.code === 'rezka_worker_has_open_run' && e.statusCode === 409 && e.details[0] === one);
  await api.rezkaMasterAssignWorker(session, 'worker-ali', [two], [one], snapshot);
  data = await api.rezkaMasterWorkers(session, snapshot);
  assert.deepEqual(data.assignments[0].assigned_apparatus, [two]);
  await api.rezkaMasterAssignWorker(session, 'worker-ali', [one, two], [two], snapshot);
  data = await api.rezkaMasterWorkers(session, snapshot);
  assert.deepEqual(data.assignments[0].assigned_apparatus, [one, two]);
  replay.assertDone();
});

test('order settings sends all current and previous values exactly as V2 source', async () => {
  let sent;
  const api = load('rezka/rezkaMasterApi', { ...deps, '../authorizedFetch': { authorizedFetch: async (_s, p, init) => {
    sent = { path: p, ...init }; return new Response(null, { status: 200 });
  } } });
  await api.rezkaMasterSaveOrderSettings({}, ' order ', true, false, false, true, {});
  assert.equal(sent.path, '/v1/mobile/rezka-master/order-settings');
  assert.equal(sent.method, 'PUT'); assert.equal(sent.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent.body), { order_id: ' order ', duplicate_rezka_labels: true, include_bobina_in_net: false,
    previous_duplicate_rezka_labels: false, previous_include_bobina_in_net: true });
});

test('worker and assignment decoding honors V2 defaults, validation and deduplication', () => {
  const api = load('rezka/rezkaMasterApi', { ...deps, '../authorizedFetch': {} });
  assert.deepEqual(api.rezkaWorkerFromJson({ name: 'Ali', phone: ' 123 ' }), { id: '', name: 'Ali', phone: '123', level: '' });
  const id = 'apparatus:default:asset-010';
  assert.deepEqual(api.rezkaAssignmentFromJson({ principal_role: ' APARATCHI ', assigned_apparatus: [` ${id} `, id] }),
    { principal_role: 'aparatchi', principal_ref: '', role_id: '', assigned_apparatus: [id], assigned_item_groups: [] });
  assert.throws(() => api.rezkaAssignmentFromJson({ principal_role: 'unknown' }), /Unsupported/);
  assert.throws(() => api.rezkaAssignmentFromJson({ principal_role: 'aparatchi', assigned_apparatus: ['invalid'] }), /Canonical/);
  assert.throws(() => api.rezkaAssignmentFromJson({ principal_role: 'aparatchi', assigned_item_groups: [1] }), /string/);
});

test('V2 fallback and mapped server errors keep status, code and details', async () => {
  let response = new Response('not json', { status: 503 });
  const api = load('rezka/rezkaMasterApi', { ...deps, '../authorizedFetch': { authorizedFetch: async () => response } });
  await assert.rejects(api.rezkaMasterWorkers({}, {}), e => e.code === 'rezka_workers_load_failed' && e.message === 'Rezka ishchilari yuklanmadi (HTTP 503)' && e.statusCode === 503);
  response = new Response(JSON.stringify({ error: 'rezka_worker_has_open_run', blocked_apparatus_ids: ['apparatus:default:1', 42] }), { status: 409 });
  await assert.rejects(api.rezkaMasterAssignWorker({}, 'w', [], [], {}), e => e.code === 'rezka_worker_has_open_run' && e.details.join() === 'apparatus:default:1');
});

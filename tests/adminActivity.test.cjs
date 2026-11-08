const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dispatch = load('shared/notificationApi', { '../authorizedFetch': {} });
const guards = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
const stem = 'f11910bb/admin_activity_probe_test';
function replayFixture(name) {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('admin/adminActivityApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
    '../shared/notificationApi': dispatch, './adminProductionRequest': guards });
  return { api, session, replay };
}
// These recordings come from a source-derived probe executed against f119, not an existing upstream test.
test('admin activity replays a f119 dispatch-record response', async () => {
  const { api, session, replay } = replayFixture('admin activity reads dispatch records');
  const records = await api.adminActivity(session);
  assert.deepEqual(records.map(item => item.id), ['A', 'B']);
  assert.equal(records[0].supplier_name, 'Test supplier');
  assert.equal(records[0].sent_qty, 12.5);
  assert.equal(records[0].accepted_qty, 3);
  assert.equal(records[0].status, 'accepted');
  assert.equal(records[1].status, 'pending');
  replay.assertDone();
});
test('admin activity reproduces the f119 failure', async () => {
  const { api, session, replay } = replayFixture('admin activity reports a failed response');
  await assert.rejects(api.adminActivity(session), /Admin activity failed/);
  replay.assertDone();
});
test('admin activity validates the list and reuses the shared parser', async () => {
  let payload = [null];
  const api = load('admin/adminActivityApi', { '../authorizedFetch': { authorizedFetch: async () =>
    new Response(JSON.stringify(payload), { status: 200 }) }, '../shared/notificationApi': dispatch, './adminProductionRequest': guards });
  await assert.rejects(api.adminActivity({}), TypeError);
  payload = { id: 'A' }; await assert.rejects(api.adminActivity({}), TypeError);
  payload = [{ status: '\u0085ACCEPTED\u0085' }];
  assert.equal((await api.adminActivity({}))[0].status, 'pending'); // existing native parser behavior; V2 differs
});

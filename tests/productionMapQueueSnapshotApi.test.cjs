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
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) {
  let epoch = 0;
  const authorized = { authorizedFetch: fetch, currentQueueSnapshotReadEpoch: () => epoch, invalidateQueueSnapshotReads: () => epoch++ };
  return { client: load('productionMapQueueSnapshotApi', { './authorizedFetch': authorized,
    './auth': { activeSessionToken: session => session.token } }), invalidate: authorized.invalidateQueueSnapshotReads };
}
const valid = () => JSON.parse(loadContract('order_scan_bootstrap_api_test').find(x => x.test === 'bootstrap decodes context and QR proof in one authorized request').responseBody.text).queue_context;

for (const limit of [5, 0]) test(`queue snapshot replays the worker search window with limit ${limit}`, async () => {
  const stem = 'worker_queue_window_api_test', name = `REST and websocket carry the same search window with limit ${limit}`;
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const { client } = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  const result = await client.adminProductionMapQueueSnapshot(session, { worker_scope: true, queue_limit: limit, queue_search: ' old order ' });
  assert.equal(result.epoch, 'server');
  replay.assertDone();
});

test('snapshot coalesces identical reads while fresh and changed epochs bypass them', async () => {
  let calls = 0, release;
  const hold = new Promise(resolve => { release = resolve; });
  const { client, invalidate } = api(async () => { calls++; await hold; return new Response(JSON.stringify(valid()), { status: 200 }); });
  const session = { token: 'token', baseUrl: 'https://example.test' };
  const first = client.adminProductionMapQueueSnapshot(session), shared = client.adminProductionMapQueueSnapshot(session);
  assert.equal(first, shared);
  const fresh = client.adminProductionMapQueueSnapshot(session, { fresh: true });
  invalidate();
  const afterMutation = client.adminProductionMapQueueSnapshot(session);
  assert.equal(calls, 3);
  release();
  await Promise.all([first, shared, fresh, afterMutation]);
});

test('snapshot preserves a valid cursor on 304 and requests bounded long polling', async () => {
  let url;
  const { client } = api(async (_session, requested) => { url = new URL(requested, 'https://example.test'); return new Response(null, { status: 304 }); });
  const since = { epoch: 'epoch', revision: 7, scope: 'worker' };
  const result = await client.adminProductionMapQueueSnapshot({ token: 't', baseUrl: 'https://example.test' },
    { worker_scope: true, since, wait_for_changes: true });
  assert.equal(result, since);
  assert.equal(url.searchParams.get('if_epoch'), 'epoch');
  assert.equal(url.searchParams.get('if_rev'), '7');
  assert.equal(url.searchParams.get('wait_ms'), '6000');
});

test('a compact snapshot can be reused as the next long-poll cursor', async () => {
  const record = loadContract('worker_list_api_test').find(value => value.test.startsWith('worker HTTP and v2 socket'));
  const wire = JSON.parse(record.responseBody.text);
  let calls = 0, nextUrl;
  const { client } = api(async (_session, requested) => {
    if (++calls === 1) return new Response(JSON.stringify(wire), { status: 200 });
    nextUrl = new URL(requested, 'https://example.test');
    return new Response(null, { status: 304 });
  });
  const session = { token: 't', baseUrl: 'https://example.test', profile: { role: 'aparatchi' } };
  const snapshot = await client.adminProductionMapQueueSnapshot(session, { worker_scope: true });
  const result = await client.adminProductionMapQueueSnapshot(session, { worker_scope: true, since: snapshot, wait_for_changes: true });
  assert.equal(result, snapshot);
  assert.equal(nextUrl.searchParams.get('if_rev'), String(wire.rev));
  assert.equal(nextUrl.searchParams.get('if_scope'), wire.scope);
  assert.equal(nextUrl.searchParams.get('wait_ms'), '6000');
});

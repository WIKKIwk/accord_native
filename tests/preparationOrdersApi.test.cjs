const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(filename, mocks) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
class ApiError extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
function setup(name) {
  const stem = 'preparation_orders_list_test', replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/preparation/orders', '/v1/mobile/preparation/orders/zakaz-1'] });
  const session = recordedSession(stem, name); session.profile = { role: 'tayyorlov_masteri', ref: 'prep' }; session.capabilities = ['preparation.access'];
  const mocks = { '../workerControlsApi': { WorkerControlException: ApiError, isCanonicalApparatusId: id => /^apparatus:[^:]+:.+/.test(id),
      productionMapResponseError: (status, raw, fallback) => new ApiError(raw?.error ?? fallback, fallback, status) },
    '../productionMapSnapshot': { decodeCanonicalProductionMapSnapshot: raw => ({ ...raw, revision: raw.rev }) },
    '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl),
      { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } };
  return { api: load('preparationOrdersApi', mocks), session, replay };
}
// @v2-test test/preparation_orders_list_test.dart
test('server-side search retains canonical positions', async () => {
  const x = setup('master search stays on the server and keeps canonical numbering');
  const first = await x.api.preparationOrders(x.session);
  assert.equal(first.rows[0].position, 11);
  const filtered = await x.api.preparationOrders(x.session, { apparatus: first.apparatus_id, search: ' Master Product 2 ' });
  assert.equal(filtered.rows[0].id, 'zakaz-2'); x.replay.assertDone();
});
// @v2-test test/preparation_orders_list_test.dart
test('read-only detail is fetched only for the selected order', async () => {
  const x = setup('master opens sheet before fetching only the tapped order detail');
  const list = await x.api.preparationOrders(x.session); assert.equal(list.rows[0].id, 'zakaz-1');
  const detail = await x.api.preparationOrderDetail(x.session, 'zakaz-1');
  assert.equal(detail.maps[0].map.id, 'zakaz-1'); x.replay.assertDone();
});
// @v2-test test/preparation_orders_list_test.dart
test('a checkpoint advances revision and delta removes, inserts and reorders rows', async () => {
  const x = setup('master delta adds, removes and reorders without another HTTP read');
  const window = await x.api.preparationOrders(x.session);
  const checkpoint = x.api.preparationOrdersCheckpoint(window, { ...window, rev: 8 }); assert.equal(checkpoint.rev, 8);
  const next = x.api.preparationOrdersDelta(window, { ok: true, projection: 'preparation_order_list_v1', ...window,
    base_version: window.version, version: 'f'.repeat(64), rev: 8, order_ids: ['zakaz-3', 'zakaz-1'], removed_ids: ['zakaz-2'],
    upserts: [{ ...window.rows[1], id: 'zakaz-3', title: 'Master product 3' }, { ...window.rows[0], title: 'Renamed master product', position: 42 }] });
  assert.deepEqual(next.rows.map(row => row.id), ['zakaz-3', 'zakaz-1']); assert.equal(next.rows[1].position, 42);
  assert.throws(() => x.api.preparationOrdersDelta(window, { ...next, base_version: 'missing', order_ids: [], removed_ids: [], upserts: [] }), e => e.code === 'preparation_orders_resync');
  x.replay.assertDone();
});
// @v2-test test/preparation_orders_list_test.dart
test('conditional 304 keeps the cached prefix', async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/preparation_orders_list_test.json'))).records;
  const raw = JSON.parse(fixture.find(r => r.test === 'master checkpoint retains rows, thumbnails and socket' && r.url.includes('/preparation/orders?')).responseBody.text);
  const x = setup('304 preserves an entire restored multi-page master prefix');
  const baseline = x.api.preparationOrderListWindowFromJson(raw);
  const cached = { ...baseline, rows: [...baseline.rows, { ...baseline.rows[0], id: 'zakaz-3' }] };
  const result = await x.api.preparationOrders(x.session, { apparatus: cached.apparatus_id, baseline: cached });
  assert.deepEqual(result.rows, cached.rows); x.replay.assertDone();
});
// The borrowed shared decoder must accept a recorded preparation detail, not just the transport stub.
test('recorded preparation order detail decodes through the shared snapshot parser', () => {
  function loadRoot(name) {
    const filename = path.resolve(__dirname, '../src', name.endsWith('.ts') ? name : `${name}.ts`), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === './authorizedFetch' ? {} : id.startsWith('.') ? loadRoot(path.resolve(path.dirname(filename), id)) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return mod.exports;
  }
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/preparation_orders_list_test.json'))).records;
  const record = fixture.find(r => r.test === 'master opens sheet before fetching only the tapped order detail' && r.url.endsWith('/preparation/orders/zakaz-1'));
  const snapshot = loadRoot('productionMapSnapshot').decodeCanonicalProductionMapSnapshot(JSON.parse(record.responseBody.text));
  assert.equal(snapshot.maps.length, 1); assert.equal(snapshot.maps[0].map.id, 'zakaz-1'); assert.equal(snapshot.revision, 7);
});

test('all-orders mode requests every apparatus and rejects an old machine-scoped server response', async () => {
  const requests = [], session = { baseUrl: 'https://example.test' };
  let all = true;
  const payload = () => ({ ok: true, projection: 'preparation_order_list_v1', scope: 'all', epoch: 'e', version: 'v', rev: 1,
    apparatus_id: all ? '' : 'apparatus:x:y', apparatus: all ? [] : [{ id: 'apparatus:x:y', name: 'Old server' }],
    ...(all ? { all_apparatus: true } : {}), rows: [], total: 0, next_cursor: null });
  const api = load('preparationOrdersApi', {
    '../workerControlsApi': { WorkerControlException: ApiError, isCanonicalApparatusId: id => /^apparatus:/.test(id) },
    '../productionMapSnapshot': {}, '../sessionReadScope': { sessionReadScope: () => 'account' },
    './preparationRequest': { preparationStorageKey: () => 'account', withQuery: (path, query) => `${path}?${new URLSearchParams(query)}` },
    '../authorizedFetch': { authorizedFetch: async (_session, url) => { requests.push(url); return { status: 200, json: async () => payload() }; } },
  });
  const result = await api.preparationOrders(session, { allApparatus: true, apparatus: 'apparatus:ignored', search: ' film ' });
  const url = new URL(requests[0], session.baseUrl);
  assert.equal(url.searchParams.get('all_apparatus'), 'true');
  assert.equal(url.searchParams.has('apparatus'), false);
  assert.equal(url.searchParams.get('search'), 'film');
  assert.equal(result.all_apparatus, true);
  all = false;
  await assert.rejects(api.preparationOrders(session, { allApparatus: true }), error => error.code === 'preparation_orders_mode_unavailable');
});

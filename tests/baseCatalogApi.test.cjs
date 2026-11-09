const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { SearchActivityStore } = load('shared/searchActivityStore');
const session = (role, capabilities, ref = 'U') => ({ profile: { role, ref }, capabilities });
function fixture(fetch) {
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value) };
  const api = load('shared/catalogApi', { '../authorizedFetch': { authorizedFetch: fetch }, './mobileApiException': load('shared/mobileApiException'),
    '../appPreferences': { appPreferences: storage }, './searchActivityStore': { SearchActivityStore } });
  return { ...api, data };
}

test('gscale uses V2 filters, item parsing, and account-scoped search activity', async () => {
  let route;
  const api = fixture(async (s, p) => { route = p; return new Response(JSON.stringify([
    { code: 'Z', name: 'Alpha', order_microns: [12, 'x'], customer_names: [' C ', '', null] },
    { code: 'A', name: 'beta', requires_dimensions: true },
  ]), { status: 200 }); });
  const worker = session('material_taminotchi', ['gscale.print']);
  await api.searchActivityStore.recordItemSelections(worker, [' a ', 'A']);
  const items = await api.gscaleItemsPage(worker, { query: ' PET ', group: ' raw ', orderId: ' ID ', limit: 40, offset: 2 });
  assert.equal(route, '/v1/mobile/gscale/items?q=PET&group=raw&order_id=ID&limit=40&offset=2');
  assert.deepEqual(items.map(i => i.code), ['A', 'Z']);
  assert.deepEqual(items[1].order_microns, [12]);
  assert.deepEqual(items[1].customer_names, ['C', 'null']);
  assert.deepEqual((await api.gscaleItemsPage(session('customer', ['customer.access']), { limit: 0 })).map(i => i.code), ['Z', 'A']);
  assert.equal(route, '/v1/mobile/gscale/items');
  assert.ok(api.data.has('search_item_activity_v1:materialTaminotchi:u'));
});

test('warehouse assignments trim filters, parse role aliases, and reject unknown roles', async () => {
  let route; let body = [{ warehouse: 7, principal_role: ' OMBORCHI ', principal_ref: 12 }];
  const api = fixture(async (s, p) => { route = p; return new Response(JSON.stringify(body), { status: 200 }); });
  assert.deepEqual(await api.adminWarehouseAssignments({}, ' Main '), [{ warehouse: '7', principal_role: 'werka', principal_ref: '12', display_name: '' }]);
  assert.equal(route, '/v1/mobile/admin/warehouses/assignments?warehouse=Main');
  body = [{ principal_role: 'invalid' }];
  await assert.rejects(api.adminWarehouseAssignments({}), /Unsupported user role/);
});

test('catalog operations require status 200', async () => {
  const api = fixture(async () => new Response('', { status: 403 }));
  await assert.rejects(api.gscaleItemsPage(session('admin', [])), error => error.code === 'gscale_items_failed' && error.statusCode === 403);
  await assert.rejects(api.adminWarehouseAssignments({}), /Admin warehouse assignments failed/);
});

test('catalog optional read guard is forwarded without changing default requests', async () => {
  const callbacks = [], guard = () => {};
  const api = fixture(async (_s, _p, _init, beforeSend) => { callbacks.push(beforeSend); beforeSend?.(); return new Response('[]'); });
  const worker = session('material_taminotchi', ['gscale.print']);
  await api.gscaleItemsPage(worker, { limit: 30 }, guard); await api.gscaleItemsPage(worker, { limit: 30 });
  assert.equal(callbacks[0], guard); assert.equal(callbacks[1], undefined);
});

test('isolated picker sorter cannot overwrite the shared account activity after a late old-account load', async () => {
  let release, entered, active = true; const started = new Promise(resolve => { entered = resolve; });
  const storage = { getItem: async key => { if (key.endsWith(':old')) { entered(); return new Promise(resolve => { release = resolve; }); }
    return key.endsWith(':new') ? '{"z":9}' : null; }, setItem: async () => {} };
  const api = load('shared/catalogApi', { '../authorizedFetch': { authorizedFetch: async (_s, _p, _init, beforeSend) => {
    beforeSend?.(); return new Response(JSON.stringify([{ code: 'A', name: 'Alpha' }, { code: 'Z', name: 'Zulu' }])); } },
    './mobileApiException': load('shared/mobileApiException'), '../appPreferences': { appPreferences: storage }, './searchActivityStore': { SearchActivityStore } });
  const old = session('admin', ['admin.access'], 'old'), current = session('admin', ['admin.access'], 'new');
  const isolated = new SearchActivityStore(storage), guard = () => { if (!active) throw new Error('stale scope'); };
  const pending = api.gscaleItemsPage(old, { limit: 30 }, guard, isolated); await started;
  assert.deepEqual((await api.gscaleItemsPage(current)).map(item => item.code), ['Z', 'A']);
  active = false; release('{"a":20}'); await assert.rejects(pending, /stale scope/);
  assert.deepEqual((await api.gscaleItemsPage(current)).map(item => item.code), ['Z', 'A']);
});

test('catalog guarded 401 retry stops after an account transition', async () => {
  const original = global.fetch; let allowed = true, sends = 0;
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: s => s.token,
    refreshSession: async () => { allowed = false; return true; } } });
  global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  try {
    const api = fixture(transport.authorizedFetch), s = { ...session('admin', ['admin.access']), token: 'token', baseUrl: 'https://example.test' };
    await assert.rejects(api.gscaleItemsPage(s, {}, () => { if (!allowed) throw new Error('scope changed'); }), /scope changed/);
    assert.equal(sends, 1);
  } finally { global.fetch = original; }
});

test('catalog checks the guard again before touching the activity sorter', async () => {
  let active = true, sorts = 0;
  const api = fixture(async (_s, _p, _init, beforeSend) => { beforeSend(); active = false; return new Response('[]'); });
  const activity = { sortByItemCode: async () => { sorts++; return []; } }, s = session('admin', ['admin.access']);
  await assert.rejects(api.gscaleItemsPage(s, {}, () => { if (!active) throw new Error('scope changed'); }, activity), /scope changed/);
  assert.equal(sorts, 0);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(name.slice(0, name.lastIndexOf('/') + 1) + id.slice(2), mocks)
    : id.startsWith('../') ? load(path.posix.normalize(name.slice(0, name.lastIndexOf('/') + 1) + id), mocks) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture({ response = { template: { source_map_id: 'o', width_mm: 100 } }, status = 200, duringBody = () => {} } = {}) {
  const calls = [], client = load('admin/adminOrderSummaryApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init, guard) => {
    calls.push({ session, url, init, guard }); guard();
    return { status, json: async () => { duringBody(); return response; } };
  } }, './authorizedFetch': { authorizedFetch() { throw Error('unused Worker read'); } } });
  return { calls, read: client.adminProductionMapOrderSummary };
}
test('summary uses exact source GET query, guarded existing transport and real shared calculation parser', async () => {
  const f = fixture({ response: { template: { source_map_id: 'o & 2', width_mm: 100, frame_count: 2, kg: 20,
    products: [{ id: 'p', item_code: 'P', product: 'Film', frame_count: 3, frame_product_size_mm: 10 }],
    layers: [{ material: 'PE', micron: '30' }], note: 'Note' } } }), session = {};
  let checks = 0; const result = await f.read(session, '\u0085o & 2\u0085', () => { checks++; });
  assert.equal(result.source_map_id, 'o & 2'); assert.equal(result.frame_count, 2); assert.equal(result.products[0].frame_count, 3);
  assert.deepEqual(result.effective_layers, [{ material_id: '', material: 'PE', micron: '30' }]);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].session, session); assert.equal(f.calls[0].init, undefined);
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/order-summary?id=o+%26+2'); assert.ok(checks >= 5);
});
test('saved summary frame count never infers one from width or parses numeric text', async () => {
  for (const [raw, expected] of [[undefined, 0], ['3', 0], [null, 0], [2.5, 2.5], [0, 0]]) {
    const f = fixture({ response: { template: { source_map_id: 'o', width_mm: 100, frame_count: raw } } });
    assert.equal((await f.read({}, 'o', () => {})).frame_count, expected);
  }
});
test('malformed envelope and mismatched summary identity fail instead of yielding another order calculation', async () => {
  for (const response of [[], {}, { template: [] }, { template: null }]) {
    const f = fixture({ response }); await assert.rejects(f.read({}, 'o', () => {}), /Invalid order summary/); assert.equal(f.calls.length, 1);
  }
  const f = fixture({ response: { template: { source_map_id: 'other', width_mm: 100 } } });
  await assert.rejects(f.read({}, 'o', () => {}), /Order summary identity mismatch/);
});
test('source error uses the existing Admin production error path and fallback', async () => {
  const f = fixture({ status: 404, response: { error: 'order_summary_missing', message: 'Buyurtmaning saqlangan hisob-kitobi topilmadi' } });
  await assert.rejects(f.read({}, 'o', () => {}), error => error.code === 'order_summary_missing' && error.statusCode === 404);
});
test('a missing, asynchronous or already-stale guard cannot authorize a summary request', async () => {
  for (const guard of [undefined, async () => {}, async () => { throw Error('rejected asynchronous witness'); }, () => { throw new Error('stale'); }]) {
    const f = fixture(); await assert.rejects(f.read({}, 'o', guard)); assert.equal(f.calls.length, 0);
  }
  await new Promise(resolve => setImmediate(resolve));
});
test('body-time scope loss cannot return even a correct calculation and has no retry', async () => {
  let current = true;
  const f = fixture({ duringBody: () => { current = false; } });
  await assert.rejects(f.read({}, 'o', () => { if (!current) throw Error('scope changed'); }), /scope changed/);
  assert.equal(f.calls.length, 1);
});
for (const changed of [false, true]) test(`summary ${changed ? 'blocks a stale' : 'allows the unchanged-scope'} 401 retry through real authorizedFetch`, async () => {
  const session = { baseUrl: 'https://server.example', token: 'old' }; let current = true;
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: value => value.token,
    refreshSession: async () => { session.token = 'new'; if (changed) current = false; return true; } } });
  const client = load('admin/adminOrderSummaryApi', { '../authorizedFetch': transport, './authorizedFetch': transport });
  const prior = global.fetch, sent = [];
  global.fetch = async (_url, init) => {
    sent.push(new Headers(init.headers).get('authorization'));
    return sent.length === 1 ? new Response('', { status: 401 })
      : { status: 200, json: async () => ({ template: { source_map_id: 'o' } }) };
  };
  try {
    const result = client.adminProductionMapOrderSummary(session, 'o', () => { if (!current) throw Error('scope changed'); });
    if (changed) await assert.rejects(result, /scope changed/); else assert.equal((await result).source_map_id, 'o');
    assert.deepEqual(sent, changed ? ['Bearer old'] : ['Bearer old', 'Bearer new']);
  } finally { global.fetch = prior; }
});

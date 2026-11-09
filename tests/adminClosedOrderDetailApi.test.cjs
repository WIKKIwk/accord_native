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
    : id.startsWith('../') ? load(path.posix.normalize(name.slice(0, name.lastIndexOf('/') + 1) + id), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture({ status = 200, response = { order_id: 'o', logs: [] }, duringBody = () => {} } = {}) {
  const calls = [], client = load('admin/adminClosedOrderDetailApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init, guard) => {
    calls.push({ session, url, init }); guard(); return { status, json: async () => { duringBody(); return response; } };
  } }, './authorizedFetch': { authorizedFetch() { throw Error('unconnected shared reader'); } } });
  return { calls, read: client.adminClosedOrderDetail };
}
test('guarded Closed detail replays the recorded V2 one-order GET and shared decoder', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'admin_order_page_api_test', name = 'closed detail fetches one order only', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('admin/adminClosedOrderDetailApi', { '../authorizedFetch': { authorizedFetch: async (s, p, init, guard) => {
    guard(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${s.token}` } });
  } }, './authorizedFetch': { authorizedFetch() { throw Error('unconnected shared reader'); } } });
  const result = await client.adminClosedOrderDetail(session, 'zakaz-42', () => {});
  assert.equal(result.order_id, 'zakaz-42'); assert.deepEqual(result.logs, []); replay.assertDone();
});
test('Closed detail preserves the untrimmed ID, source error path and early-close decoding', async () => {
  const f = fixture({ response: { order_id: ' a&b ', early_close: { closed_at_unix: 2, comment: 'reason' } } }); let checks = 0;
  const result = await f.read({}, ' a&b ', () => { checks++; });
  assert.equal(new URL(f.calls[0].url, 'https://example.test').searchParams.get('id'), ' a&b ');
  assert.equal(result.logs[0].action, 'close_early'); assert.equal(result.logs[0].issue_note, 'reason'); assert.ok(checks >= 5);
  const failure = fixture({ status: 404, response: { error: 'closed_order_failed', message: 'Tarix yo‘q' } });
  await assert.rejects(failure.read({}, 'o', () => {}), error => error.code === 'closed_order_failed' && error.statusCode === 404);
});
test('Closed detail requires a strict current guard and rejects body-time scope loss', async () => {
  for (const guard of [undefined, async () => {}, async () => { throw Error('rejected witness'); }, () => { throw Error('stale'); }]) {
    const f = fixture(); await assert.rejects(f.read({}, 'o', guard)); assert.equal(f.calls.length, 0);
  }
  await new Promise(resolve => setImmediate(resolve)); let current = true;
  const f = fixture({ duringBody: () => { current = false; } });
  await assert.rejects(f.read({}, 'o', () => { if (!current) throw Error('scope changed'); }), /scope changed/); assert.equal(f.calls.length, 1);
});
for (const changed of [false, true]) test(`Closed detail ${changed ? 'blocks stale' : 'allows current'} 401 retry through the existing transport`, async () => {
  const session = { baseUrl: 'https://server.example', token: 'old' }; let current = true;
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: value => value.token,
    refreshSession: async () => { session.token = 'new'; if (changed) current = false; return true; } } });
  const client = load('admin/adminClosedOrderDetailApi', { '../authorizedFetch': transport, './authorizedFetch': transport });
  const prior = global.fetch, sent = [];
  global.fetch = async (_url, init) => {
    sent.push(new Headers(init.headers).get('authorization'));
    return sent.length === 1 ? new Response('', { status: 401 }) : { status: 200, json: async () => ({ order_id: 'o', logs: [] }) };
  };
  try {
    const result = client.adminClosedOrderDetail(session, 'o', () => { if (!current) throw Error('scope changed'); });
    if (changed) await assert.rejects(result, /scope changed/); else assert.equal((await result).order_id, 'o');
    assert.deepEqual(sent, changed ? ['Bearer old'] : ['Bearer old', 'Bearer new']);
  } finally { global.fetch = prior; }
});

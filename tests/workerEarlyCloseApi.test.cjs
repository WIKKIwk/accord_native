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
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('workerEarlyCloseApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// @v2-test test/admin_order_early_close_test.dart
for (const state of ['freeze_requested', 'frozen']) {
  test(`early close API sends only order action and comment: ${state}`, async () => {
    const stem = 'admin_order_early_close_test', name = `early close API sends only order action and comment: ${state}`;
    const replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
    assert.equal(await client.adminEarlyCloseProductionOrder(session, { order_id: ' zakaz-1 ', comment: ' Muammo ' }), state);
    replay.assertDone();
  });
}
for (const code of ['order_not_started', 'order_already_completed', 'early_close_comment_required_or_too_long',
  'order_freeze_target_not_found', 'order_freeze_target_ambiguous', 'order_freeze_requested', 'order_frozen', 'order_control_action_not_allowed']) {
  test(`early close errors describe closure instead of freezing: ${code}`, async () => {
    const stem = 'admin_order_early_close_test', name = `early close errors describe closure instead of freezing: ${code}`;
    const replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
    await assert.rejects(client.adminEarlyCloseProductionOrder(session, { order_id: 'zakaz-0009', comment: 'Mijoz rad etdi' }), error =>
      error.code === code && !error.message.includes('muzlat') && error.message !== code);
    replay.assertDone();
  });
}

test('early close validates Unicode comments and requires a valid returned control', async () => {
  let calls = 0, body = { control: { state: 'frozen', early_close: {} } };
  const client = api(async () => { calls++; return new Response(JSON.stringify(body), { status: 200 }); });
  await assert.rejects(client.adminEarlyCloseProductionOrder({}, { order_id: '1', comment: '  ' }), error => error.code === 'early_close_comment_invalid');
  await assert.rejects(client.adminEarlyCloseProductionOrder({}, { order_id: '1', comment: '😀'.repeat(2001) }), error => error.code === 'early_close_comment_invalid');
  assert.equal(calls, 0);
  assert.equal(await client.adminEarlyCloseProductionOrder({}, { order_id: '1', comment: '😀'.repeat(2000) }), 'frozen');
  body = { control: { state: 'open', early_close: {} } };
  await assert.rejects(client.adminEarlyCloseProductionOrder({}, { order_id: '1', comment: 'valid' }), error => error.code === 'order_control_invalid_response');
  body = { control: { state: 'frozen' } };
  await assert.rejects(client.adminEarlyCloseProductionOrder({}, { order_id: '1', comment: 'valid' }), error => error.code === 'order_control_invalid_response');
});

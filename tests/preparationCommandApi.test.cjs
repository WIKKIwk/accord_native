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
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id), mocks);
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
function setup(name) {
  const replay = contractFetch('preparation_test', name, { generated: ['request_id'] });
  const session = recordedSession('preparation_test', name);
  session.profile = { role: 'tayyorlov_masteri', ref: 'prep-1' }; session.capabilities = ['preparation.access'];
  const stored = new Map(), sent = [];
  const api = load('preparationCommandApi', {
    'expo-crypto': { getRandomBytesAsync: async n => new Uint8Array(n).fill(0x42) },
    'expo-sqlite/kv-store': { getItem: async key => stored.get(key) ?? null, setItem: async (key, value) => { stored.set(key, value); },
      removeItemAsync: async key => stored.delete(key) },
    '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } },
    '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); sent.push(JSON.parse(init.body));
      return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } },
  });
  return { api, session, replay, stored, sent };
}
const payload = { item_code: 'P1', warehouse: 'Tayyorlov ombori', kg: '60.000000' };
// @v2-test test/preparation_test.dart
test('lost receipt response retries the identical stored command', async () => {
  const { api, session, replay, sent } = setup('receipt retry survives lost response and keeps request id');
  await assert.rejects(api.preparationSubmit(session, 'receipts', payload));
  const pending = await api.preparationPendingCommand(session);
  assert.match(pending.request_id, /^prep-\d+-[0-9a-f]{32}$/);
  await assert.rejects(api.preparationSubmit(session, 'receipts', { ...payload, kg: '70' }), e => e.code === 'pending_preparation');
  await api.preparationSubmit(session, pending.kind, pending.payload);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(await api.preparationPendingCommand(session), null); replay.assertDone();
});
// @v2-test test/preparation_test.dart
test('GScale receipt and reversal use their dedicated endpoints', async () => {
  let x = setup('GScale simple receipt uses its isolated endpoint');
  assert.equal((await x.api.gscaleSimpleMaterialReceipt(x.session, payload)).qr_printed, false); x.replay.assertDone();
  x = setup('receipt reversal uses its dedicated preparation endpoint');
  assert.equal((await x.api.preparationReverseReceipt(x.session, 'receipt-1', 'Xato miqdor')).kind, 'receipt_reversal'); x.replay.assertDone();
});
// @v2-test test/preparation_test.dart
test('definitive rejection discards pending command, auth failure retains it', async () => {
  let x = setup('insufficient stock response is displayed and is not left pending');
  await assert.rejects(x.api.preparationSubmit(x.session, 'receipts', payload), e => e.message === 'Qoldiq yetarli emas');
  assert.equal(await x.api.preparationPendingCommand(x.session), null); x.replay.assertDone();
  x = setup('parallel client saves are blocked and auth errors preserve retry state');
  await assert.rejects(x.api.preparationSubmit(x.session, 'receipts', payload));
  assert.ok(await x.api.preparationPendingCommand(x.session)); x.replay.assertDone();
});
// @v2-test test/preparation_test.dart
test('pending commands are isolated by account', async () => {
  const x = setup('pending commands are isolated by account');
  await assert.rejects(x.api.preparationSubmit(x.session, 'receipts', payload));
  x.session.profile.ref = 'prep-2'; assert.equal(await x.api.preparationPendingCommand(x.session), null);
  x.session.profile.ref = 'prep-1'; assert.ok(await x.api.preparationPendingCommand(x.session)); x.replay.assertDone();
});
// @v2-test test/preparation_test.dart
test('concurrent saves are blocked before the first response', async () => {
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const x = setup('parallel client saves are blocked and auth errors preserve retry state');
  const original = x.api;
  // A slow storage operation holds the same global in-flight lock as a slow HTTP response.
  const hold = new Map();
  const api = load('preparationCommandApi', {
    'expo-crypto': { getRandomBytesAsync: async n => new Uint8Array(n) },
    'expo-sqlite/kv-store': { getItem: async key => hold.get(key) ?? null, setItem: async (key, value) => { hold.set(key, value); }, removeItemAsync: async key => hold.delete(key) },
    '../workerControlsApi': { WorkerControlException: class extends Error {} },
    '../authorizedFetch': { authorizedFetch: async () => { started(); await waiting; return new Response('{}', { status: 200 }); } },
  });
  assert.ok(original);
  const first = api.preparationSubmit(x.session, 'receipts', payload);
  await entered;
  await assert.rejects(api.preparationSubmit(x.session, 'receipts', payload), /Saqlash davom etmoqda/);
  release(); await first;
});

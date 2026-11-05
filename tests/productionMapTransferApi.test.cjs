const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
function client(replay) {
  const values = new Map(), storage = { getItem: async k => values.get(k) ?? null, setItem: async (k, v) => { values.set(k, v); }, removeItem: async k => { values.delete(k); } };
  const mocks = { 'expo-sqlite/kv-store': { __esModule: true, default: storage }, './authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } };
  const store = load('apparatusTransferCommandStore', mocks);
  return load('productionMapTransferApi', { ...mocks, './apparatusTransferCommandStore': store });
}
const stem = 'apparatus_transfer_retry_test';
const input = key => ({ order_id: 'zakaz-transfer-retry', from_apparatus: 'apparatus:default:bosma_7', to_apparatus: 'apparatus:default:bosma_8', reason: `Reason ${key}`, idempotency_key: key });
test('lost response retains exact command until acknowledged', async () => {
  const name = 'lost response retains exact command until acknowledged', replay = contractFetch(stem, name), session = recordedSession(stem, name), api = client(replay);
  await assert.rejects(api.adminTransferProductionMapOrder(session, input('original-key')));
  await api.adminTransferProductionMapOrder(session, input('different-key'));
  await api.adminTransferProductionMapOrder(session, input('next-operation'));
  replay.assertDone();
});
test('definitive rejection clears command; server failure retains it', async () => {
  const name = 'definitive rejection clears command; server failure retains it', replay = contractFetch(stem, name), session = recordedSession(stem, name), api = client(replay);
  await assert.rejects(api.adminTransferProductionMapOrder(session, input('attempt-409')));
  await api.adminTransferProductionMapOrder(session, input('retry-409'));
  await assert.rejects(api.adminTransferProductionMapOrder(session, input('attempt-503')));
  await api.adminTransferProductionMapOrder(session, input('retry-503'));
  replay.assertDone();
});

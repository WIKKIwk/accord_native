const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('Customer runtime binds both API readers to the current session and shared delivery store', async () => {
  const calls = [], runtime = {}, session = { profile: { role: 'customer', ref: 'one' } };
  class FakeStore { constructor(api, sharedRuntime) { this.api = api; this.runtime = sharedRuntime; } }
  const filename = path.resolve(__dirname, '../src/customer/customerRuntime.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const mocks = { './customerApi': { customerSummary: async s => { calls.push(['summary', s]); return {}; },
    customerStatusDetails: async (s, kind) => { calls.push(['status', s, kind]); return []; } },
  './customerStore': { CustomerStore: FakeStore }, '../shared/notificationStoresRuntime': { customerDeliveryRuntimeStore: runtime } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const store = mod.exports.createCustomerStore(session);
  assert.equal(store.runtime, runtime); await store.api.customerSummary(); await store.api.customerStatusDetails('rejected');
  assert.deepEqual(calls, [['summary', session], ['status', session, 'rejected']]);
});

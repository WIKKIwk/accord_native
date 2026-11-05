const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const models = load('inventoryModels', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
const query = load('shared/inventoryViewQuery', { '../inventoryModels': models });
const storeModule = load('shared/inventoryViewStore', { './inventoryViewQuery': query });

test('runtime uses the V2 live subscription and clears its shared store on account reset', async () => {
  const OldWebSocket = global.WebSocket; const sockets = []; let reset;
  global.WebSocket = class { constructor(url) { this.url = url; this.closed = false; sockets.push(this); } close() { this.closed = true; } };
  try {
    const session = { baseUrl: 'https://example.test', token: 'token', profile: { role: 'aparatchi', ref: 'one' }, capabilities: [], assigned_apparatus: [] };
    const api = load('shared/inventoryViewRuntime', { '../auth': { activeSessionToken: s => s.token,
      registerSessionResetHook: hook => { reset = hook; return () => {}; } },
      '../inventoryReadApi': { inventoryAssets: async () => [], inventoryLocations: async () => [], inventoryTransfers: async () => [] },
      '../sessionReadScope': { sessionReadScope: () => 'scope' }, './inventoryViewStore': storeModule });
    const store = api.inventoryViewRuntimeFor(session);
    assert.equal(api.inventoryViewRuntimeFor(session), store);
    const lease = store.assets({ currentUserStatesOnly: true });
    const url = new URL(sockets[0].url);
    assert.equal(url.protocol, 'wss:'); assert.equal(url.pathname, '/v1/mobile/admin/inventory/live');
    assert.equal(url.searchParams.get('token'), 'token');
    assert.deepEqual(JSON.parse(url.searchParams.get('subscriptions'))[0].query,
      { current_user_states_only: true, include_order_assignment: true, limit: 100 });
    sockets[0].onmessage({ data: JSON.stringify({ event: 'inventory.snapshot', id: 'window', epoch: 'e', revision: 0, version: 'v', rows: [] }) });
    await lease.ready; assert.equal(lease.trusted, true);
    await reset(); assert.equal(lease.rows, null); assert.equal(sockets[0].closed, true); lease.dispose();
  } finally { global.WebSocket = OldWebSocket; }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
class WorkerControlException extends Error { constructor(code, message) { super(message); this.code = code; } }
const controls = { WorkerControlException, isCanonicalApparatusId: id => id.startsWith('apparatus:'), productionMapResponseError: () => new Error('server error') };
const pageBody = { projection: 'orders_list_v1', version: 'v1', epoch: 'e1', rev: 1, scope: 's1', offset: 0, total: 0,
  next_cursor: null, order_ids: [], pending_ids: [], rows: {}, pending_rows: {} };
const snapshot = { maps: [{ map: { id: 'order-1' } }], revision: 1, epoch: 'e1', scope: 's1', calculation_templates: {} };
const pendingBody = { id: 'order-1', template: {} };
const deps = {
  './workerControlsApi': controls,
  './productionMapSnapshot': { decodeCanonicalProductionMapSnapshot: () => snapshot },
  './workerQueueModels': { parseApparatusQueuePolicyMap: () => ({}) },
  './workerClosedOrders': { closedProductionOrderFromJson: x => x },
  './productionMapAuditApi': { productionWorkflowAuditReportFromJson: x => x },
  './workerOpenedOrderEditApi': { calculateOrderTemplateFromJson: x => x },
  './pendingOrderApi': { pendingOrderFromJson: x => x },
  './productionReadSettings': { adminProductionReadIdentityCompression: false },
};
const kinds = [
  { file: 'productionOrderPageApi', name: 'adminProductionOrderPage', args: [{ view: 'orders' }], body: pageBody },
  { file: 'productionOrderDetailApi', name: 'adminProductionOrderDetail', args: [{ apparatus: '', order_id: 'order-1' }], body: {} },
  { file: 'pendingOrderApi', name: 'pendingOrderDetail', args: ['order-1'], body: pendingBody },
];
function fixture(refresh = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'initial' };
  const auth = { activeSessionToken: () => session.token, refreshSession: async () => { session.token = 'refreshed'; refresh(); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const clients = kinds.map(kind => load(kind.file, { ...deps, './authorizedFetch': transport }));
  return { session, clients };
}
for (const [index, kind] of kinds.entries()) {
  test(`${kind.name}: omitted guard keeps legacy arguments and successful result`, async () => {
    let args;
    const mock = { authorizedFetch: async (...input) => { args = input; return { status: 200, json: async () => kind.body }; } };
    const client = load(kind.file, { ...deps, './authorizedFetch': mock });
    const session = {};
    const result = await client[kind.name](session, ...kind.args);
    assert.ok(result); assert.equal(args.length, 2); assert.equal(args[0], session);
  });
  test(`${kind.name}: stale before initial send is rejected without a request`, async () => {
    const f = fixture(); let sent = 0; const previous = global.fetch;
    global.fetch = async () => { sent++; throw new Error('unexpected'); };
    try {
      await assert.rejects(f.clients[index][kind.name](f.session, ...kind.args, () => { throw new Error('scope changed'); }), /scope changed/);
      assert.equal(sent, 0);
    } finally { global.fetch = previous; }
  });
  test(`${kind.name}: changed scope blocks a 401 retry`, async () => {
    let current = true; const f = fixture(() => { current = false; }); let sent = 0; const previous = global.fetch;
    global.fetch = async () => { sent++; return new Response('', { status: 401 }); };
    try {
      await assert.rejects(f.clients[index][kind.name](f.session, ...kind.args, () => { if (!current) throw new Error('scope changed'); }), /scope changed/);
      assert.equal(sent, 1);
    } finally { global.fetch = previous; }
  });
  test(`${kind.name}: unchanged scope retries 401 using refreshed token`, async () => {
    const f = fixture(); const sent = []; const previous = global.fetch;
    global.fetch = async (_url, init) => { sent.push(new Headers(init.headers).get('authorization'));
      return sent.length === 1 ? new Response('', { status: 401 }) : { status: 200, json: async () => kind.body }; };
    try {
      assert.ok(await f.clients[index][kind.name](f.session, ...kind.args, () => {}));
      assert.deepEqual(sent, ['Bearer initial', 'Bearer refreshed']);
    } finally { global.fetch = previous; }
  });
  test(`${kind.name}: result from a changed scope is not returned`, async () => {
    const f = fixture(); let current = true; const previous = global.fetch;
    global.fetch = async () => ({ status: 200, json: async () => { current = false; return kind.body; } });
    try {
      await assert.rejects(f.clients[index][kind.name](f.session, ...kind.args, () => { if (!current) throw new Error('scope changed'); }), /scope changed/);
    } finally { global.fetch = previous; }
  });
  test(`${kind.name}: an error response from a changed scope is not returned`, async () => {
    const f = fixture(); let current = true; const previous = global.fetch;
    global.fetch = async () => ({ status: 500, json: async () => { current = false; throw new Error('invalid json'); } });
    try {
      await assert.rejects(f.clients[index][kind.name](f.session, ...kind.args, () => { if (!current) throw new Error('scope changed'); }), /scope changed/);
    } finally { global.fetch = previous; }
  });
}
test('conditional 304 checks guard before returning cached authority', async () => {
  let current = true;
  const client = load('productionOrderPageApi', { ...deps, './authorizedFetch': { authorizedFetch: async () => { current = false; return { status: 304 }; } } });
  await assert.rejects(client.adminProductionOrderPage({}, { view: 'orders', ifVersion: 'v1' }, () => { if (!current) throw new Error('scope changed'); }), /scope changed/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const calls = [], deps = {
    '../authorizedFetch': { authorizedFetch: async (session, url, init, beforeSend) => { beforeSend?.(); calls.push({ url, init }); return { status: 200, json: async () => ({ id: 'transfer' }) }; } },
    '../inventoryModels': { inventoryTransferFromJson: value => value },
    '../inventoryReadApi': { inventoryResponseError: async () => Error('server') },
    '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message) { super(message); this.code = code; } } },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationInventoryTransfers.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls };
}
test('inventory transfers preserve V2 request fields and idempotency key', async () => {
  const x = setup();
  const result = await x.api.inventoryCreateTransfer({}, { sourceWarehouseId: ' src ', destinationWarehouseId: ' dst ',
    assets: [{ kind: 'raw_material', asset_ref: ' EPC ' }], idempotencyKey: ' key ', note: ' note ' });
  assert.equal(result.id, 'transfer');
  assert.equal(x.calls[0].url, '/v1/mobile/admin/inventory/transfers');
  assert.deepEqual(JSON.parse(x.calls[0].init.body), { source_warehouse_id: 'src', destination_warehouse_id: 'dst',
    assets: [{ asset_kind: 'raw_material', asset_ref: ' EPC ' }], idempotency_key: 'key', note: 'note' });
  await x.api.inventoryTransferAction({}, { transferId: 'a/b', action: ' RECEIVE ', idempotencyKey: ' next ' });
  assert.equal(x.calls[1].url, '/v1/mobile/admin/inventory/transfers/a%2Fb/receive');
  assert.deepEqual(JSON.parse(x.calls[1].init.body), { idempotency_key: 'next' });
});
test('invalid inventory transfers are rejected before any request', async () => {
  const x = setup();
  await assert.rejects(x.api.inventoryCreateTransfer({}, { sourceWarehouseId: 'a', destinationWarehouseId: 'a', assets: [{}], idempotencyKey: 'k' }), e => e.code === 'inventory_transfer_invalid');
  await assert.rejects(x.api.inventoryTransferAction({}, { transferId: 'a', action: 'invalid', idempotencyKey: 'k' }), e => e.code === 'inventory_transfer_action_invalid');
  await assert.rejects(x.api.inventoryCreateTransfer({}, { sourceWarehouseId: 'a', destinationWarehouseId: 'b',
    assets: [{ kind: 'raw_material', asset_ref: 'x' }], idempotencyKey: 'k' }, () => { throw Error('scope changed'); }), /scope changed/);
  assert.equal(x.calls.length, 0);
});
test('preparation inventory reuses the shared store with raw-material assignment scope', () => {
  const calls = [], store = { assets: input => { calls.push(input); return 'lease'; } };
  const filename = path.resolve(__dirname, '../src/preparation/preparationInventory.ts'), loaded = new Module(filename, module);
  const deps = { '../shared/appRoutes': { appRoutes: { inventoryMovements: '/inventory-movements' }, canOpenRoute: session => session.allowed },
    '../shared/inventoryViewRuntime': { inventoryViewRuntimeFor: () => store } };
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const session = { profile: { role: 'tayyorlov_masteri' }, allowed: true };
  assert.equal(loaded.exports.preparationInventoryStore(session), store);
  assert.equal(loaded.exports.preparationInventoryAssets(store, 'w', 'search'), 'lease');
  assert.deepEqual(calls, [{ warehouseId: 'w', query: 'search', assetKind: 'raw_material', includeOrderAssignment: true }]);
  assert.throws(() => loaded.exports.preparationInventoryStore({ ...session, allowed: false }), /Inventar ruxsatlari/);
});

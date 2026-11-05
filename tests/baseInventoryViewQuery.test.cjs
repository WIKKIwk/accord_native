const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/inventoryViewQuery.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === '../inventoryModels' ? { inventoryAssetFromJson: v => v, inventoryLocationFromJson: v => v,
  inventoryTransferFromJson: v => v } : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { InventoryViewQuery } = mod.exports;

// @v2-test test/inventory_view_store_test.dart
test('inventory subscriptions preserve typed flags and bounds', () => {
  const q = InventoryViewQuery.assets({ currentUserStatesOnly: true, limit: 500, offset: 100 });
  assert.deepEqual(q.subscription().query, { current_user_states_only: true, include_order_assignment: true, limit: 500, offset: 100 });
  assert.equal(q.liveBucket, 'assets:true');
  assert.equal(q.rowKey({ kind: 'raw_material', asset_ref: 'a' }), 'raw_material:a');
  assert.deepEqual(InventoryViewQuery.locations().subscription('v1'), { id: 'window', kind: 'locations', query: {}, version: 'v1' });
  assert.equal(InventoryViewQuery.transfers({ direction: 'incoming' }).liveBucket, 'transfers:incoming');
});

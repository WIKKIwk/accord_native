const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/preparation/preparationInventory.ts');
const loaded = new Module(filename, module);
const deps = { '../shared/appRoutes': {}, '../shared/inventoryViewRuntime': {}, '../auth': {}, '../inventoryReadApi': {},
  './preparationInventoryTransfers': {} };
loaded.require = id => Object.hasOwn(deps, id) ? deps[id] : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const logic = loaded.exports;
const asset = (overrides = {}) => ({ identifier: 'EPC-1', asset_ref: 'raw:EPC-1', item_code: 'ITEM', status: 'available', transfer_id: '',
  custody_warehouse: 'Main', physical_location: { kind: 'warehouse' }, ...overrides });

test('QR lookup preserves opaque identifiers and prefers exact warehouse matches', () => {
  assert.equal(logic.preparationInventoryBarcode('Milano Premium 30/40'), 'Milano Premium 30/40');
  assert.equal(logic.preparationInventoryBarcode('https://example.test/path?epc=EPC-1'), 'EPC-1');
  assert.equal(logic.preparationInventoryAssetBarcode(asset({ identifier: '' })), 'EPC-1');
  const exact = asset(), other = asset({ identifier: 'other', asset_ref: 'other', item_code: 'other' });
  assert.deepEqual(logic.preparationInventoryQrMatches([other, exact], 'epc-1'), [exact]);
  assert.deepEqual(logic.preparationInventoryQrMatches([other], 'unknown'), [other]);
  assert.deepEqual(logic.preparationInventoryQrMatches([other, exact], 'unknown'), []);
  assert.deepEqual(logic.preparationInventoryQrMatches([asset({ physical_location: { kind: 'state' } })], 'epc-1'), []);
});

test('preparation transfer requires available custody in an assigned warehouse', () => {
  assert.equal(logic.preparationInventoryCanTransfer(asset(), ['main']), true);
  assert.equal(logic.preparationInventoryCanTransfer(asset({ transfer_id: 't' }), ['main']), false);
  assert.equal(logic.preparationInventoryCanTransfer(asset({ status: 'reserved' }), ['main']), false);
  assert.equal(logic.preparationInventoryCanTransfer(asset({ physical_location: { kind: 'state' } }), ['main']), false);
  assert.equal(logic.preparationInventoryCanTransfer(asset(), ['other']), false);
});

test('transfer windows apply warehouse and line search independently', () => {
  const row = { source_warehouse: 'Main', destination_warehouse: 'Other', note: '', lines: [{ item_name: 'Film', item_code: 'F1', identifier: 'QR', asset_ref: 'raw:QR' }] };
  assert.deepEqual(logic.preparationInventoryTransfersFor([row], 'Other', 'incoming', 'film'), [row]);
  assert.deepEqual(logic.preparationInventoryTransfersFor([row], 'Other', 'outgoing', ''), []);
  assert.deepEqual(logic.preparationInventoryTransfersFor([row], '', 'outgoing', 'missing'), []);
});

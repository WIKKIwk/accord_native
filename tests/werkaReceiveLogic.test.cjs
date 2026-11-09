// Source-derived guard tests; native receive, confirmation and retry flows remain unported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/werka/werkaReceiveLogic.ts');
const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const api = loaded.exports;
const state = { busy: false, mustReload: false, receipt: null, warehouse: 'WH-1' };
const paddon = { canReceive: true, snapshotToken: 'token' };
const wip = { ...paddon, batch: { batch_id: 'b1', qr_payload: 'QR-b1' } };
test('warehouse selection retains a still-offered choice or selects exactly one', () => {
  assert.equal(api.werkaWarehouseAfterPreview(['WH-1', 'WH-2'], 'WH-2'), 'WH-2');
  assert.equal(api.werkaWarehouseAfterPreview(['WH-1'], 'removed'), 'WH-1');
  assert.equal(api.werkaWarehouseAfterPreview(['WH-1', 'WH-2'], null), null);
  assert.equal(api.werkaWarehouseAfterPreview([''], null), '');
});
test('pallet receive requires an available snapshot, warehouse and no competing or uncertain operation', () => {
  assert.equal(api.canReceiveWerkaPaddon(paddon, state), true);
  for (const variant of [{ ...state, busy: true }, { ...state, mustReload: true }, { ...state, receipt: {} }, { ...state, warehouse: null }])
    assert.equal(api.canReceiveWerkaPaddon(paddon, variant), false);
  assert.equal(api.canReceiveWerkaPaddon(null, state), false);
  assert.equal(api.canReceiveWerkaPaddon({ ...paddon, canReceive: false }, state), false);
  assert.equal(api.canReceiveWerkaPaddon({ ...paddon, snapshotToken: '' }, state), false);
  assert.equal(api.canReceiveWerkaPaddon(paddon, { ...state, warehouse: '' }), true);
});
test('WIP requires batch and QR identity as well as the same receipt guards', () => {
  assert.equal(api.canReceiveWerkaWip(wip, state), true);
  assert.equal(api.canReceiveWerkaWip({ ...wip, batch: { ...wip.batch, batch_id: '' } }, state), false);
  assert.equal(api.canReceiveWerkaWip({ ...wip, batch: { ...wip.batch, qr_payload: '' } }, state), false);
  assert.equal(api.canReceiveWerkaWip(wip, { ...state, mustReload: true }), false);
  assert.equal(api.sameWerkaWipIdentity(wip, { ...wip, batch: { ...wip.batch } }), true);
  assert.equal(api.sameWerkaWipIdentity(wip, { ...wip, batch: { ...wip.batch, batch_id: 'b2' } }), false);
  assert.equal(api.sameWerkaWipIdentity(wip, null), false);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printModels') return { UsbRpsPrintRequest: class {} };
    if (name === '../shared/mobileApiException') return { MobileApiException: class extends Error {} };
    if (name.startsWith('./gscale')) return load(`gscale/${name.slice(2)}.ts`);
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { GScaleOperatorStore } = load('gscale/gscaleOperatorState.ts');
const { GScaleBatchStateStore } = load('gscale/gscaleBatchState.ts');
const { batchSessionFromJson, materialReceiptPrintResponseFromJson } = load('gscale/gscaleBatchModel.ts');
const { emptyOperatorControlDraft } = load('gscale/gscaleDraft.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const listeners = new Set();
  const deviceState = { selection: { transport: 'bluetooth', bluetoothPrinter: { name: 'XP', address: 'AA', printer: 'xp-p323b', printMode: 'label' } },
    transport: 'bluetooth', needsAttention: false, connection: null, scanning: false, scanResult: null, checkingAddress: false, addressError: '' };
  const devices = { getSnapshot: () => deviceState, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    restore: async () => {}, clearServer: () => {}, dispose: () => {} };
  const stopped = batchSessionFromJson({ id: 'b1', active: false, revision: 1, item_code: 'PET', warehouse: 'W' });
  const active = batchSessionFromJson({ id: 'b1', active: true, revision: 2, item_code: 'PET', item_name: 'PET', warehouse: 'W',
    quantity_source: 'manual', length_m: 125, order_assignment: { order_id: 'o1' } });
  const batch = new GScaleBatchStateStore({ state: async () => ({ ok: true, batch: stopped }), stop: async () => ({ ok: true, batch: stopped }) });
  const calls = [];
  const deps = { devices, batch, refreshProfileScope: async () => {}, loadDraft: async () => emptyOperatorControlDraft(), saveDraft: async () => {},
    loadPreparationPreset: async () => null, loadMaterialWarehouses: async () => [], prefillMaterialOrder: async () => null, warehouseAllowed: async () => true,
    startBatch: async context => { calls.push(['start', context]); return { batch: active }; },
    printBatch: async context => { calls.push(['print', context]); return materialReceiptPrintResponseFromJson({ ok: true, epc: 'EPC' }); },
    submitSimple: async () => {}, refreshMonitor: async () => { throw new Error('unexpected'); },
    makeLive: () => { throw new Error('unexpected'); } };
  const store = new GScaleOperatorStore('material_taminotchi', { order: { id: 'o1', code: '', title: '', order_kg: '0', saved: false } }, deps);
  return { store, calls, active, batch, deps };
}

test('operator saves valid context, starts a batch and can edit manual weight while batch is active', async () => {
  const { store, calls } = setup(); store.start(); await flush();
  store.editDraft({ item_code: 'PET', item_name: 'PET', warehouse: 'W', length_text: '125', quantity_source: 'manual' });
  await store.startBatch(async () => null, false);
  assert.equal(calls[0][0], 'start'); assert.equal(store.getSnapshot().batch.batch.active, true);
  store.editDraft({ manual_qty_text: '5' });
  assert.equal(store.getSnapshot().draft.manual_qty_text, '5');
  store.editDraft({ item_code: 'OTHER' });
  assert.equal(store.getSnapshot().draft.item_code, 'PET');
  await store.manualPrint();
  assert.equal(calls[1][0], 'print'); assert.equal(calls[1][1].grossQtyKg, 5);
  store.dispose();
});

test('operator refuses to save an unassigned warehouse', async () => {
  const { store, calls } = setup(); store.start(); await flush();
  store.editDraft({ item_code: 'PET', item_name: 'PET', warehouse: '', length_text: '125' });
  assert.equal(await store.saveContext(), false);
  assert.equal(store.getSnapshot().error, 'Ombor tanlang'); assert.equal(calls.length, 0);
  store.dispose();
});

test('manual tap restores the previous weight when nothing new was entered', async () => {
  const { store } = setup(); store.start(); await flush();
  store.editDraft({ manual_qty_text: '7.25' });
  store.handleManualQtyTap(); assert.equal(store.getSnapshot().draft.manual_qty_text, '');
  store.restoreManualQtyIfEmpty(); assert.equal(store.getSnapshot().draft.manual_qty_text, '7.25');
  store.dispose();
});

test('a single order material is prefilled unless the picker was opened', async () => {
  const first = setup();
  first.deps.prefillMaterialOrder = async () => ({ item: { code: 'PET', name: 'PET', requiresDimensions: true }, micron: 12 });
  first.store.start(); await flush();
  assert.equal(first.store.getSnapshot().draft.item_code, 'PET');
  assert.equal(first.store.getSnapshot().draft.micron_text, '12');
  first.store.dispose();
  const second = setup();
  second.deps.prefillMaterialOrder = async () => ({ item: { code: 'PET', name: 'PET', requiresDimensions: true }, micron: 12 });
  second.store.openMaterialPicker(); second.store.start(); await flush();
  assert.equal(second.store.getSnapshot().draft.item_code, '');
  second.store.dispose();
});

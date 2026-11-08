const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/gscale/gscaleMaterialPolicy.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { MaterialGScalePolicy, materialPrinterSelectionKey, materialPreferenceOverlay } = loaded.exports;
const usb = { transport: 'offline', offlinePrinter: { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f, productId: 1,
  deviceName: '/dev/usb/1', manufacturerName: 'Zebra', productName: 'ZD' } };
const bt = { transport: 'bluetooth', bluetoothPrinter: { name: 'XP-P323B', address: 'AA:BB', printer: 'xp-p323b' } };
const wifi = { transport: 'wifi', server: { endpoint: { baseUrl: 'http://scale:39117' } } };
const state = (selection = usb, batch = null) => ({ device: { selection, transport: selection?.transport ?? 'wifi' },
  draft: { printer: 'zebra' }, batch: { resolved: true, batch } });
const batch = { id: 'b', revision: 3, active: true, printer: 'zebra', driver_url: 'usb://local' };

test('only identified Zebra USB and XP-P323B Bluetooth are admitted; Wi-Fi and unknown fail closed', () => {
  assert.match(materialPrinterSelectionKey(usb), /^usb:/); assert.match(materialPrinterSelectionKey(bt), /^bluetooth:/);
  assert.equal(materialPrinterSelectionKey(wifi), null); assert.equal(materialPrinterSelectionKey(null), null);
  assert.equal(materialPrinterSelectionKey({ ...usb, offlinePrinter: { ...usb.offlinePrinter, kind: 'godex', printer: 'godex' } }), null);
  assert.equal(materialPrinterSelectionKey({ ...usb, offlinePrinter: { ...usb.offlinePrinter, vendorId: 0, manufacturerName: '', productName: '' } }), null);
  assert.equal(materialPrinterSelectionKey({ ...bt, bluetoothPrinter: { ...bt.bluetoothPrinter, name: 'Unknown' } }), null);
  assert.equal(materialPrinterSelectionKey({ ...bt, bluetoothPrinter: { ...bt.bluetoothPrinter, address: '' } }), null);
});

test('every printer operation requires a current account, verified device and safe batch metadata', () => {
  let current = true; const policy = new MaterialGScalePolicy(() => current);
  for (const op of ['start', 'stop', 'print', 'archive', 'reprint']) {
    const snapshot = state(wifi, op === 'stop' || op === 'print' ? batch : null);
    assert.throws(() => policy.assertOperation(op, snapshot), /Printer ulanmagan/, op);
  }
  policy.assertOperation('start', state()); policy.assertOperation('stop', state(usb, batch));
  policy.assertOperation('print', state(bt, batch)); policy.assertOperation('archive', state()); policy.assertOperation('reprint', state(bt));
  for (const unsafe of [{ ...batch, printer: 'godex' }, { ...batch, printer: '' }, { ...batch, driver_url: '' },
    { ...batch, driver_url: 'http://other' }, { ...batch, active: false }]) {
    assert.throws(() => policy.assertOperation('stop', state(usb, unsafe)));
    assert.throws(() => policy.assertOperation('print', state(usb, unsafe)));
  }
  assert.throws(() => policy.assertOperation('start', { ...state(), draft: { printer: 'godex' } }));
  assert.throws(() => policy.assertOperation('archive', state(usb, { ...batch, printer: 'godex' })));
  assert.throws(() => policy.assertOperation('reprint', { ...state(), batch: { resolved: false, batch: null } }));
  current = false; assert.equal(policy.allowSelection(usb), false); for (const op of ['start', 'stop', 'print', 'archive', 'reprint'])
    assert.throws(() => policy.assertOperation(op, state(usb, op === 'stop' || op === 'print' ? batch : null)), /Sessiya tugagan/);
});

test('a queued write is refused after device, batch revision or request destination changes', () => {
  const policy = new MaterialGScalePolicy(() => true), key = materialPrinterSelectionKey(usb);
  policy.assertOperation('print', state(usb, batch), { selection: key, batchId: 'b', batchRevision: 3 });
  assert.throws(() => policy.assertOperation('print', state(bt, batch), { selection: key, batchId: 'b', batchRevision: 3 }));
  assert.throws(() => policy.assertOperation('print', state(usb, { ...batch, revision: 4 }), { selection: key, batchId: 'b', batchRevision: 3 }));
  assert.throws(() => policy.assertOperation('start', state(), { requestPrinter: 'godex' }));
  assert.throws(() => policy.assertOperation('start', state(), { requestDriverUrl: 'http://server' }));
});

test('material preference overlay reads old selections but never overwrites or deletes other roles storage', async () => {
  const shared = new Map([['device', 'legacy'], ['draft', 'legacy draft']]), writes = [];
  const base = { async getItem(key) { return shared.get(key) ?? null; }, async setItem(k, v) { writes.push(['set', k, v]); shared.set(k, v); },
    async removeItem(k) { writes.push(['remove', k]); shared.delete(k); } };
  const overlay = materialPreferenceOverlay(base);
  assert.equal(await overlay.getItem('device'), 'legacy'); await overlay.setItem('device', 'new'); await overlay.removeItem('draft');
  assert.equal(await overlay.getItem('device'), 'new'); assert.equal(await overlay.getItem('draft'), null);
  assert.deepEqual(writes, []); assert.equal(shared.get('device'), 'legacy'); assert.equal(shared.get('draft'), 'legacy draft');
});

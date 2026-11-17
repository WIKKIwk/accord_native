// Source-derived f119 archive/manual-picker fixtures; no physical-device verification is claimed.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const { hooks, defer, tick } = require('./support/workerPaddonHarness.cjs');
function load(file, mocks = {}) {
  const name = path.resolve(__dirname, '../src', file), mod = new Module(name, module); mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(name), id)) + '.ts', mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, name); return mod.exports;
}
const presentation = load('gscale/gscaleMaterialPresentation.ts', { '../printing/printModels': {} });
const batch = { active: false, batch_code: 'B', warehouse: 'W', item_code: 'PET', item_name: 'Film', started_at: '', ended_at: '',
  net_qty: 0, total_qty: 4.22, gross_qty: 5, unit: 'kg', tare_enabled: true, tare_kg: 0.78, print_count: 2, preparation_formula: {
    variant_name: 'Formula A', material_name: 'PET', captured_at: '', formulas: [{ name: 'A', share_percent: 100, lines: [{ item_code: 'PET', percent: 70 }] }],
  } };
test('Material archive preserves source quantities, tare, full formula rows and print details', () => {
  const rows = presentation.materialArchiveDetails(batch);
  assert.deepEqual(rows, [['Holat', 'CLOSED'], ['Batch', 'B'], ['Ombor', 'W'], ['Shnek formulasi', 'Formula A'], ['Homashyo', 'PET'],
    ['Formula olingan', ''], ['Shnek A (100%)', 'PET: 70%'], ['Brutto / netto', '5 / 4.22 kg'], ['Tara', '0.78 kg'], ['Printlar', '2 ta']]);
  const entry = { gross_qty: 5, net_qty: 4.22, unit: 'kg', draft_name: 'R-1', printed_at: '', status: 'sent' };
  assert.deepEqual(presentation.materialArchiveReceiptDetails(batch, entry), [['Kirim raqami', 'R-1'], ['Miqdor', 'B 5 / N 4.22 kg'], ['Ombor', 'W'], ['Shnek formulasi', 'Formula A']]);
  assert.equal(presentation.materialArchivePrintLabel(entry), 'B 5 / N 4.22 kg');
  assert.equal(presentation.materialArchivePrintSubtitle(entry), 'R-1 • sent');
  assert.equal(presentation.materialArchivePrintConfirmation(batch), 'Shu partiya uchun QR chop etamizmi?\n\nMahsulot: Film\nJami: BRUTTO 5 kg / NETTO 4.22 kg\nSana: ');
  assert.equal(presentation.materialArchiveSubtitle(batch), 'CLOSED • W • Formula: Formula A • Tare 0.78 kg');
});
function pickerFixture(safe = true) {
  const runner = hooks(), calls = [], pending = defer(), context = { apiBaseUrl: 'https://erp.example/path', isCurrent: () => current };
  let current = true;
  const state = { device: { connection: null, scanning: false, scanResult: null, checkingAddress: false, addressError: '' } };
  const operator = { subscribe: () => () => {}, getSnapshot: () => state, selectConnection: value => { state.device = { ...state.device, connection: value }; },
    scanDevices: async () => {}, checkDeviceAddress: async raw => { calls.push(['address', raw]); return pending.promise; }, selectDevice: async selection => { calls.push(['selected', selection]); return pending.promise; } };
  const api = load('shared/printing/useDevicePicker.ts', { react: runner.react, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => {} }, '../../printing/nativePrinter': {},
    '../../printing/printService': { PrintService: { detectOfflinePrinter: async () => pending.promise } } });
  const h = { calls, pending, api, context, operator, retire: () => { current = false; }, dispose: runner.dispose,
    render() { runner.begin(); h.picker = api.useDevicePicker(operator, () => calls.push('close'), safe, false, context); runner.flush(); return h.picker; } };
  h.render(); return h;
}
test('manual server address follows configured endpoint and exact V2 local-host fallback', () => {
  const h = pickerFixture();
  assert.equal(h.picker.address, 'https://erp.example:39117');
  for (const raw of ['', 'http://localhost:1', '127.0.0.1', 'http://10.0.2.2:9000']) assert.equal(h.api.materialDeviceAddress(raw), 'http://gscale.local:39117');
  assert.equal(h.api.materialDeviceAddress('192.168.1.12:39117/path'), 'http://192.168.1.12:39117');
  h.dispose();
});
test('manual probing does not select prematurely and original route retirement suppresses result/closure', async () => {
  const h = pickerFixture(), result = h.picker.probeAddress();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'address');
  h.retire(); h.pending.resolve({ endpoint: { baseUrl: 'http://scale' } });
  assert.equal(await result, null); assert.equal(h.calls.length, 1); h.dispose();
});
for (const method of ['selectServer', 'selectBluetooth', 'selectUsb']) test(`${method} never closes another route after original Material account retires`, async () => {
  const h = pickerFixture(), result = h.picker[method]({ address: 'AA', endpoint: {} });
  h.retire(); h.pending.resolve({ kind: 'zebra' }); await result;
  assert.equal(h.calls.includes('close'), false); h.dispose();
});
test('archive reprint preserves warning plus success, rejects duplicate taps and suppresses late UI after unmount', async () => {
  const runner = hooks(), pending = defer(), calls = [], entry = { epc: 'QR' }, operator = { reprintArchiveReceipt: async value => { calls.push(value); return pending.promise; } };
  const { useMaterialArchiveReceipt } = load('gscale/useMaterialArchiveReceipt.ts', { react: runner.react });
  let current = true, model; const render = () => { runner.begin(); model = useMaterialArchiveReceipt(entry, operator, () => current); runner.flush(); return model; };
  render(); const first = model.reprint(), duplicate = model.reprint(); assert.equal(calls.length, 1);
  pending.resolve('QR chop etildi, lekin server tasdig‘i saqlanmadi'); await Promise.all([first, duplicate]); render();
  assert.equal(model.error, 'QR chop etildi, lekin server tasdig‘i saqlanmadi'); assert.equal(model.success, 'Mavjud QR qayta chop etildi');
  current = false; await model.reprint(); assert.equal(calls.length, 1); runner.dispose(); await tick();
});

test('Material USB errors keep source four-second snackbar duration, repeat identical failures and ignore retired account events', t=>{
  t.mock.timers.enable({apis:['setTimeout']});const runner=hooks();let current=true;
  const {useMaterialDeviceNotice}=load('shared/printing/useMaterialDeviceNotice.ts',{react:runner.react});
  const picker={device:{connection:'usb'},error:'USB printer aniqlanmadi: disconnected',usbErrorRevision:1}, context={isCurrent:()=>current};
  const render=()=>{runner.begin();const message=useMaterialDeviceNotice(picker,context);runner.flush();return message;};
  render();assert.equal(render(),picker.error);t.mock.timers.tick(3999);assert.equal(render(),picker.error);
  picker.usbErrorRevision++;render();t.mock.timers.tick(1);assert.equal(render(),picker.error);
  t.mock.timers.tick(3999);assert.equal(render(),'');current=false;picker.usbErrorRevision++;render();assert.equal(render(),'');runner.dispose();
});

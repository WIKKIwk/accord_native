const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return mod.exports;
}
const profile = { address: 'AA:BB', printer: 'xp-p323b', printMode: 'label' };
function harness() {
  const requests = [], printed = [];
  let current = true, printOk = true, prepared = { ok: true, print_job: { epc: 'WIP1' }, print_status: '' };
  const api = load('workerPrinting.ts', {
    './preparation/preparationPrinter': {
      pickPreparationPrinter: async options => options.selectDevice(),
      printPreparationJob: async (job, printer) => { printed.push({ job, printer }); return printOk; },
    },
    './printing/printTransport': { offlineUsbDriverUrl: 'usb://local' },
    './productionProgressReprintApi': { adminProgressQrReprint: async (session, body) => { requests.push(body); return prepared; } },
  });
  return { api, printed, requests, options: { current: () => current, selectDevice: async () => ({ transport: 'bluetooth', printer: profile }) },
    setCurrent: value => { current = value; }, setPrintOk: value => { printOk = value; }, setPrepared: value => { prepared = value; } };
}

test('worker printer accepts Bluetooth and preserves V2 local print request fields', async () => {
  const h = harness(), selected = await h.api.pickWorkerPrinter(h.options);
  assert.deepEqual(h.api.workerPrinterFields(selected), { driver_url: 'usb://local', print_transport: 'bluetooth', printer: 'xp-p323b', print_mode: 'label' });
  await h.api.printWorkerJobs({ print_jobs: [{ epc: 'one' }, { epc: 'two' }], print_job: { epc: 'one' } }, selected, h.options.current);
  assert.deepEqual(h.printed.map(item => item.job.epc), ['one', 'two']);
  assert.equal(h.printed[0].printer.printer, profile);
});

test('cancelled, stale, USB and Wi-Fi selections cannot send a reprint command', async () => {
  for (const selection of [null, { transport: 'offline' }, { transport: 'wifi', serverBaseUrl: 'http://example.test' }]) {
    const h = harness(); h.options.selectDevice = async () => selection;
    await assert.rejects(h.api.reprintWorkerWip({}, { batch_id: 'b', qr_payload: 'QR' }, h.options), h.api.WorkerPrintCancelled);
    assert.deepEqual(h.requests, []); assert.deepEqual(h.printed, []);
  }
  const h = harness(); h.options.selectDevice = async () => { h.setCurrent(false); return { transport: 'bluetooth', printer: profile }; };
  await assert.rejects(h.api.pickWorkerPrinter(h.options), h.api.WorkerPrintCancelled);
});

test('reprint sends the selected local transport and physically prints the returned label', async () => {
  const h = harness();
  await h.api.reprintWorkerWip({}, { batch_id: 'b', qr_payload: 'QR' }, h.options);
  assert.deepEqual(h.requests, [{ progress_batch_id: 'b', qr_payload: 'QR', print_count: 1,
    driver_url: 'usb://local', print_transport: 'bluetooth', printer: 'xp-p323b', print_mode: 'label' }]);
  assert.equal(h.printed.length, 1); assert.equal(h.printed[0].job.epc, 'WIP1');
});

test('missing job, server refusal or physical print failure never report success', async () => {
  for (const result of [{ ok: false, print_status: 'refused' }, { ok: true, print_status: '', print_job: null }]) {
    const h = harness(); h.setPrepared(result);
    await assert.rejects(h.api.reprintWorkerWip({}, { batch_id: 'b', qr_payload: 'QR' }, h.options));
    assert.deepEqual(h.printed, []);
  }
  const h = harness(); h.setPrintOk(false);
  await assert.rejects(h.api.reprintWorkerWip({}, { batch_id: 'b', qr_payload: 'QR' }, h.options), /chop etmadi/);
  assert.equal(h.requests.length, 1); assert.equal(h.printed.length, 1);
});

test('a session change before local printing prevents the physical job', async () => {
  const h = harness(); h.setCurrent(false);
  await assert.rejects(h.api.printWorkerJobs({ print_job: { epc: 'one' } }, { transport: 'bluetooth', printer: profile }, h.options.current), h.api.WorkerPrintCancelled);
  assert.deepEqual(h.printed, []);
});

test('Android printer chooser exposes only Bluetooth and retains explicit device choice and cancel', async () => {
  const calls = [], paired = [profile];
  const api = load('preparation/preparationDevicePicker.android.ts', { '../printing/nativePrinter': { NativeBluetoothPrinter: { pairedPrinters: async () => paired } } });
  let answers = ['bluetooth', 'AA:BB'];
  const dialogs = { choose: async (title, choices) => { calls.push(choices); return answers.shift(); } };
  assert.deepEqual(await api.selectPreparationDevice(dialogs, () => true), { transport: 'bluetooth', printer: profile });
  assert.deepEqual(calls[0], [{ label: 'Bluetooth printer', value: 'bluetooth' }]);
  answers = [null]; assert.equal(await api.selectPreparationDevice(dialogs, () => true), null);
});

test('iOS printer chooser has a Bluetooth list, rescan and cancel without USB/Wi-Fi entries', () => {
  const native = new Proxy({}, { get: (_target, key) => String(key) });
  const api = load('preparation/PreparationPrinterPicker.ios.tsx', {
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': { disabled: value => value },
    react: { useState: value => [typeof value === 'function' ? value() : value, () => {}], useRef: value => ({ current: value }), useEffect() {} },
    '../printing/nativePrinter': {}, './PreparationUI': { usePreparationText: () => value => value },
  });
  const selections = [], tree = api.PreparationPrinterPicker({ select: value => selections.push(value) });
  const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  const nodes = walk(tree), labels = nodes.map(node => node.props?.label).filter(Boolean);
  assert.deepEqual(labels, ['Qayta qidirish', 'Bekor qilish']);
  assert.deepEqual(nodes.filter(node => node.type === 'Section').map(node => node.props.title), ['Bluetooth']);
  nodes.find(node => node.props?.role === 'cancel').props.onPress(); assert.deepEqual(selections, [null]);
});

test('iOS output printing waits for the report Modal dismissal before opening its native picker', async () => {
  const file = ts.createSourceFile('OrderScreen.tsx', fs.readFileSync(path.resolve(__dirname, '../src/OrderScreen.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'selectOutputPrinter') fn = node.getText(file); ts.forEachChild(node, visit); };
  visit(file); assert.ok(fn);
  const calls = [], reportDismissed = { current: null };
  const select = vm.runInNewContext(`${ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; selectOutputPrinter`, {
    Platform: { OS: 'ios' }, reportDismissed, setPrinterDialogHidden: hidden => calls.push(['hidden', hidden]),
    isCurrent: () => true, printerSelector: { selectDevice() {} }, pickWorkerPrinter: async () => { calls.push(['picker']); return profile; },
  });
  const pending = select();
  await Promise.resolve(); assert.deepEqual(calls, [['hidden', true]]);
  reportDismissed.current(); await pending;
  assert.deepEqual(calls, [['hidden', true], ['picker'], ['hidden', false]]);
});

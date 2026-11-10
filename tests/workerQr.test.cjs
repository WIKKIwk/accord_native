const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/workerQr.ts'), mod = new Module(file, module);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { workerQrPayload, WorkerInitialQr } = mod.exports;
// @v2-test test/admin_progress_qr_scan_reads_test.dart
for (const [raw, expected] of [
  ['  00001  ', '00001'], ['', ''], ['https://example.test/scan/ignored?qr_payload=00001', '00001'],
  ['https://example.test/scan/ignored?progress_qr=ROLL&epc=other', 'ROLL'],
  ['https://example.test/scan/ignored?epc=EPC', 'EPC'], ['https://example.test/scan/ROLL%20A', 'ROLL A'],
  ['https://example.test/scan/fallback?qr_payload=&progress_qr=ignored', 'fallback'],
  ['https://example.test/scan/fallback?qr_payload=%20ABC%20', 'ABC'],
  ['ftp://example.test/scan/ROLL?qr_payload=ignored', 'ftp://example.test/scan/ROLL?qr_payload=ignored'],
]) test(`V2 QR normalization: ${raw}`, () => assert.equal(workerQrPayload(raw), expected));

test('initial FAB input waits for authoritative control and is validated once without starting', () => {
  const qr = new WorkerInitialQr(' https://example.test/scan/ignored?qr_payload=00001 '), values = [];
  qr.run(false, value => values.push(value)); assert.deepEqual(values, []);
  qr.run(true, value => values.push(value)); qr.run(false, value => values.push(value)); qr.run(true, value => values.push(value));
  assert.deepEqual(values, ['00001']);
});

function functions(sourceName, names, context) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src', sourceName), 'utf8');
  const ast = ts.createSourceFile(sourceName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found = [];
  const visit = node => { if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(ast)); ts.forEachChild(node, visit); }; visit(ast);
  assert.equal(found.length, names.length);
  const js = ts.transpileModule(`${found.join('\n')} return { ${names.join(',')} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(context), js)(...Object.values(context));
}

test('iOS camera dismissal precedes opening the order and keeps the original QR', () => {
  let scope = 'first'; const opened = [], pendingScannedOrder = { current: null }, screenMounted = { current: true };
  const h = functions('WorkerScreen.tsx', ['finishQrScan', 'scannerDismissed'], { nativeNavigation: true, Platform: { OS: 'ios' },
    pendingScannedOrder, pendingQrSwitch: { current: null }, qrLocation: { current: { machine: 'apparatus', window: 'window' } }, windowScope: 'window', captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => true, screenMounted, session: {}, activeSessionToken: () => 'token', sessionReadScope: () => scope,
    setMachineId: () => {}, setScannerOpen: () => {}, openOrder: target => opened.push(target) });
  h.finishQrScan('apparatus', 'order', '00001'); assert.deepEqual(opened, []);
  h.scannerDismissed(); assert.deepEqual(opened, [{ apparatusId: 'apparatus', orderId: 'order', initialScanQr: '00001' }]);
  h.finishQrScan('apparatus', 'other', 'QR'); scope = 'changed'; h.scannerDismissed(); assert.equal(opened.length, 1);
});

test('Android camera handoff passes QR directly to the order', () => {
  const opened = [];
  const h = functions('WorkerScreen.tsx', ['finishQrScan'], { nativeNavigation: false, Platform: { OS: 'android' },
    pendingQrSwitch: { current: null }, setMachineId: () => {}, setScannerOpen: () => {}, openOrder: target => opened.push(target) });
  h.finishQrScan('apparatus', 'order', 'QR'); assert.equal(opened[0].initialScanQr, 'QR');
});

test('completed or unassigned tab cannot silently scan into a different apparatus', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/WorkerScreen.tsx'), 'utf8');
  const ast = ts.createSourceFile('WorkerScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'scannerMachineId') expression = node.initializer.getText(ast); ts.forEachChild(node, visit); };
  visit(ast); assert.ok(expression);
  const selected = (selectedMachine, allowed) => new Function('selectedMachine', 'canWorkMachine', 'queue', `return ${expression};`)(selectedMachine, id => allowed.includes(id), { machines: [{ id: 'assigned' }] });
  assert.equal(selected(undefined, ['assigned']), '');
  assert.equal(selected({ id: 'foreign' }, ['assigned']), '');
  assert.equal(selected({ id: 'cut' }, ['cut']), 'cut');
});

test('camera lookup returns the normalized QR and suppresses stale-account results', async () => {
  let scope = 'first', lookup; const orders = [];
  const scan = functions('components/WorkerQrScanner.tsx', ['scan'], { workerQrPayload, scanLock: { current: false },
    setBusy: () => {}, setError: () => {}, request: { current: null }, session: {}, apparatusId: 'apparatus',
    sessionReadScope: () => scope, active: { current: true }, activeSessionToken: () => 'token',
    apparatus: { id: 'apparatus' }, getSnapshot: () => null, p: key => key, apparatusLabel: id => id, workerFabErrorText: e => e.message,
    workerFabQrReads: (_s, _a, _g, current) => ({ current }), prepareWorkerFabQr: async (_s, _a, qr) => { lookup = qr; return { orderId: 'order', switching: false }; }, onOrder: (...args) => orders.push(args) }).scan;
  await scan('https://example.test/scan/x?qr_payload=00001'); assert.equal(lookup, '00001');
  assert.deepEqual(orders, [['apparatus', 'order', '00001', false]]);
  const stale = functions('components/WorkerQrScanner.tsx', ['scan'], { workerQrPayload, scanLock: { current: false },
    setBusy: () => {}, setError: () => {}, request: { current: null }, session: {}, apparatusId: 'apparatus',
    sessionReadScope: () => scope, active: { current: true }, activeSessionToken: () => 'token',
    apparatus: { id: 'apparatus' }, getSnapshot: () => null, p: key => key, apparatusLabel: id => id, workerFabErrorText: e => e.message,
    workerFabQrReads: (_s, _a, _g, current) => ({ current }), prepareWorkerFabQr: async () => { scope = 'second'; return { orderId: 'wrong', switching: false }; }, onOrder: (...args) => orders.push(args) }).scan;
  await stale('QR'); assert.equal(orders.length, 1);
});

test('order dismissal replays QR only after a confirmed stop, with a fresh read and an already-dismissed camera', async () => {
  const opened = [], reads = [], alerts = [], pendingQrSwitch = { current: null }, qrLocation = { current: { machine: 'apparatus', window: 'window' } };
  let valid = true, release;
  const h = functions('WorkerScreen.tsx', ['finishQrOrderDismissal'], { pendingQrSwitch, qrLocation, session: {}, screenMounted: { current: true },
    sessionReadScope: () => 'scope', isSessionWitnessCurrent: () => valid, queueRef: { current: { machines: [{ id: 'apparatus' }], snapshot: {} } }, p: key => key,
    workerFabQrReads: (_s, _a, _get, current) => ({ current }), prepareWorkerFabQr: async (_s, _a, qr) => { reads.push(qr); await new Promise(resolve => { release = resolve; }); return { orderId: 'target', switching: false }; },
    workerFabErrorText: error => error.message, finishQrScan: (...args) => opened.push(args), setAlert: value => alerts.push(value) });
  const pending = committed => ({ apparatusId: 'apparatus', qr: '00001', scope: 'scope', window: 'window', witness: {}, committed });
  pendingQrSwitch.current = pending(false); h.finishQrOrderDismissal(); assert.deepEqual(reads, []);
  pendingQrSwitch.current = pending(true); h.finishQrOrderDismissal(); assert.deepEqual(opened, []); assert.deepEqual(reads, ['00001']);
  release(); await new Promise(setImmediate); assert.deepEqual(opened, [['apparatus', 'target', '00001', false, true]]);
  pendingQrSwitch.current = pending(true); h.finishQrOrderDismissal(); valid = false; release(); await new Promise(setImmediate); assert.equal(opened.length, 1); assert.deepEqual(alerts, []);
  valid = true; qrLocation.current.machine = 'other'; pendingQrSwitch.current = pending(true); h.finishQrOrderDismissal(); assert.equal(reads.length, 2);
});

test('iOS manual entry waits for native dismissal, while Android starts directly, and an expired witness is rejected', () => {
  for (const platform of ['ios', 'android']) {
    const scanned = [], pendingManual = { current: null }; let valid = true;
    const h = functions('components/WorkerQrScanner.tsx', ['confirmManual', 'manualDismissed'], { Platform: { OS: platform },
      workerQrPayload, manual: 'https://example.test/scan/x?qr_payload=00001', scanLock: { current: false }, pendingManual,
      session: {}, active: { current: true }, captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => valid,
      setManualOpen: () => {}, scan: qr => scanned.push(qr) });
    h.confirmManual(); assert.deepEqual(scanned, platform === 'ios' ? [] : ['00001']);
    h.manualDismissed(); assert.deepEqual(scanned, ['00001']);
    if (platform === 'ios') { h.confirmManual(); valid = false; h.manualDismissed(); assert.equal(scanned.length, 1); }
  }
});

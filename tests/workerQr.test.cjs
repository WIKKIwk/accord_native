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
    pendingScannedOrder, screenMounted, session: {}, activeSessionToken: () => 'token', sessionReadScope: () => scope,
    setMachineId: () => {}, setScannerOpen: () => {}, openOrder: target => opened.push(target) });
  h.finishQrScan('apparatus', 'order', '00001'); assert.deepEqual(opened, []);
  h.scannerDismissed(); assert.deepEqual(opened, [{ apparatusId: 'apparatus', orderId: 'order', initialScanQr: '00001' }]);
  h.finishQrScan('apparatus', 'other', 'QR'); scope = 'changed'; h.scannerDismissed(); assert.equal(opened.length, 1);
});

test('Android camera handoff passes QR directly to the order', () => {
  const opened = [];
  const h = functions('WorkerScreen.tsx', ['finishQrScan'], { nativeNavigation: false, Platform: { OS: 'android' },
    setMachineId: () => {}, setScannerOpen: () => {}, openOrder: target => opened.push(target) });
  h.finishQrScan('apparatus', 'order', 'QR'); assert.equal(opened[0].initialScanQr, 'QR');
});

test('camera lookup returns the normalized QR and suppresses stale-account results', async () => {
  let scope = 'first', lookup; const orders = [];
  const scan = functions('components/WorkerQrScanner.tsx', ['scan'], { workerQrPayload, scanLock: { current: false },
    setBusy: () => {}, setError: () => {}, request: { current: null }, session: {}, apparatusId: 'apparatus',
    sessionReadScope: () => scope, active: { current: true }, activeSessionToken: () => 'token',
    findOrder: async (_s, _a, qr) => { lookup = qr; return 'order'; }, onOrder: (...args) => orders.push(args) }).scan;
  await scan('https://example.test/scan/x?qr_payload=00001'); assert.equal(lookup, '00001');
  assert.deepEqual(orders, [['apparatus', 'order', '00001']]);
  const stale = functions('components/WorkerQrScanner.tsx', ['scan'], { workerQrPayload, scanLock: { current: false },
    setBusy: () => {}, setError: () => {}, request: { current: null }, session: {}, apparatusId: 'apparatus',
    sessionReadScope: () => scope, active: { current: true }, activeSessionToken: () => 'token',
    findOrder: async () => { scope = 'second'; return 'wrong'; }, onOrder: (...args) => orders.push(args) }).scan;
  await stale('QR'); assert.equal(orders.length, 1);
});

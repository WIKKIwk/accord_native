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

test('dismissed scanner handoff opens the order and preserves its normalized QR', () => {
  const opened = [], hidden = [];
  const h = functions('WorkerScreen.tsx', ['finishQrScan'], {
    pendingQrSwitch: { current: null }, windowScope: 'window', captureSessionWitness: () => ({}), session: {}, sessionReadScope: () => 'scope',
    setMachineId: () => {}, setScannerOpen: value => hidden.push(value), openOrder: target => opened.push(target) });
  h.finishQrScan('apparatus', 'order', '00001');
  assert.deepEqual(hidden, [false]);
  assert.deepEqual(opened, [{ apparatusId: 'apparatus', orderId: 'order', initialScanQr: '00001' }]);
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
  release(); await new Promise(setImmediate); assert.deepEqual(opened, [['apparatus', 'target', '00001', false]]);
  pendingQrSwitch.current = pending(true); h.finishQrOrderDismissal(); valid = false; release(); await new Promise(setImmediate); assert.equal(opened.length, 1); assert.deepEqual(alerts, []);
  valid = true; qrLocation.current.machine = 'other'; pendingQrSwitch.current = pending(true); h.finishQrOrderDismissal(); assert.equal(reads.length, 2);
});

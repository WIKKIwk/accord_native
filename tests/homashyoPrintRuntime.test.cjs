// Source-derived runtime behaviour; native devices are not mocked as a substitute for hardware validation.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/homashyo/rawSplitPrintRuntime.ts');
function setup(platform = 'android') {
  const calls = [], result = { id: 'split-id', outputs: [{ barcode: 'a' }, { barcode: 'b' }] };
  const mocks = { 'react-native': { Platform: { OS: platform } }, '../printing/printService': { PrintService: { printRps: async (request, options) => { calls.push(['local', request, options]); return { ok: true, status: 'done' }; } } },
    './rawSplitApi': { rawSplitPrint: async (_session, body) => { calls.push(['wifi', body]); }, rawSplitSessionIsCurrent: ticket => ticket.current !== false, requireRawSplitRealAccount: ticket => { if (ticket.session.token === 'test-mode-token') throw new Error('Demo/test rejimi hozir mavjud emas.'); } },
    './rawSplitPrinting': { rawMaterialSplitPrintRequest: output => ({ epc: output.barcode }) } };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: mod.exports, calls, result, ticket: { session: {}, check() {} } };
}
test('existing Bluetooth and Zebra bridge prints each returned roll once in order', async () => {
  const h = setup(), device = { transport: 'bluetooth', printer: { address: 'test' } }; let guards = 0;
  await h.api.printRawSplitResult(h.ticket, h.result, device, 'godex', () => { guards++; });
  assert.equal(guards, 6); assert.deepEqual(h.calls.map(call => call[1].epc), ['a', 'b']);
  assert.ok(h.calls.every(call => call[2].transport === 'bluetooth'));
});
test('Wi-Fi Zebra invokes scoped V2 endpoint with the discovered driver', async () => {
  const h = setup(), device = { transport: 'wifi', serverBaseUrl: 'http://server', driverBaseUrl: 'http://driver' };
  await h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, 'zebra', () => {});
  assert.deepEqual(h.calls, [['wifi', { splitId: 'split-id', barcode: 'a', driverUrl: 'http://driver', printer: 'zebra', printMode: 'label' }]]);
});
test('GoDEX and unknown Wi-Fi driver stay blocked before any print', async () => {
  const h = setup();
  for (const [device, printer] of [[{ transport: 'offline', printer: { kind: 'godex' } }, 'godex'],
    [{ transport: 'wifi', serverBaseUrl: 'http://server', driverBaseUrl: 'http://driver' }, 'godex'],
    [{ transport: 'wifi', serverBaseUrl: 'http://server' }, 'zebra']]) {
    assert.equal(h.api.rawSplitPrinterSupported(device, printer), false);
    await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, printer, () => {}), h.api.RawSplitUnsupportedPrinter);
  }
  assert.deepEqual(h.calls, []);
});
test('a scope change stops before another physical print', async () => {
  const h = setup(), device = { transport: 'bluetooth', printer: { address: 'AA' } }; let checks = 0;
  await assert.rejects(h.api.printRawSplitResult(h.ticket, h.result, device, 'zebra', () => { if (++checks === 3) throw new Error('account changed'); }));
  assert.deepEqual(h.calls.map(call => call[1].epc), ['a']);
});

test('an inactive session ticket prevents every local print before the bridge', async () => {
  const h = setup(); h.ticket.current = false; const device = { transport: 'offline', printer: { kind: 'zebra' } };
  await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, 'zebra', () => {}), /Akkaunt o‘zgargan/);
  assert.deepEqual(h.calls, []);
});

test('demo token cannot reach local printer or Wi-Fi print endpoint', async () => {
  const h = setup(); h.ticket.session.token = 'test-mode-token';
  for (const [device, kind] of [[{ transport: 'bluetooth', printer: {} }, 'zebra'],
    [{ transport: 'wifi', driverBaseUrl: 'http://driver' }, 'zebra']])
    await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, kind, () => {}), /Demo\/test/);
  assert.deepEqual(h.calls, []);
});

test('a revoked witness immediately before the native bridge prevents local dispatch', async () => {
  const h = setup(), device = { transport: 'bluetooth', printer: { address: 'AA' } }; let checks = 0;
  await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, 'zebra', () => { if (++checks === 2) throw new Error('revoked'); }), /revoked/);
  assert.deepEqual(h.calls, []);
});

test('different USB Zebra devices of the same kind both fail before native print dispatch', async () => {
  const h = setup();
  for (const deviceName of ['Zebra-A', 'Zebra-B']) {
    const selected = { transport: 'offline', printer: { kind: 'zebra', deviceName } };
    assert.equal(h.api.rawSplitPrinterSupported(selected, 'zebra'), false);
    await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], selected, 'zebra', () => {}), h.api.RawSplitUnsupportedPrinter);
  }
  assert.deepEqual(h.calls, []);
});

test('iOS Bluetooth fails before bridge dispatch while Android Bluetooth remains available', async () => {
  const device = { transport: 'bluetooth', printer: { address: 'A' } }, ios = setup('ios'), android = setup('android');
  assert.equal(ios.api.rawSplitPrinterSupported(device, 'zebra'), false);
  await assert.rejects(ios.api.printRawSplitRoll(ios.ticket, ios.result, ios.result.outputs[0], device, 'zebra', () => {}), ios.api.RawSplitUnsupportedPrinter);
  assert.deepEqual(ios.calls, []); assert.equal(android.api.rawSplitPrinterSupported(device, 'zebra'), true);
  await android.api.printRawSplitRoll(android.ticket, android.result, android.result.outputs[0], device, 'zebra', () => {}); assert.equal(android.calls.length, 1);
});

test('printer safety guidance lists Bluetooth only when the current platform can use it', () => {
  const ios = setup('ios'), android = setup('android');
  assert.doesNotMatch(ios.api.rawSplitUnsupportedReason('offline'), /Bluetooth/);
  assert.doesNotMatch(ios.api.rawSplitUnsupportedReason('wifi'), /Bluetooth/);
  assert.match(android.api.rawSplitUnsupportedReason('offline'), /Bluetooth/);
  assert.match(android.api.rawSplitUnsupportedReason('wifi'), /Bluetooth/);
});

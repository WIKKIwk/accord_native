// Source-derived runtime behaviour; native devices are not mocked as a substitute for hardware validation.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/homashyo/rawSplitPrintRuntime.ts');
function loadPolicy() {
  const policyFilename = path.resolve(__dirname, '../src/homashyo/rawSplitWritePolicy.ts'), policy = new Module(policyFilename, module);
  policy.filename = policyFilename; policy.paths = module.paths;
  policy._compile(ts.transpileModule(fs.readFileSync(policyFilename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, policyFilename);
  return policy.exports;
}
function setup(platform = 'android') {
  const calls = [], result = { id: 'split-id', outputs: [{ barcode: 'a' }, { barcode: 'b' }] };
  const mocks = { './rawSplitWritePolicy': loadPolicy(), 'react-native': { Platform: { OS: platform } }, '../printing/printService': { PrintService: { printRps: async (request, options) => { calls.push(['local', request, options]); return { ok: true, status: 'done' }; } } },
    './rawSplitApi': { rawSplitPrint: async (_session, body) => { calls.push(['wifi', body]); }, rawSplitSessionIsCurrent: ticket => ticket.current !== false, requireRawSplitRealAccount: ticket => { if (ticket.session.token === 'test-mode-token') throw new Error('Demo/test rejimi hozir mavjud emas.'); } },
    './rawSplitPrinting': { rawMaterialSplitPrintRequest: output => ({ epc: output.barcode }) } };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: mod.exports, calls, result, native: mocks['../printing/printService'].PrintService, ticket: { session: {}, check() {} } };
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

test('Android USB Zebra prints through the shared bridge with the selected profile', async () => {
  const h = setup();
  for (const deviceName of ['Zebra-A', 'Zebra-B']) {
    const profile = { kind: 'zebra', deviceName }, selected = { transport: 'offline', printer: profile };
    assert.equal(h.api.rawSplitPrinterSupported(selected, 'zebra'), true);
    await h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], selected, 'zebra', () => {});
    assert.equal(h.calls.at(-1)[2].printerProfile, profile);
    assert.equal(h.calls.at(-1)[2].transport, 'offline');
  }
  assert.equal(h.calls.length, 2);
});

test('iOS USB stays unavailable before bridge dispatch', async () => {
  const h = setup('ios'), selected = { transport: 'offline', printer: { kind: 'zebra' } };
  assert.equal(h.api.rawSplitPrinterSupported(selected, 'zebra'), false);
  await assert.rejects(h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], selected, 'zebra', () => {}), h.api.RawSplitUnsupportedPrinter);
  assert.deepEqual(h.calls, []);
});

test('iOS and Android Bluetooth dispatch through the existing bridge using the selected printer', async () => {
  for (const platform of ['ios', 'android']) {
    const h = setup(platform), profile = { address: 'A' }, device = { transport: 'bluetooth', printer: profile };
    assert.equal(h.api.rawSplitPrinterSupported(device, 'zebra'), true);
    await h.api.printRawSplitRoll(h.ticket, h.result, h.result.outputs[0], device, 'zebra', () => {});
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][2].bluetoothPrinter, profile);
  }
});

test('an unconfirmed native print stops before the next returned roll', async () => {
  for (const response of [{ ok: false, status: 'done' }, { ok: true, status: 'queued' }]) {
    const h = setup(), device = { transport: 'bluetooth', printer: { address: 'A' } };
    h.native.printRps = async request => { h.calls.push(['local', request]); return response; };
    await assert.rejects(h.api.printRawSplitResult(h.ticket, h.result, device, 'zebra', () => {}), /Printer natijani tasdiqlamadi/);
    assert.deepEqual(h.calls.map(call => call[1].epc), ['a']);
  }
});

test('an explicitly disabled dispatch policy stops local and Wi-Fi requests before dispatch', async () => {
  const calls = [], mocks = { './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => false },
    'react-native': { Platform: { OS: 'android' } }, '../printing/printService': { PrintService: { printRps: async () => { calls.push('native'); } } },
    './rawSplitApi': { rawSplitPrint: async () => { calls.push('wifi'); }, rawSplitSessionIsCurrent: () => true, requireRawSplitRealAccount() {} },
    './rawSplitPrinting': { rawMaterialSplitPrintRequest: () => ({}) } };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  for (const device of [{ transport: 'bluetooth', printer: {} }, { transport: 'wifi', driverBaseUrl: 'https://printer.invalid' }])
    await assert.rejects(mod.exports.printRawSplitRoll({ session: {} }, { id: 's' }, { barcode: 'b' }, device, 'zebra', () => {}), /to‘xtatilgan/);
  assert.deepEqual(calls, []);
});

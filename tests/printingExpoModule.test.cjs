const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
let native = null;
const filename = path.resolve(__dirname, '../modules/accord-printer/src/AccordPrinterModule.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.require = name => name === 'expo' ? { requireOptionalNativeModule: () => native } : require(name);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { AccordPrinter, PrinterChannelError } = loaded.exports;

test('missing module and native error envelopes retain their error codes and details', async () => {
  native = null;
  await assert.rejects(AccordPrinter.pairedPrinters(), error => error instanceof PrinterChannelError && error.code === 'printer_module_unavailable');
  native = { async detectPrinter() { return { __accord_error__: true, code: 'usb_printer_unsupported', message: 'unsupported', details: { vendorId: 12 } }; } };
  await assert.rejects(AccordPrinter.detectPrinter(), error => error.code === 'usb_printer_unsupported' && error.details.vendorId === 12);
});

test('discovery listeners receive only their own session events and cancellation reaches native', async () => {
  const listeners = new Set();
  const stopped = [];
  native = {
    addListener(_name, listener) { listeners.add(listener); return { remove() { listeners.delete(listener); } }; },
    async startDiscovery() {},
    async stopDiscovery(session) { stopped.push(session); },
  };
  const first = []; const second = [];
  const cancelFirst = await AccordPrinter.startDiscovery(1, event => first.push(event));
  const cancelSecond = await AccordPrinter.startDiscovery(2, event => second.push(event));
  for (const listener of listeners) listener({ _session: 2, type: 'printer', address: 'device' });
  assert.deepEqual(first, []);
  assert.deepEqual(second, [{ type: 'printer', address: 'device' }]);
  cancelFirst(); cancelSecond();
  assert.deepEqual(stopped, [1, 2]);
  assert.equal(listeners.size, 0);
});

test('failed discovery removes the registered listener', async () => {
  let removed = false;
  native = {
    addListener() { return { remove() { removed = true; } }; },
    async startDiscovery() { throw new Error('unavailable'); },
    async stopDiscovery() {},
  };
  await assert.rejects(AccordPrinter.startDiscovery(3, () => {}), /unavailable/);
  assert.equal(removed, true);
});

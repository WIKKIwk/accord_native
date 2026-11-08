// Composition tests use spies only; no backend or printer is contacted.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/homashyo/rawSplitRuntime.ts');
test('runtime reuses real-path print functions, preflight and independent home/history controllers', async () => {
  const calls = [], session = { token: 'dummy' }, device = { transport: 'bluetooth' }, result = { id: 'result' }, output = { barcode: 'barcode' };
  class Home { constructor(options) { this.options = options; } dispose() { calls.push('dispose-home'); } }
  class History { constructor(options) { this.options = options; } dispose() { calls.push('dispose-history'); } }
  const preflight = () => true, mocks = { './rawSplitController': { RawSplitController: Home },
    './rawSplitHistoryController': { RawSplitHistoryController: History }, './rawSplitPrintRuntime': {
      rawSplitPrinterSupported: preflight, printRawSplitResult: async (...args) => calls.push(['all', ...args]),
      printRawSplitRoll: async (...args) => calls.push(['one', ...args]) } };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const selectPrinter = async () => device, onMessage = () => {}, onIssueVisible = () => {}, onUnsupportedPrinter = () => {};
  const runtime = mod.exports.createRawSplitRuntime({ session, selectPrinter, onMessage, onIssueVisible, onUnsupportedPrinter });
  assert.equal(runtime.home.options.printerSupported, preflight); assert.equal(runtime.history.options.printerSupported, preflight);
  assert.equal(runtime.home.options.selectPrinter, selectPrinter); assert.equal(runtime.history.options.selectPrinter, selectPrinter);
  assert.equal(runtime.home.options.onIssueVisible, onIssueVisible); assert.equal(runtime.home.options.onUnsupportedPrinter, onUnsupportedPrinter);
  const guard = () => {}; await runtime.home.options.print(result, device, 'zebra', guard);
  await runtime.history.options.printOne(result, output, device, 'zebra', guard);
  assert.deepEqual(calls[0], ['all', session, result, device, 'zebra', guard]);
  assert.deepEqual(calls[1].slice(0, -1), ['one', session, result, output, device, 'zebra']); assert.equal(calls[1].at(-1), guard);
  runtime.dispose(); assert.deepEqual(calls.slice(-2), ['dispose-home', 'dispose-history']);
});

// Composition only: no navigation, backend, camera or printer is started.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const file = path.resolve(__dirname, '../src/homashyo/RawSplitResultBinding.tsx');
function bind(state, calls) {
  const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
  const mocks = { react: { useSyncExternalStore: (_sub, get) => get() },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, './RawSplitDetails': { RawSplitDetails: 'RawSplitDetails' } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const controller = { capturePrinterLease: () => () => true, subscribe: () => () => {}, getSnapshot: () => state, setWifiPrinter: value => calls.push(['wifi', value]),
    reprint: async (result, output) => calls.push(['print', result, output]) };
  const result = { id: 'r', outputs: [{ barcode: 'a' }, { barcode: 'b' }] };
  const onSelectPrinterAfterDismiss = () => calls.push('picker-after-dismiss'), onError = error => calls.push(['error', error]);
  const pendingController = { subscribe: () => () => {}, getSnapshot: () => ({ pendingCheck: 'ready', busy: false }) };
  return { tree: mod.exports.RawSplitResultBinding({ controller, pendingController, result, onSelectPrinterAfterDismiss, onError }), result, onSelectPrinterAfterDismiss, onError };
}
test('history result binds existing details to exact print operations and dismiss-before-picker callback', async () => {
  const calls = [], h = bind({ printer: null, wifiPrinter: 'godex' }, calls), props = h.tree.props;
  assert.equal(h.tree.type, 'RawSplitDetails'); assert.equal(props.printerLabel, null); assert.equal(props.showWifiSelector, false);
  assert.equal(props.onSelectPrinter, h.onSelectPrinterAfterDismiss); assert.equal(props.onError, h.onError);
  props.onSelectPrinter(); props.onWifiChanged('zebra'); await props.onReprint(h.result.outputs[1]); await props.onReprintAll();
  assert.deepEqual(calls, ['picker-after-dismiss', ['wifi', 'zebra'], ['print', h.result, h.result.outputs[1]], ['print', h.result, undefined]]);
});
test('the existing details sheet receives current Wi-Fi printer selection', () => {
  const h = bind({ printer: { transport: 'wifi' }, wifiPrinter: 'zebra' }, []);
  assert.equal(h.tree.props.printerLabel, 'wifi'); assert.equal(h.tree.props.showWifiSelector, true); assert.equal(h.tree.props.wifiPrinter, 'zebra');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { hooks, tick } = require('./support/workerPaddonHarness.cjs');

const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function fixture() {
  const runner = hooks(), navigations = [], calls = []; let current = true;
  runner.react.useContext = () => () => calls.push('native-close');
  const { useWorkerPrinterSelector } = load('src/components/useWorkerPrinterSelector.ios.tsx', {
    react: runner.react,
    '../nativeSheet': { useNativeSheet: () => ({ open: (...args) => navigations.push(args) }) },
    '../preparation/PreparationPrinterPicker': { PreparationPrinterPicker: 'Picker' },
    './WorkerOrderSheet': { WorkerOrderSheet: 'Sheet' },
    './workerSheetContext': { WorkerSheetCloseContext: {} },
  });
  const render = () => { runner.begin(); const owner = useWorkerPrinterSelector(() => current); runner.flush(); return owner; };
  return { calls, navigations, runner, render, expire: () => { current = false; },
    picker: sheet => sheet.props.children.type(sheet.props.children.props) };
}

test('WIP printer selection stays in its presented sheet without navigating away from the owner', async () => {
  const h = fixture(), pending = h.render().selectDevice();
  const owner = h.render();
  assert.deepEqual(h.navigations, [], 'opening another route dismisses the SwiftUI WIP sheet');
  assert.equal(owner.dialogs.type, 'Sheet');
  assert.equal(owner.dialogs.props.dismissible, true);
  const picker = h.picker(owner.dialogs);
  assert.equal(picker.props.emptyLabel, 'Bluetooth printer topilmadi');
  assert.equal(picker.props.title, 'Bluetooth printer');
  owner.dialogs.props.onClose(); assert.equal(await pending, null);
  assert.equal(h.render().dialogs, null);
  h.runner.dispose();
});

test('worker printer choice waits for native dismissal and ignores a late previous dismissal', async () => {
  const h = fixture(), printer = { transport: 'bluetooth', printer: { address: 'unit' } };
  let settled = false;
  const pending = h.render().selectDevice().then(value => { settled = true; return value; });
  const first = h.render().dialogs;
  h.picker(first).props.select(printer); await tick();
  assert.deepEqual(h.calls, ['native-close']); assert.equal(settled, false);
  first.props.onClose(); assert.deepEqual(await pending, printer);
  const next = h.render().selectDevice(), second = h.render().dialogs;
  assert.notEqual(first.key, second.key, 'a new picker must receive fresh native presentation state');
  first.props.onClose();
  let nextSettled = false; next.then(() => { nextSettled = true; }); await tick();
  assert.equal(nextSettled, false);
  second.props.onClose(); assert.equal(await next, null);
  h.runner.dispose();
});

test('expired or unmounted worker printer selections cannot continue printing', async () => {
  const h = fixture(), owner = h.render(), pending = owner.selectDevice(), sheet = h.render().dialogs;
  h.picker(sheet).props.select({ transport: 'bluetooth' }); h.expire(); sheet.props.onClose();
  assert.equal(await pending, null); assert.equal(await h.render().selectDevice(), null);
  h.runner.dispose();

  const unmounted = fixture(), abandoned = unmounted.render().selectDevice(), old = unmounted.render().dialogs;
  unmounted.runner.dispose(); assert.equal(await abandoned, null);
  old.props.onClose();
});

test('duplicate printer requests keep the first picker and cancellation permits a fresh open', async () => {
  const h = fixture(), owner = h.render(), first = owner.selectDevice(), sheet = h.render().dialogs;
  assert.equal(await owner.selectDevice(), null);
  assert.equal(h.render().dialogs.key, sheet.key);
  h.picker(sheet).props.select(null); sheet.props.onClose(); assert.equal(await first, null);
  const next = h.render().selectDevice(), nextSheet = h.render().dialogs;
  assert.notEqual(nextSheet.key, sheet.key); nextSheet.props.onClose(); assert.equal(await next, null);
  h.runner.dispose();
});

test('Expo Go missing printer module stays visible in the picker until explicit cancellation', async () => {
  const h = fixture(); let settled = false;
  const pending = h.render().selectDevice().then(value => { settled = true; return value; });
  const sheet = h.render().dialogs, props = h.picker(sheet).props, runner = hooks();
  const { AccordPrinter } = load('modules/accord-printer/src/AccordPrinterModule.ts', {
    expo: { NativeModule: class {}, requireOptionalNativeModule: () => null },
  });
  const { PreparationPrinterPicker } = load('src/preparation/PreparationPrinterPicker.ios.tsx', {
    react: runner.react,
    '@expo/ui/swift-ui': new Proxy({}, { get: (_target, name) => String(name) }),
    '@expo/ui/swift-ui/modifiers': { disabled: value => value },
    '../printing/nativePrinter': { NativeBluetoothPrinter: { discoverPrinters: listener => AccordPrinter.startDiscovery(1, listener) } },
    './PreparationUI': { usePreparationText: () => value => value },
  });
  const render = () => { runner.begin(); const tree = PreparationPrinterPicker(props); runner.flush(); return tree; };
  render(); await tick(); const tree = render();
  assert.ok(nodes(tree, node => node.type === 'Text' && node.props.children === 'Accord printer requires a development build').length);
  assert.equal(settled, false); assert.deepEqual(h.calls, []);
  assert.equal(h.render().dialogs.key, sheet.key);
  nodes(tree, node => node.props?.role === 'cancel')[0].props.onPress();
  assert.deepEqual(h.calls, ['native-close']); assert.equal(settled, false);
  sheet.props.onClose(); assert.equal(await pending, null);
  runner.dispose(); h.runner.dispose();
});

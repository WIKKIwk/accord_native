// Regression tests for extraction of the existing GScale device picker; all hardware is mocked.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => find(n, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)]; }
function compile(file, mocks = {}, isJsx = false) { const filename = path.resolve(__dirname, `../src/${file}`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(isJsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename); return m.exports; }
function hookHarness(connection = null) {
  const calls = [], effects = [], state = { device: { connection, scanning: false, scanResult: null, checkingAddress: false, addressError: '' } };
  const operator = { subscribe: () => () => {}, getSnapshot: () => state, selectConnection: value => calls.push(['connection', value]),
    scanDevices: async () => calls.push('scan'), checkDeviceAddress: async raw => { calls.push(['address', raw]); return null; },
    selectDevice: async value => calls.push(['select', value]) };
  let stopped = 0;
  const react = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn),
    useState: initial => [initial, value => calls.push(['set', typeof value === 'function' ? 'updater' : value])] };
  const mocks = { react, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => { stopped++; } },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} },
    '../../printing/printService': { PrintService: { detectOfflinePrinter: async () => ({ kind: 'zebra', deviceName: 'USB' }) } } };
  const { useDevicePicker } = compile('shared/printing/useDevicePicker.ts', mocks);
  const picker = useDevicePicker(operator, () => calls.push('close')); const cleanup = effects.map(effect => effect());
  return { picker, calls, operator, cleanup: async () => { await new Promise(resolve => setImmediate(resolve)); cleanup.forEach(fn => fn?.()); }, stopped: () => stopped };
}
test('extracted hook retains GScale selection objects, ordering and USB detection', async () => {
  const h = hookHarness(), server = { endpoint: { baseUrl: 'http://scale' }, handshake: { serverRef: 'x' } }, printer = { address: 'aa' };
  assert.deepEqual(h.calls[0], ['connection', null]);
  h.picker.choose('wifi'); h.picker.scan(); await h.picker.selectServer(server); await h.picker.selectBluetooth(printer); await h.picker.selectUsb();
  const selected = h.calls.filter(value => Array.isArray(value) && value[0] === 'select').map(value => value[1]);
  assert.deepEqual(selected, [{ transport: 'wifi', server }, { transport: 'bluetooth', bluetoothPrinter: printer },
    { transport: 'offline', offlinePrinter: { kind: 'zebra', deviceName: 'USB' } }]);
  assert.equal(h.calls.filter(value => value === 'close').length, 3); assert.ok(h.calls.includes('scan'));
});
test('Bluetooth discovery subscription is stopped on unmount', async () => {
  const h = hookHarness('bluetooth'); await h.cleanup(); assert.equal(h.stopped(), 1);
});
function sheet(platform, connection = null, error = '') {
  const calls = [], server = { endpoint: { baseUrl: 'http://scale' }, handshake: { serverName: 'Scale' } }, printer = { address: 'aa', displayName: 'XP' };
  const picker = { device: { connection, checkingAddress: false, addressError: '', scanning: false, scanResult: { servers: [server] } },
    address: 'http://gscale.local:39117', setAddress: value => calls.push(['address', value]), printers: [printer], scanning: false, error,
    choose: value => calls.push(['choose', value]), checkAddress: async () => calls.push('check'), selectServer: async value => calls.push(['server', value]),
    scan: () => calls.push('scan'), selectBluetooth: async value => calls.push(['bluetooth', value]), rescanBluetooth: () => calls.push('rescan'),
    selectUsb: async () => calls.push('usb') };
  const swift = new Proxy({ useNativeState: value => ({ value }) }, { get: (o, name) => o[name] ?? name });
  const compose = new Proxy({ useNativeState: value => ({ value }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': { disabled: () => ({}) },
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', View: 'View' },
    './useDevicePicker': { useDevicePicker: () => picker } };
  compose.OutlinedTextField = Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' });
  const { DeviceSheet } = compile(`shared/printing/DeviceSheet.${platform}.tsx`, mocks, true);
  const tree = DeviceSheet({ operator: {}, close: () => calls.push('close'), useText: () => x => x, Label: 'Label', Action: 'Action' });
  return { tree, calls, server, printer };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} extracted sheet retains Wi-Fi, Bluetooth, USB and cancel choices`, () => {
    const h = sheet(platform), type = platform === 'ios' ? 'Button' : 'Action';
    for (const [label, value] of [['Wi-Fi qurilma', 'wifi'], ['Bluetooth printer', 'bluetooth'], ['USB printer', 'usb']]) {
      const button = find(h.tree, n => n.type === type && n.props.label === label)[0]; assert.ok(button, label); button.props.onPress();
      assert.deepEqual(h.calls.at(-1), ['choose', value]);
    }
    find(h.tree, n => n.type === type && n.props.label === 'Bekor qilish')[0].props.onPress(); assert.equal(h.calls.at(-1), 'close');
  });
  test(`${platform} extracted sheet retains server, Bluetooth and USB selection actions`, () => {
    const type = platform === 'ios' ? 'Button' : 'Action';
    const wifi = sheet(platform, 'wifi');
    const server = find(wifi.tree, n => n.type === type && String(n.props.label).includes('Scale'))[0]; server.props.onPress();
    assert.deepEqual(wifi.calls.at(-1), ['server', wifi.server]);
    const bt = sheet(platform, 'bluetooth'); find(bt.tree, n => n.type === type && String(n.props.label).includes('XP'))[0].props.onPress();
    assert.deepEqual(bt.calls.at(-1), ['bluetooth', bt.printer]);
    const usb = sheet(platform, 'usb'); find(usb.tree, n => n.type === type && n.props.label === 'USB printerni aniqlash')[0].props.onPress();
    assert.equal(usb.calls.at(-1), 'usb');
  });
}

test('late USB detection cannot select or close a new sheet after back, cancel, unmount or session change', async () => {
  for (const reason of ['back', 'cancel', 'unmount', 'session']) {
    let complete, generation = 0, active = true, selected = 0, closed = 0;
    const detection = new Promise(resolve => { complete = resolve; });
    const state = { device: { connection: null, scanning: false, scanResult: null, checkingAddress: false, addressError: '' } };
    const operator = { subscribe: () => () => {}, getSnapshot: () => state,
      selectConnection: connection => { generation++; state.device.connection = connection; }, scanDevices: async () => {},
      checkDeviceAddress: async () => null, selectDevice: async () => { selected++; return true; },
      selectionToken: () => generation, isSelectionCurrent: token => active && token === generation };
    const react = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => fn(), useState: initial => [initial, () => {}] };
    const { useDevicePicker } = compile('shared/printing/useDevicePicker.ts', { react, 'react-native': { Platform: { OS: 'ios' } },
      '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => {} },
      '../../printing/nativePrinter': { NativeBluetoothPrinter: {} },
      '../../printing/printService': { PrintService: { detectOfflinePrinter: () => detection } } });
    const picker = useDevicePicker(operator, () => closed++); picker.choose('usb'); const pending = picker.selectUsb();
    if (reason === 'back') picker.choose(null); else active = false;
    complete({ kind: 'zebra', deviceName: 'USB' }); await pending;
    assert.equal(selected, 0, reason); assert.equal(closed, 0, reason);
  }
});
test('late Bluetooth watcher setup is stopped even when the sheet unmounts first', async () => {
  let ready, stopped = 0; const watch = new Promise(resolve => { ready = resolve; }), effects = [];
  const react = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn), useState: initial => [initial, () => {}] };
  const { useDevicePicker } = compile('shared/printing/useDevicePicker.ts', { react, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: () => watch },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} }, '../../printing/printService': { PrintService: {} } });
  const operator = { subscribe: () => () => {}, getSnapshot: () => ({ device: { connection: 'bluetooth' } }), selectConnection: () => {} };
  useDevicePicker(operator, () => {}); const cleanup = effects.map(effect => effect()); cleanup.forEach(fn => fn?.());
  ready(() => stopped++); await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, 1);
});

function guardedHook(overrides = {}) {
  const calls = [], state = { device: { connection: null, scanning: false, scanResult: null, checkingAddress: false, addressError: '' } };
  let generation = 0, active = true, closed = 0;
  const operator = { subscribe: () => () => {}, getSnapshot: () => state,
    selectConnection: connection => { generation++; state.device.connection = connection; }, scanDevices: async () => {},
    checkDeviceAddress: async () => null, selectDevice: async () => true,
    selectionToken: () => generation, isSelectionCurrent: token => active && token === generation, ...overrides };
  const react = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => fn(),
    useState: initial => [initial, value => calls.push(typeof value === 'function' ? 'updater' : value)] };
  const { useDevicePicker } = compile('shared/printing/useDevicePicker.ts', { react, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => {} },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} },
    '../../printing/printService': { PrintService: { detectOfflinePrinter: overrides.detectOfflinePrinter ?? (async () => ({ kind: 'godex' })) } } });
  const picker = useDevicePicker(operator, () => closed++);
  return { picker, calls, closed: () => closed, invalidate: () => { active = false; }, back: () => operator.selectConnection(null) };
}
test('rejected Wi-Fi, Bluetooth and USB selection shows the error and keeps the picker open', async () => {
  for (const method of ['wifi', 'bluetooth', 'usb']) {
    const h = guardedHook({ selectDevice: async () => { throw new Error('Printer ulanmagan'); } });
    if (method === 'wifi') await h.picker.selectServer({ endpoint: {}, handshake: {} });
    else if (method === 'bluetooth') await h.picker.selectBluetooth({ address: 'AA' });
    else await h.picker.selectUsb();
    assert.ok(h.calls.includes('Printer ulanmagan'), method); assert.equal(h.closed(), 0, method);
  }
});
test('late Wi-Fi/Bluetooth rejection is ignored after dismiss, back or account switch', async () => {
  for (const method of ['wifi', 'bluetooth']) for (const reason of ['dismiss', 'back', 'session']) {
    let reject; const pending = new Promise((_, r) => { reject = r; });
    const h = guardedHook({ selectDevice: () => pending });
    const operation = method === 'wifi' ? h.picker.selectServer({ endpoint: {}, handshake: {} }) : h.picker.selectBluetooth({ address: 'AA' });
    if (reason === 'back') h.back(); else h.invalidate();
    const before = h.calls.length; reject(new Error('late failure')); await operation;
    assert.equal(h.calls.length, before, `${method}/${reason}`); assert.equal(h.closed(), 0, `${method}/${reason}`);
  }
});
test('late manual address and scan failures do not select, close, or update a dismissed picker', async () => {
  for (const method of ['address', 'scan']) for (const outcome of ['success', 'failure']) {
    let settle, selectCount = 0;
    const pending = new Promise((resolve, reject) => { settle = outcome === 'success' ? resolve : reject; });
    const h = guardedHook({ checkDeviceAddress: () => pending, scanDevices: () => pending,
      selectDevice: async () => { selectCount++; return true; } });
    const operation = method === 'address' ? h.picker.checkAddress() : (h.picker.scan(), null);
    h.invalidate(); const before = h.calls.length; settle(outcome === 'success' ? { endpoint: {}, handshake: {} } : new Error('late'));
    if (operation) await operation; await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, before, `${method}/${outcome}`); assert.equal(selectCount, 0); assert.equal(h.closed(), 0);
  }
});
test('a boolean rejection also leaves the sheet open', async () => {
  const h = guardedHook({ selectDevice: async () => false }); await h.picker.selectServer({ endpoint: {}, handshake: {} });
  assert.equal(h.closed(), 0);
});

for (const platform of ['ios', 'android']) test(`${platform} sheet shows the rejected selection reason`, () => {
  const h = sheet(platform, 'usb', 'Printer ulanmagan');
  assert.ok(find(h.tree, n => (n.type === 'Text' || n.type === 'Label') && n.props.children === 'Printer ulanmagan').length);
});
test('late Bluetooth discovery events after unmount do not update UI state', async () => {
  let callback, stopped = 0; const changes = [], effects = [];
  const react = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn),
    useState: initial => [initial, value => changes.push(value)] };
  const { useDevicePicker } = compile('shared/printing/useDevicePicker.ts', { react, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async (_os, _native, cb) => { callback = cb; return () => stopped++; } },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} }, '../../printing/printService': { PrintService: {} } });
  const operator = { subscribe: () => () => {}, getSnapshot: () => ({ device: { connection: 'bluetooth' } }), selectConnection: () => {} };
  useDevicePicker(operator, () => {}); const cleanup = effects.map(effect => effect()); await new Promise(resolve => setImmediate(resolve));
  cleanup.forEach(fn => fn?.()); const before = changes.length; callback({ printer: { address: 'late' }, complete: true });
  assert.equal(stopped, 1); assert.equal(changes.length, before);
});

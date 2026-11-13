const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports; }
const discovery = load('gscale/gscaleDiscovery');
const printRuntime = load('homashyo/rawSplitPrintRuntime', { './rawSplitWritePolicy': load('homashyo/rawSplitWritePolicy'), 'react-native': { Platform: { OS: 'android' } }, '../printing/printService': {}, './rawSplitApi': {}, './rawSplitPrinting': {} });
const { rawSplitDeviceSelection, validateRawSplitDeviceSelection } = load('homashyo/rawSplitDeviceSelection',
  { '../gscale/gscaleDiscovery': discovery, './rawSplitPrintRuntime': printRuntime });
function server(ref, name = 'Scale', port = 39117) { return { endpoint: { host: '192.168.1.10', port, baseUrl: `http://192.168.1.10:${port}` },
  handshake: { serverName: name, serverRef: ref, displayName: 'Operator', role: 'operator', printActivity: {} }, latencyMs: 1 }; }
for (const [ref, name, port, expected] of [['5070', 'Scale', 39117, 'http://100.117.62.18:39117'],
  ['rp-scale-godex-2', 'Scale', 41257, 'http://100.117.62.18:41257'],
  ['unknown', 'Scale', 43391, 'http://192.168.1.10:43391'], ['unknown', 'rp-scale-5070', 39117, 'http://100.117.62.18:39117']]) {
  test(`Wi-Fi mapping preserves the entire ${ref}/${name} handshake and exact V2 driver`, () => {
    const original = server(ref, name, port), result = rawSplitDeviceSelection({ transport: 'wifi', server: original });
    assert.equal(result.server, original); assert.equal(result.serverBaseUrl, original.endpoint.baseUrl); assert.equal(result.driverBaseUrl, expected);
  });
}
test('Bluetooth and USB profiles are carried through without lookup, persistence, or reconstruction', () => {
  const bluetooth = { address: 'AA' }, usb = { kind: 'zebra', deviceName: 'USB' };
  assert.deepEqual(rawSplitDeviceSelection({ transport: 'bluetooth', bluetoothPrinter: bluetooth }), { transport: 'bluetooth', printer: bluetooth });
  assert.deepEqual(rawSplitDeviceSelection({ transport: 'offline', offlinePrinter: usb }), { transport: 'offline', printer: usb });
});

test('Android Zebra USB, Wi-Fi and Bluetooth are selectable while unsupported USB stays rejected', () => {
  for (const kind of ['godex', 'unknown']) assert.throws(() => validateRawSplitDeviceSelection({ transport: 'offline', offlinePrinter: { kind } }));
  assert.doesNotThrow(() => validateRawSplitDeviceSelection({ transport: 'offline', offlinePrinter: { kind: 'zebra' } }));
  assert.doesNotThrow(() => validateRawSplitDeviceSelection({ transport: 'bluetooth', bluetoothPrinter: { address: 'AA' } }));
  assert.doesNotThrow(() => validateRawSplitDeviceSelection({ transport: 'wifi', server: server('5070') }));
  for (const wifiKind of ['godex', 'unknown', '']) assert.equal(printRuntime.rawSplitPrinterSupported(rawSplitDeviceSelection({ transport: 'wifi', server: server('5070') }), wifiKind), false);
});
test('GoDEX and unknown USB keep the picker open; Android Zebra completes selection', async () => {
  const { createTransientDevicePicker } = load('shared/printing/transientDevicePicker', { '../../gscale/gscaleDiscovery': discovery });
  let detected = { kind: 'godex' }, closed = 0, errors = [];
  const request = createTransientDevicePicker({ isCurrent: () => true, scan: async () => ({ servers: [], candidateCount: 0 }),
    probe: async () => null, validateSelection: validateRawSplitDeviceSelection });
  const react = { useSyncExternalStore: (_sub, get) => get(), useEffect: fn => fn(),
    useState: initial => [initial, value => { if (typeof value === 'string') errors.push(value); }] };
  const { useDevicePicker } = load('shared/printing/useDevicePicker', { react, 'react-native': { Platform: { OS: 'android' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => {} },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} },
    '../../printing/printService': { PrintService: { detectOfflinePrinter: async () => {
      if (detected.kind === 'unknown') throw new Error('USB printer is neither GoDEX nor Zebra'); return detected; } } } });
  const picker = useDevicePicker(request.adapter, () => closed++, true); picker.choose('usb');
  await picker.selectUsb(); assert.equal(closed, 0); assert.ok(errors.length > 0);
  detected = { kind: 'unknown' }; await picker.selectUsb(); assert.equal(closed, 0); assert.ok(errors.some(e => e.includes('neither GoDEX nor Zebra')));
  detected = { kind: 'zebra' }; await picker.selectUsb(); assert.equal(closed, 1);
  request.onDismiss(); const selected = await request.result; assert.equal(selected.transport, 'offline');
  assert.equal(selected.offlinePrinter, detected);
});

test('iOS Bluetooth is selectable through the shared bridge and iOS USB remains unavailable', () => {
  const iosPrint = load('homashyo/rawSplitPrintRuntime', { './rawSplitWritePolicy': load('homashyo/rawSplitWritePolicy'), 'react-native': { Platform: { OS: 'ios' } }, '../printing/printService': {}, './rawSplitApi': {}, './rawSplitPrinting': {} });
  const iosSelection = load('homashyo/rawSplitDeviceSelection', { '../gscale/gscaleDiscovery': discovery, './rawSplitPrintRuntime': iosPrint });
  assert.doesNotThrow(() => iosSelection.validateRawSplitDeviceSelection({ transport: 'bluetooth', bluetoothPrinter: { address: 'A' } }));
  assert.throws(() => iosSelection.validateRawSplitDeviceSelection({ transport: 'offline', offlinePrinter: { kind: 'zebra' } }));
  assert.doesNotThrow(() => validateRawSplitDeviceSelection({ transport: 'bluetooth', bluetoothPrinter: { address: 'A' } }));
});

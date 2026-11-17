const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const native = Object.fromEntries(['Button', 'DisclosureGroup', 'Host', 'HStack', 'Image', 'List', 'ProgressView', 'RNHostView', 'Section', 'Text', 'TextField', 'VStack'].map(name => [name, name]));
const modifiers = new Proxy({}, { get: (_target, name) => value => ({ name, value }) });
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return loaded.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const button = (tree, label) => nodes(tree, node => node.type === 'Button' && node.props.label === label)[0];
const disabled = node => node.props.modifiers.some(value => value.name === 'disabled' && value.value === true);
const flush = () => new Promise(resolve => setImmediate(resolve));
const entry = { epc: 'EPC', item_name: 'Film', gross_qty: 11, net_qty: 10, unit: 'kg', draft_name: 'REC-1', printed_at: '2026', status: 'ready' };
const batch = { item_name: 'Batch Film', item_code: 'FILM', active: false, batch_code: 'B1', warehouse: 'W1', total_qty: 10,
  gross_qty: 11, net_qty: 10, unit: 'kg', tare_enabled: true, tare_kg: 1, print_count: 2, started_at: 'start', ended_at: 'end',
  preparation_formula: { variant_name: 'Formula', material_name: 'Material', captured_at: 'captured', formulas: [] }, prints: [entry, { ...entry, epc: '' }] };

test('iOS Material archive exposes full source detail fields and only opens nonempty receipt QR rows', () => {
  const sheet = { content: null, options: null, open(content, options) { this.content = content; this.options = options; }, close() {} };
  const presentation = load('gscale/gscaleMaterialPresentation.ts', {
    './gscaleArchive': { formatArchiveTimestamp: raw => `time:${raw}` }, './gscalePreparation': { formatCompactKg: String },
  });
  const { MaterialArchiveDetails, MaterialArchiveReceipt } = load('gscale/MaterialArchive.ios.tsx', {
    'react/jsx-runtime': jsx, react: { useMemo: callback => callback() }, '@expo/ui/swift-ui': native,
    '@expo/ui/swift-ui/modifiers': modifiers, 'expo-image': { Image: 'QrImage' }, 'qrcode-generator': () => ({ addData() {}, make() {}, createDataURL: () => 'data:qr' }),
    'react-native': { PlatformColor: name => name, View:'View' }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../customer/CustomerSnackbar.ios': { CustomerSnackbar:'Snackbar' },
    './gscaleMaterialPresentation': presentation, './useGScaleScreen': { useGScaleText: () => value => value },
    './useMaterialArchiveReceipt': { useMaterialArchiveReceipt: () => ({ printing: false, error: '', success: '', reprint() {} }) },
  });
  let current = true;
  const props = { batch, operator: {}, isCurrent: () => current, close() {} }, tree = MaterialArchiveDetails(props);
  assert.deepEqual(nodes(tree, node => node.type?.name === 'Detail').map(node => node.props.label),
    ['Holat', 'Batch', 'Ombor', 'Shnek formulasi', 'Homashyo', 'Formula olingan', 'Boshlangan', 'Tugagan', 'Brutto / netto', 'Tara', 'Printlar']);
  const receipts = nodes(tree, node => node.type === 'Button' && !node.props.label);
  assert.equal(disabled(receipts[0]), false); assert.equal(disabled(receipts[1]), true);
  receipts[1].props.onPress(); assert.equal(sheet.content, null);
  receipts[0].props.onPress(); assert.equal(sheet.content.type, MaterialArchiveReceipt); assert.equal(sheet.content.props.entry, entry);
  assert.equal(sheet.options.dismissible, true);
  current = false; assert.equal(MaterialArchiveDetails(props), null);
});

test('iOS archive receipt preserves source details, printing label and blocked close while printing', () => {
  const calls = [], model = { printing: true, error: 'warning', success: 'Mavjud QR qayta chop etildi', reprint: () => calls.push('print') };
  const component = load('gscale/MaterialArchive.ios.tsx', {
    'react/jsx-runtime': jsx, react: { useMemo: callback => callback() }, '@expo/ui/swift-ui': native,
    '@expo/ui/swift-ui/modifiers': modifiers, 'expo-image': { Image: 'QrImage' }, 'qrcode-generator': () => ({ addData() {}, make() {}, createDataURL: () => 'data:qr' }),
    'react-native': { PlatformColor: name => name, View:'View' }, '../nativeSheet': {},
    '../customer/CustomerSnackbar.ios': { CustomerSnackbar:'Snackbar' },
    './gscaleMaterialPresentation': { materialArchiveReceiptDetails: () => [['Kirim raqami', 'REC-1'], ['Miqdor', 'B 11 / N 10 kg'], ['Ombor', 'W1']] },
    './useGScaleScreen': { useGScaleText: () => value => value }, './useMaterialArchiveReceipt': { useMaterialArchiveReceipt: () => model },
  }).MaterialArchiveReceipt;
  const tree = component({ batch, entry, operator: {}, isCurrent: () => true, close() {} });
  assert.deepEqual(nodes(tree, node => node.type?.name === 'Detail').map(node => node.props.label), ['Kirim raqami', 'Miqdor', 'Ombor']);
  assert.equal(nodes(tree, node => node.type === 'Text' && node.props.children === 'Chop etilmoqda…').length, 1);
  assert.equal(disabled(button(tree, 'Yopish')), true);
  assert.equal(disabled(nodes(tree, node => node.type === 'Button' && !node.props.label)[0]), true);
  assert.equal(nodes(tree, node => node.type === 'Text' && node.props.children === 'warning').length, 1);
  assert.equal(nodes(tree, node => node.type === 'Text' && node.props.children === model.success).length, 0);
  assert.equal(nodes(tree, node => node.type === 'Snackbar')[0].props.message,model.success);
});

function pickerSetup() {
  const calls = [], server = { endpoint: { host: 'scale', port: 39117, baseUrl: 'http://scale:39117' }, handshake: { serverName: 'Printer' } };
  let current = true;
  const sheet = { content: null, options: null, open(content, options) { this.content = content; this.options = options; calls.push('open'); },
    close() { calls.push('closeManual'); }, isOpen: () => false, update() {} };
  const picker = { address: 'http://scale:39117', device: { connection: null, scanning: false, scanResult: null, checkingAddress: false, addressError: '' },
    printers: [], scanning: false, error: '', friendlyError: '', choose: choice => calls.push(['choose', choice]), scan() {}, rescanBluetooth() {},
    setAddress: value => calls.push(['address', value]), probeAddress: async () => { calls.push('probe'); return server; },
    selectServer: async value => calls.push(['select', value]), selectUsb() {}, selectBluetooth() {} };
  const react = { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: callback => callback() };
  const components = load('shared/printing/MaterialDevicePicker.ios.tsx', {
    'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': { ...native, useNativeState: value => ({ get: () => value, set() {} }) },
    '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { PlatformColor: name => name, View:'View' },
    '../../customer/CustomerSnackbar.ios': { CustomerSnackbar:'Snackbar' }, './useMaterialDeviceNotice': { useMaterialDeviceNotice:()=>'' },
    '../../nativeSheet': { useNativeSheet: () => sheet }, './useDevicePicker': { useDevicePicker: () => picker },
    './useMaterialManualServer': { useMaterialManualServer: (probe, isCurrent, complete) => async () => { const value = await probe(); if (value && isCurrent()) complete(value); } },
  });
  const props = { operator: {}, close() {}, useText: () => value => value, materialReceipt: { apiBaseUrl: 'url', isCurrent: () => current } };
  return { ...components, calls, server, sheet, picker, props, retire: () => { current = false; } };
}

test('iOS Material device picker preserves connection order and nested manual probe before outer selection', async () => {
  const h = pickerSetup(), tree = h.MaterialDevicePicker(h.props);
  assert.deepEqual(nodes(tree, node => node.type === 'Button').slice(0, 3).map(node => node.props.label), ['USB', 'Bluetooth', 'Wi-Fi']);
  h.picker.device.connection = 'wifi'; button(h.MaterialDevicePicker(h.props), 'Wi-Fi manzilini qo‘shish').props.onPress();
  const manual = h.sheet.content.type(h.sheet.content.props);
  assert.equal(nodes(manual, node => node.type === 'Text' && node.props.children === 'Masalan: 192.168.1.12:39117').length, 1);
  nodes(manual, node => node.type === 'Button' && !node.props.label)[0].props.onPress(); await flush();
  assert.deepEqual(h.calls, ['open', 'probe', 'closeManual']);
  h.sheet.options.onDismiss(); await flush(); assert.deepEqual(h.calls.at(-1), ['select', h.server]);
});

test('dismissed or expired manual-server flow does not select a device', async () => {
  const h = pickerSetup(); h.picker.device.connection = 'wifi'; button(h.MaterialDevicePicker(h.props), 'Wi-Fi manzilini qo‘shish').props.onPress();
  h.sheet.options.onDismiss(); assert.equal(h.calls.some(value => Array.isArray(value) && value[0] === 'select'), false);
  h.retire(); assert.equal(h.MaterialDevicePicker(h.props), null);
});

test('shared archive reprint suppresses double taps and late account completion while retaining warning plus success', async () => {
  const states = [], refs = [], effects = []; let cursor = 0, refCursor = 0, current = true, resolve, prints = 0;
  const react = { useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = value; }]; }, useRef(initial) { return refs[refCursor++] ??= { current: initial }; },
  useEffect(callback) { effects.push(callback); } };
  const { useMaterialArchiveReceipt, materialArchiveReceiptError } = load('gscale/useMaterialArchiveReceipt.ts', {
    react, '../shared/mobileApiException': { MobileApiException: class extends Error {} },
  });
  const operator = { reprintArchiveReceipt: () => { prints++; return new Promise(done => { resolve = done; }); } };
  const render = () => { cursor = 0; refCursor = 0; return useMaterialArchiveReceipt(entry, operator, () => current); };
  const first = render(); first.reprint(); first.reprint(); assert.equal(prints, 1);
  resolve('QR chop etildi, lekin server tasdig‘i saqlanmadi'); await flush();
  assert.deepEqual(states, [false, 'QR chop etildi, lekin server tasdig‘i saqlanmadi', 'Mavjud QR qayta chop etildi']);
  render().reprint(); current = false; resolve(null); await flush();
  assert.deepEqual(states, [true, '', '']);
  assert.equal(materialArchiveReceiptError('Bad state: Exception: printer'), 'printer');
});

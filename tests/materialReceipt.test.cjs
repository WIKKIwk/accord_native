const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '../src', relative), loaded = new Module(file, module);
  loaded.filename = file; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
  return loaded.exports;
}
const { MaterialReceiptPrinterPolicy, materialReceiptPrinterSelectionKey } = load('gscale/gscaleMaterialPolicy.ts');
const wifi = { transport: 'wifi', server: { endpoint: { baseUrl: 'http://scale:39117' } } };
const bluetooth = { transport: 'bluetooth', bluetoothPrinter: { address: 'AA:BB', printer: 'xp-p323b' } };
const usb = { transport: 'offline', offlinePrinter: { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f,
  productId: 1, deviceName: '/dev/usb/1' } };
const snapshot = selection => ({ device: { selection, transport: selection.transport, needsAttention: false },
  draft: { printer: 'zebra' }, batch: { resolved: true, batch: { id: 'b', revision: 3, printer: 'zebra' } },
  monitor: { printerKind: 'zebra', printerLabel: 'Zebra' } });

test('Material receipt keeps all V2 connection choices while excluding GoDEX', () => {
  const policy = new MaterialReceiptPrinterPolicy(() => true);
  for (const selection of [wifi, bluetooth, usb]) {
    assert.equal(policy.allowSelection(selection), true);
    for (const operation of ['start', 'stop', 'print', 'archive', 'reprint'])
      assert.doesNotThrow(() => policy.assertOperation(operation, snapshot(selection)));
  }
  const godex = { ...usb, offlinePrinter: { ...usb.offlinePrinter, kind: 'godex', printer: 'godex' } };
  assert.equal(materialReceiptPrinterSelectionKey(godex), null);
  assert.equal(policy.allowSelection(godex), false);
  for (const changed of [
    { ...snapshot(wifi), draft: { printer: 'godex' } },
    { ...snapshot(wifi), monitor: { printerKind: 'godex', printerLabel: '' } },
    { ...snapshot(wifi), monitor: { printerKind: '', printerLabel: 'Go-DEX connected' } },
    { ...snapshot(usb), batch: { resolved: true, batch: { id: 'b', revision: 3, printer: 'godex' } } },
  ]) assert.throws(() => policy.assertOperation('print', changed), /Printer ulanmagan/);
  assert.throws(() => policy.assertOperation('archive', snapshot(wifi), { requestPrinter: 'godex' }), /Printer ulanmagan/);
  assert.doesNotThrow(() => policy.assertOperation('archive', snapshot(bluetooth), { requestPrinter: 'xp-p323b' }));
});

test('Material receipt binds delayed work to the original account, selection and batch revision', () => {
  let current = true;
  const policy = new MaterialReceiptPrinterPolicy(() => current), state = snapshot(wifi);
  const expected = { selection: materialReceiptPrinterSelectionKey(wifi), batchId: 'b', batchRevision: 3 };
  policy.assertOperation('print', state, expected);
  assert.throws(() => policy.assertOperation('print', snapshot(usb), expected), /Printer ulanmagan/);
  state.batch.batch.revision = 4;
  assert.throws(() => policy.assertOperation('print', state, expected), /Printer ulanmagan/);
  current = false;
  assert.equal(policy.allowSelection(wifi), false);
  for (const operation of ['start', 'stop', 'print', 'archive', 'reprint'])
    assert.throws(() => policy.assertOperation(operation, state), /Sessiya tugagan/);
});

test('Material receipt requires the original witness, real role, token and GScale permission', () => {
  const session = { profile: { role: 'material_taminotchi' }, token: 'token' }, witness = { session };
  let current = true, permission = true, reserved = false;
  const { materialReceiptCurrent } = load('material/materialReceiptAccess.ts', {
    '../auth': { activeSessionToken: value => value.token, isSessionWitnessCurrent: value => value === witness && current },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'scale' }, canOpenRoute: (_s, route) => permission && route === 'scale' },
    './materialTestSession': { isMaterialTestSession: () => reserved },
  });
  assert.equal(materialReceiptCurrent(session, witness), true);
  assert.equal(materialReceiptCurrent({ ...session }, witness), false);
  current = false; assert.equal(materialReceiptCurrent(session, witness), false); current = true;
  permission = false; assert.equal(materialReceiptCurrent(session, witness), false); permission = true;
  reserved = true; assert.equal(materialReceiptCurrent(session, witness), false); reserved = false;
  session.token = ''; assert.equal(materialReceiptCurrent(session, witness), false); session.token = 'token';
  session.profile.role = 'tayyorlov_masteri'; assert.equal(materialReceiptCurrent(session, witness), false);
});

test('embedded Android receipt keeps Material navigation and leaves its dock to the parent shell', () => {
  const calls = [], jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = load('gscale/GScaleReceipt.android.tsx', {
    'react/jsx-runtime': jsx,
    react: { createContext: () => ({}), useContext: () => null, useCallback: value => value,
      useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    '@expo/ui/jetpack-compose': { Host: 'Host', Text: 'Text', Icon: 'Icon', IconButton: 'IconButton', Shape: { RoundedCorner: value => value },
      useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }),
    'expo-router': { router: { navigate: () => { throw new Error('Preparation navigation leaked'); } } },
    'react-native': { Keyboard: { metrics: () => undefined }, KeyboardAvoidingView: 'KeyboardAvoidingView', View: 'View',
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 400, height: 800, fontScale: 1 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot' },
    '../components/WorkerQueueCard.android': {}, '../preparation/PreparationUI.android': { PreparationDock: 'PreparationDock' },
    '../shared/navigation/RoleHeaderRow': require('./support/roleNavigation.cjs').header,
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'HeaderButton' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'Workspace' }, './gscaleReceiptLayout': {},
    './useGScaleScreen': { useGScaleText: () => value => value },
    '../../assets/icons/gscale/add_link.xml': {}, '../../assets/icons/gscale/check_circle.xml': {},
    '../../assets/icons/gscale/expand_more.xml': {}, '../../assets/icons/gscale/warehouse.xml': {},
    '../../assets/icons/gscale/search.xml': {}, '../../assets/icons/gscale/save.xml': {},
    '../../assets/icons/gscale/play_arrow.xml': {}, '../../assets/icons/gscale/print.xml': {},
    '../../assets/icons/gscale/stop_circle.xml': {}, '../../assets/icons/gscale/edit.xml': {}, '../../assets/icons/gscale/scale.xml': {},
  });
  const tree = component.GScaleReceipt({ session: {}, title: 'Homashyo kirimi', section: 'control', embedded: true,
    onSelect() {}, control: [], history: [], connected: false, attention: false, refreshing: false,
    onRefresh() {}, onDevices() {}, onBack() {}, onMenu: () => calls.push('menu'), onProfile: () => calls.push('profile') });
  function nodes(node, type) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
    return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
  }
  assert.equal(nodes(tree, 'PreparationDock').length, 0);
  const header = nodes(tree, 'HeaderButton');
  assert.equal(header[0].props.icon, 'menu'); header[0].props.onPress(); header[1].props.onPress();
  assert.deepEqual(calls, ['menu', 'profile']);
  assert.equal(nodes(tree, 'KeyboardAvoidingView')[0].props.style[1].marginBottom, 0);
  assert.deepEqual(nodes(tree, 'Workspace')[0].props.tabs.map(tab => tab.name), ['Print', 'Print tarixi']);
});

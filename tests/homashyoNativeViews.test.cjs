// Platform render tree checks; actual native behaviour and physical devices remain unverified.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => find(n, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)]; }
function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join('');
  return node && typeof node === 'object' ? text(node.props?.children) : ''; }
function load(name, mocks = {}, jsxEnabled = false) { const filename = path.resolve(__dirname, `../src/homashyo/${name}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(jsxEnabled ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename); return mod.exports; }
const model = load('rawSplitModel.ts');
const presentation = load('rawSplitHistoryPresentation.ts', { './rawSplitModel': model });
const source = { revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM', item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const output = { ...source, stock_id: 'child', barcode: 'child', kg: '98', gross_kg: '99', bobina_kg: '1', length_m: '1000', width_mm: '1000' };
const result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2', issue_id: 'issue', issue_note: 'note', outputs: [output] });
const issue = new model.RawSplitIssue({ id: 'issue', request_id: 'id', source, source_kg: '100', output_kg: '98.000000', entered_waste_kg: '1',
  waste_kg: '1.000000', difference_kg: '1.000000', kind: 'missing_weight', outputs: [output], note: 'note', actor_ref: 'a', actor_name: 'Cutter', created_at: '2026-09-08T12:00:00Z' });
function history(platform) {
  let effects = [], loads = 0, selectedResult, selectedIssue;
  const state = { snapshot: null, printer: null, wifiPrinter: 'godex', error: null, busy: false };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, reload: async () => { loads++; } };
  const react = { useEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': new Proxy({}, { get: (_, name) => name }),
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surface: 'surface', onSurface: 'text', onSurfaceVariant: 'muted' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'NativeText', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../preparation/PreparationUI': { PreparationList: 'PreparationList' }, './rawSplitHistoryPresentation': presentation };
  const component = load(`RawSplitHistory.${platform}.tsx`, mocks, true).RawSplitHistory;
  const render = () => { effects = []; const tree = component({ controller, onResult: value => { selectedResult = value; },
    onIssue: (value, linked) => { selectedIssue = [value, linked]; } }); effects.forEach(effect => effect()); return tree; };
  return { state, render, loads: () => loads, result: () => selectedResult, issue: () => selectedIssue };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} history shows loading, then actual snapshot rows and opens correct details`, () => {
    const h = history(platform); let tree = h.render(); assert.equal(h.loads(), 1);
    assert.ok(find(tree, n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length);
    assert.ok(!text(tree).includes('Hali bo‘lish tarixi yo‘q.'));
    h.state.snapshot = { warehouses: ['Raw W'], history: [result], issues: [issue] }; tree = h.render();
    assert.match(text(tree), /100 → 98 kg/); assert.match(text(tree), /1 rulon/);
    assert.ok(platform === 'ios' ? find(tree, n => n.type === 'Section' && n.props.title === 'Muammolar').length : text(tree).includes('Muammolar'));
    const buttonType = platform === 'ios' ? 'Button' : 'WorkerQueueCard';
    const buttons = find(tree, n => n.type === buttonType && typeof n.props?.onPress === 'function');
    assert.equal(buttons.length, 2); buttons[0].props.onPress(); buttons[1].props.onPress();
    assert.equal(h.result(), result); assert.deepEqual(h.issue(), [issue, true]);
    if (platform === 'android') assert.equal(find(tree, n => n.type === 'OrdersList').length, 1);
  });
  test(`${platform} history preserves existing issues while showing a reload error`, () => {
    const h = history(platform); h.state.snapshot = { warehouses: [], history: [result], issues: [issue] }; h.state.error = 'offline';
    const tree = h.render(); assert.match(text(tree), /Tarix yuklanmadi/); assert.match(text(tree), /offline/);
    assert.ok(platform === 'ios' ? find(tree, n => n.type === 'Section' && n.props.title === 'Muammolar').length : text(tree).includes('Muammolar'));
    assert.doesNotMatch(text(tree), /100 → 98 kg/);
  });
}
const width = load('rawSplitWidthPlan.ts', { './rawSplitModel': model });
const draft = load('rawSplitDraft.ts', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
const homePresentation = load('rawSplitHomePresentation.ts', { './rawSplitModel': model, './rawSplitWidthPlan': width, './rawSplitDraft': draft });
function home(platform) {
  const calls = [], output1 = { id: '1', width: '400', gross: '40', bobina: '1', length: '1000' };
  const output2 = { id: '2', width: '600', gross: '60', bobina: '1', length: '1500' };
  const state = { snapshot: { warehouses: ['Raw W'] }, barcode: 'parent', source: new model.RawSplitRoll(source), outputs: [output1, output2],
    waste: '2', issueNote: '', issueError: null, error: null, pending: null, pendingIssue: null, printer: null,
    wifiPrinter: 'godex', showIssue: false, issueSaved: false, savedIssueId: null, busy: false };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, reload: async () => calls.push('reload'), locked: false,
    get widthPlan() { return new width.RawSplitWidthPlan(state.source.widthMm, state.outputs.map(o => o.width)); },
    get wasteCheck() { return new model.RawSplitWasteCheck(model.rawSplitQuantity('100'), model.rawSplitQuantity('98'), state.waste); },
    setBarcode: value => calls.push(['barcode', value]), lookup: async () => calls.push('lookup'), setOutput: (...args) => calls.push(['output', ...args]),
    confirmWidth: () => calls.push('confirmWidth'), addRoll: () => calls.push('addRoll'), removeRoll: i => calls.push(['removeRoll', i]),
    setWaste: value => calls.push(['waste', value]), setIssueNote: value => calls.push(['note', value]), setWifiPrinter: value => calls.push(['wifi', value]),
    save: async retry => calls.push(['save', retry]), saveIssue: async retry => calls.push(['issue', retry]) };
  const swift = new Proxy({}, { get: (_, name) => name });
  const compose = new Proxy({ useMaterialColors: () => ({ error: 'error', surface: 'surface', onSurfaceVariant: 'muted' }) }, { get: (o, name) => o[name] ?? name });
  const react = { useEffect() {}, useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: () => () => ({}) }),
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', Text: 'NativeText', View: 'View' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../preparation/PreparationUI.android': { PreparationText: 'PreparationText' },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' }, './rawSplitHomePresentation': homePresentation };
  const component = load(`RawSplitHome.${platform}.tsx`, mocks, true).RawSplitHome;
  return { state, controller, calls, render: () => component({ controller, onScan: () => calls.push('scan') }) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} home exposes measured fields, source, balance and real actions`, () => {
    const h = home(platform), tree = h.render(); assert.match(text(tree), /Ombor: Raw W/); assert.match(text(tree), /Hisob teng ✓/);
    for (const label of ['Rulon QR / shtrix-kodi', 'Eni (mm)', 'Og‘irlik (kg)', 'Babina (kg)', 'Metraj (m)', 'Atxot (kg) *'])
      assert.ok(find(tree, n => n.props?.label === label).length, label);
    const field = find(tree, n => n.props?.label === 'Eni (mm)')[0]; field.props.onChange('500'); field.props.onDone();
    assert.deepEqual(h.calls.slice(0, 2), [['output', 0, 'width', '500'], 'confirmWidth']);
    const actionType = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
    find(tree, n => n.type === actionType && n.props.label === 'Skanerlash')[0].props.onPress();
    find(tree, n => n.type === actionType && n.props.label === 'Saqlash va chop etish')[0].props.onPress();
    assert.ok(h.calls.includes('scan')); assert.ok(h.calls.some(call => Array.isArray(call) && call[0] === 'save'));
  });
  test(`${platform} home exposes discrepancy note only when required and respects pending lock`, () => {
    const h = home(platform); h.state.waste = '1'; h.state.showIssue = true;
    let tree = h.render(); assert.match(text(tree), /1 kg hisobga olinmagan/);
    assert.ok(find(tree, n => n.props?.label === 'Farq sababi').length);
    const actionType = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
    find(tree, n => n.type === actionType && n.props.label === 'Muammoni saqlash')[0].props.onPress();
    assert.ok(h.calls.some(call => Array.isArray(call) && call[0] === 'issue'));
    h.state.pending = { request_id: 'pending' }; h.controller.locked = true; tree = h.render();
    assert.match(text(tree), /Oldingi saqlash natijasini tekshiring/);
    assert.equal(find(tree, n => n.props?.label === 'Eni (mm)')[0].props.enabled, false);
  });
}
function details(platform, printerLabel = null) {
  const calls = [], react = { useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect: fn => { fn(); } };
  const swift = new Proxy({}, { get: (_, name) => name });
  const compose = new Proxy({ useMaterialColors: () => ({ onSurface: 'text', onSurfaceVariant: 'muted', surface: 'surface' }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: () => () => ({}) }),
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', Text: 'NativeText', View: 'View' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../preparation/PreparationUI.android': { PreparationText: 'PreparationText' },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' }, './rawSplitModel': model, './rawSplitHistoryPresentation': presentation };
  const views = load(`RawSplitDetails.${platform}.tsx`, mocks, true);
  const props = { result, printerLabel, showWifiSelector: printerLabel === 'wifi', wifiPrinter: 'zebra', onSelectPrinter: () => calls.push('picker'),
    onWifiChanged: value => calls.push(['wifi', value]), onReprint: async value => { calls.push(['one', value.barcode]); },
    onReprintAll: async () => { calls.push('all'); }, onError: error => { calls.push(['error', error]); } };
  return { calls, props, resultTree: () => views.RawSplitDetails(props), issueTree: () => views.RawSplitIssueDetails({ issue, hasResult: true }) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} detail sheets show measured data and call reprint handlers`, async () => {
    const h = details(platform), tree = h.resultTree();
    assert.match(text(tree), /100 → 98 kg/); assert.match(text(tree), /Manba QR: parent/);
    assert.match(text(tree), /Brutto: 99 kg/); assert.match(text(tree), /Babina: 1 kg/); assert.match(text(tree), /child/);
    const buttonType = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
    find(tree, n => n.type === buttonType && n.props.label === 'Printer tanlash')[0].props.onPress();
    if (platform === 'ios') find(tree, n => n.type === 'Button' && n.props.label === 'Shu rulonni qayta chop etish')[0].props.onPress();
    else find(tree, n => n.type === 'IconButton')[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    find(tree, n => n.type === buttonType && n.props.label === 'Barchasini qayta chop etish')[0].props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, ['picker', ['one', 'child'], 'all']);
    const issueTree = h.issueTree(); assert.match(text(issueTree), /Muammo bo‘yicha rulonlar saqlangan/);
    assert.match(text(issueTree), /Og‘irlik: 99 kg/); assert.match(text(issueTree), /Netto: 98 kg/);
  });
  test(`${platform} detail sheet changes Wi-Fi printer using native selector`, () => {
    const h = details(platform, 'wifi'), tree = h.resultTree();
    if (platform === 'ios') find(tree, n => n.type === 'Button' && n.props.label === 'GoDEX')[0].props.onPress();
    else find(tree, n => n.type === 'DropdownFilter')[0].props.onChange('godex');
    assert.deepEqual(h.calls, [['wifi', 'godex']]);
  });
}
for (const platform of ['ios', 'android']) test(`${platform} reprint errors return to the parent instead of becoming unhandled`, async () => {
  const h = details(platform), error = new Error('printer unavailable'); h.props.onReprint = async () => { throw error; };
  const tree = h.resultTree();
  if (platform === 'ios') find(tree, n => n.type === 'Button' && n.props.label === 'Shu rulonni qayta chop etish')[0].props.onPress();
  else find(tree, n => n.type === 'IconButton')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(h.calls, [['error', error]]);
});
function scanner(platform, granted) {
  const calls = [], scan = { permission: { granted }, failed: false, manual: 'manual-code', setManual: value => calls.push(['manual', value]),
    complete: value => calls.push(['complete', value]), cameraFailed: () => calls.push('camera-failed'), title: 'Homashyo QR',
    manualLabel: 'Barcode', unavailable: 'Kamera ochilmadi. Quyidagi maydonga QR yoki barcode kiriting.', guide: 'QR kodni shu to‘r ichiga olib keling' };
  const state = value => ({ current: value, get() { return this.current; }, set(next) { this.current = next; } });
  const swift = new Proxy({ useNativeState: state }, { get: (o, name) => o[name] ?? name });
  const compose = new Proxy({ useNativeState: state, useMaterialColors: () => ({ surface: 'surface', onSurface: 'text' }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: fn => fn() }, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: () => () => ({}) }), '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }), 'expo-camera': { CameraView: 'CameraView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Text: 'NativeText', View: 'View', PlatformColor: x => x,
      StyleSheet: { create: value => value, absoluteFill: {} } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, './useRawSplitScanner': { useRawSplitScanner: () => scan } };
  // Compose slots are components, represented by names in this static render harness.
  mocks['@expo/ui/jetpack-compose'].OutlinedTextField = Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' });
  const component = load(`RawSplitScanner.${platform}.tsx`, mocks, true).RawSplitScanner;
  const root = component({ visible: true, onClose: () => calls.push('close'), onComplete: () => {} });
  return { calls, scan, tree: root.type(root.props) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} scanner forwards camera and manual codes and closes on back`, () => {
    const h = scanner(platform, true), camera = find(h.tree, n => n.type === 'CameraView')[0];
    assert.ok(camera); assert.deepEqual(camera.props.barcodeScannerSettings.barcodeTypes, ['qr', 'datamatrix']);
    camera.props.onBarcodeScanned({ raw: 'raw-code', data: 'display-code' });
    find(h.tree, n => n.type === 'WorkerSheetButton' && n.props.label === 'OK')[0].props.onPress();
    find(h.tree, n => n.type === 'Modal')[0].props.onRequestClose();
    assert.deepEqual(h.calls, [['complete', 'raw-code'], ['complete', 'manual-code'], 'close']);
  });
  test(`${platform} scanner permission failure retains manual entry`, () => {
    const h = scanner(platform, false); assert.equal(find(h.tree, n => n.type === 'CameraView').length, 0);
    assert.match(text(h.tree), /Kamera ochilmadi/); assert.ok(find(h.tree, n => n.type === 'WorkerSheetButton' && n.props.label === 'OK').length);
  });
}

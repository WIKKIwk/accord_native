// Platform render tree checks; actual native behaviour and physical devices remain unverified.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function children(node) { return typeof node?.type === 'function' && node.type.name === 'RawSplitDetailLine' ? node.type(node.props) : node?.props?.children; }
function find(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => find(n, predicate));
  return [...(predicate(node) ? [node] : []), ...find(children(node), predicate)]; }
function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join('');
  return node && typeof node === 'object' ? text(children(node)) : ''; }
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
function history(platform, translate = value => value) {
  let effects = [], loads = 0, selectedResult, selectedIssue;
  const state = { snapshot: null, printer: null, wifiPrinter: 'godex', error: null, busy: false };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, reload: async () => { loads++; } };
  const react = { useLayoutEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': new Proxy({}, { get: (_, name) => name }),
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surface: 'surface', primary: 'primary', onSurface: 'text', onSurfaceVariant: 'muted' }) },
    '@expo/ui/swift-ui/modifiers': { lineLimit: value => ({ type: 'lineLimit', value }), disabled: value => ({ type: 'disabled', value }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'NativeText', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../preparation/PreparationUI': { PreparationList: 'PreparationList', usePreparationText: () => translate },
    '../preparation/PreparationUI.android': { usePreparationText: () => translate }, './rawSplitHistoryPresentation': presentation };
  const component = load(`RawSplitHistory.${platform}.tsx`, mocks, true).RawSplitHistory;
  const render = () => { effects = []; const tree = component({ controller, onResult: value => { selectedResult = value; },
    onIssue: (value, linked) => { selectedIssue = [value, linked]; } }); effects.forEach(effect => effect()); return tree; };
  return { state, render, loads: () => loads, result: () => selectedResult, issue: () => selectedIssue };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} history shows loading, then actual snapshot rows and opens correct details`, () => {
    const h = history(platform); h.state.busy = true; let tree = h.render(); assert.equal(h.loads(), 1);
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
  test(`${platform} history rows reuse native cut, warning and disclosure icons with V2 text limits`, () => {
    const h = history(platform); h.state.snapshot = { warehouses: [], history: [result], issues: [issue] }; const tree = h.render();
    const images = platform === 'ios' ? find(tree, n => n.type === 'Image').map(n => n.props.systemName)
      : find(tree, n => n.type === 'SymbolView').map(n => n.props.name.android);
    assert.deepEqual(images, platform === 'ios' ? ['scissors', 'chevron.right', 'exclamationmark.triangle', 'chevron.right']
      : ['content_cut', 'chevron_right', 'warning_amber', 'chevron_right']);
    const title = find(tree, n => n.type === (platform === 'ios' ? 'Text' : 'NativeText') && text(n) === '100 → 98 kg')[0];
    const subtitle = find(tree, n => n.type === (platform === 'ios' ? 'Text' : 'NativeText') && text(n) === 'Raw W • 1 rulon • 2 kg chiqindi')[0];
    if (platform === 'ios') { assert.deepEqual(title.props.modifiers, [{ type: 'lineLimit', value: 1 }]);
      assert.deepEqual(subtitle.props.modifiers, [{ type: 'lineLimit', value: 2 }]); }
    else { assert.equal(title.props.numberOfLines, 1); assert.equal(subtitle.props.numberOfLines, 2); }
  });
  test(`${platform} history preserves existing issues while showing a reload error`, () => {
    const h = history(platform); h.state.snapshot = { warehouses: [], history: [result], issues: [issue] }; h.state.error = 'offline';
    const tree = h.render(); assert.match(text(tree), /Tarix yuklanmadi/); assert.match(text(tree), /offline/);
    assert.ok(platform === 'ios' ? find(tree, n => n.type === 'Section' && n.props.title === 'Muammolar').length : text(tree).includes('Muammolar'));
    assert.doesNotMatch(text(tree), /100 → 98 kg/);
  });
}
// raw_material_split_history_screen.dart:194-253 and RawSplitHistoryMessage:634-688.
for (const platform of ['ios', 'android']) {
  const loadingType = platform === 'ios' ? 'ProgressView' : 'ActivityIndicator';
  const messageIcons = tree => platform === 'ios' ? find(tree, n => n.type === 'Image').map(n => n.props.systemName)
    : find(tree, n => n.type === 'SymbolView').map(n => n.props.name.android);
  test(`${platform} history distinguishes an idle empty state from the first pending snapshot`, () => {
    const h = history(platform); let tree = h.render();
    assert.match(text(tree), /Hali bo‘lish tarixi yo‘q\./); assert.equal(find(tree, n => n.type === loadingType).length, 0);
    assert.deepEqual(messageIcons(tree), [platform === 'ios' ? 'clock.arrow.circlepath' : 'history_toggle_off']);
    h.state.busy = true; tree = h.render();
    assert.equal(find(tree, n => n.type === loadingType).length, 1); assert.doesNotMatch(text(tree), /Hali bo‘lish tarixi/);
    h.state.snapshot = { warehouses: [], history: [result], issues: [] }; tree = h.render();
    assert.match(text(tree), /100 → 98 kg/); assert.equal(find(tree, n => n.type === loadingType).length, 0);
  });
  test(`${platform} history retains the source error title even for an empty error and trims only its subtitle`, () => {
    const h = history(platform); h.state.busy = true;
    for (const error of ['', '   ', '  offline\n  ']) {
      h.state.error = error; const tree = h.render();
      assert.match(text(tree), /Tarix yuklanmadi/); assert.equal(find(tree, n => n.type === loadingType).length, 0);
      assert.doesNotMatch(text(tree), /Hali bo‘lish tarixi/);
      assert.deepEqual(messageIcons(tree), [platform === 'ios' ? 'exclamationmark.circle' : 'error_outline']);
      const labels = find(tree, n => n.type === (platform === 'ios' ? 'Text' : 'NativeText')).map(text);
      assert.deepEqual(labels, error.trim() ? ['Tarix yuklanmadi', 'offline'] : ['Tarix yuklanmadi']);
    }
  });
  test(`${platform} history disables the error retry surface while busy and enables it again when idle`, () => {
    const h = history(platform); h.state.error = 'offline'; h.state.busy = true; let tree = h.render();
    const button = find(tree, n => n.type === (platform === 'ios' ? 'Button' : 'WorkerQueueCard'))[0];
    const before = h.loads();
    if (platform === 'ios') { assert.deepEqual(button.props.modifiers, [{ type: 'disabled', value: true }]); button.props.onPress(); }
    else assert.equal(button.props.onPress, undefined);
    assert.equal(h.loads(), before); h.state.busy = false; tree = h.render();
    const idle = find(tree, n => n.type === (platform === 'ios' ? 'Button' : 'WorkerQueueCard'))[0];
    if (platform === 'ios') assert.deepEqual(idle.props.modifiers, [{ type: 'disabled', value: false }]);
    idle.props.onPress(); assert.equal(h.loads(), before + 2); // One mock mount effect and one explicit retry.
  });
  test(`${platform} history shows the printer message only with content and preserves transport-specific text`, () => {
    const h = history(platform); h.state.printer = { transport: 'wifi' }; h.state.wifiPrinter = 'zebra';
    h.state.snapshot = { warehouses: [], history: [], issues: [] };
    assert.doesNotMatch(text(h.render()), /Printer:/);
    h.state.snapshot = { warehouses: [], history: [], issues: [issue] }; let tree = h.render();
    assert.match(text(tree), /Printer: wifiWi-Fi printer: zebra/);
    assert.equal(messageIcons(tree)[0], platform === 'ios' ? 'printer' : 'print');
    h.state.printer = { transport: 'bluetooth' }; tree = h.render();
    assert.match(text(tree), /Printer: bluetooth/); assert.doesNotMatch(text(tree), /Wi-Fi printer:/);
    h.state.error = 'offline'; tree = h.render(); assert.doesNotMatch(text(tree), /Printer:/);
    // An existing issue remains visible below the error, as it does in V2.
    assert.match(text(tree), /Film/);
  });
  test(`${platform} history message labels retain the V2 ordinary Text localization boundary`, () => {
    const h = history(platform, value => `translated(${value})`); h.state.error = '  offline  ';
    assert.equal(text(h.render()), 'Tarix yuklanmadioffline');
    h.state.error = null; h.state.snapshot = { warehouses: [], history: [], issues: [] };
    assert.equal(text(h.render()), 'Hali bo‘lish tarixi yo‘q.');
  });
}
const width = load('rawSplitWidthPlan.ts', { './rawSplitModel': model });
const draft = load('rawSplitDraft.ts', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
const homePresentation = load('rawSplitHomePresentation.ts', { './rawSplitModel': model, './rawSplitWidthPlan': width, './rawSplitDraft': draft });
function home(platform, translate = value => value) {
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
  const swift = new Proxy({ useNativeState: value => ({ get: () => value, set() {} }) }, { get: (o, name) => o[name] ?? name });
  const compose = new Proxy({ useNativeState: value => ({ get: () => value, set() {} }),
    OutlinedTextField: Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' }),
    useMaterialColors: () => ({ error: 'error', surface: 'surface', onSurfaceVariant: 'muted' }) }, { get: (o, name) => o[name] ?? name });
  const react = { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_, name) => (...args) => ({ modifier: name, args }) }),
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', Text: 'NativeText', View: 'View', PlatformColor: name => `native(${name})` },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../preparation/PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => translate },
    '../preparation/PreparationUI': { usePreparationText: () => translate },
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
// raw_material_split_screen.dart:318–349, 462–484, 513–532, 559–583, 619–620, 657–676.
for (const platform of ['ios', 'android']) {
  const buttonType = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
  const isDisabled = button => platform === 'ios' ? button.props.modifiers.some(m => m.modifier === 'disabled' && m.args[0] === true)
    : button.props.disabled;
  const nativeField = (tree, label, index = 0) => {
    const field = find(tree, n => typeof n.type === 'function' && n.type.name === 'Input' && n.props.label === label)[index];
    const rendered = field.type(field.props);
    return find(rendered, n => platform === 'ios' ? n.type === 'TextField' : String(n.type) === 'OutlinedTextField')[0];
  };
  test(`${platform} home note retains the source visible line range, length cap and lock conditions`, () => {
    const h = home(platform); h.state.showIssue = true; h.state.waste = '1'; h.state.issueNote = 'first\nsecond\nthird\nfourth';
    let field = nativeField(h.render(), 'Farq sababi');
    assert.equal(field.props.maxLength, 1000);
    assert.equal((platform === 'ios' ? field.props.text : field.props.value).get(), h.state.issueNote);
    if (platform === 'ios') {
      assert.equal(field.props.axis, 'vertical');
      assert.deepEqual(field.props.modifiers.find(m => m.modifier === 'lineLimit').args, [{ min: 2, max: 3 }]);
      assert.equal(field.props.modifiers.find(m => m.modifier === 'disabled').args[0], false);
      field.props.onTextChange('updated');
    } else {
      assert.equal(field.props.singleLine, false); assert.equal(field.props.minLines, 2); assert.equal(field.props.maxLines, 3);
      assert.equal(field.props.enabled, true); field.props.onValueChange('updated');
    }
    assert.deepEqual(h.calls, [['note', 'updated']]);
    for (const mode of ['saved', 'locked']) {
      h.state.issueSaved = mode === 'saved'; h.controller.locked = mode === 'locked'; field = nativeField(h.render(), 'Farq sababi');
      assert.equal(platform === 'ios' ? field.props.modifiers.find(m => m.modifier === 'disabled').args[0] : !field.props.enabled, true);
    }
  });
  test(`${platform} home marks only invalid width inputs and retains their native edit and Done actions`, () => {
    const h = home(platform); h.state.outputs[0].width = '100';
    let tree = h.render(), field = nativeField(tree, 'Eni (mm)');
    if (platform === 'ios') {
      assert.deepEqual(field.props.modifiers.find(m => m.modifier === 'strokeBorder').args,
        [{ content: 'native(systemRed)', shape: 'roundedRectangle', style: { lineWidth: 1 } }]);
      field.props.onTextChange('400'); field.props.modifiers.find(m => m.modifier === 'onSubmit').args[0]();
    } else {
      assert.equal(field.props.isError, true); field.props.onValueChange('400'); field.props.keyboardActions.onDone();
    }
    assert.deepEqual(h.calls, [['output', 0, 'width', '400'], 'confirmWidth']);
    for (const label of ['Og‘irlik (kg)', 'Babina (kg)', 'Metraj (m)', 'Atxot (kg) *']) {
      const measured = nativeField(tree, label);
      assert.equal(platform === 'ios' ? measured.props.modifiers.some(m => m.modifier === 'strokeBorder') : measured.props.isError, false);
    }
    h.state.outputs[0].width = '400'; field = nativeField(h.render(), 'Eni (mm)');
    assert.equal(platform === 'ios' ? field.props.modifiers.some(m => m.modifier === 'strokeBorder') : field.props.isError, false);
    h.state.outputs[0].width = '100'; h.controller.locked = true; field = nativeField(h.render(), 'Eni (mm)');
    if (platform === 'ios') {
      assert.equal(field.props.modifiers.some(m => m.modifier === 'strokeBorder'), false);
      assert.equal(field.props.modifiers.find(m => m.modifier === 'disabled').args[0], true);
    } else { assert.equal(field.props.enabled, false); assert.equal(field.props.isError, true); }
  });
  test(`${platform} home emphasizes every source error without translating ordinary error text`, () => {
    const h = home(platform, value => `translated(${value})`); h.state.error = 'lookup failure'; h.state.issueError = 'issue failure';
    h.state.pendingIssue = { request_id: 'pending' }; h.state.showIssue = true; h.state.waste = '1'; h.state.outputs[0].width = '100';
    const tree = h.render(), labels = find(tree, n => n.type === (platform === 'ios' ? 'Text' : 'NativeText'));
    const expected = ['lookup failure', 'issue failure', h.controller.wasteCheck.message,
      `translated(1-rulon: ${h.controller.widthPlan.errors[0]})`];
    for (const label of expected) {
      const matching = labels.filter(n => text(n) === label); assert.ok(matching.length, label);
      for (const node of matching) {
        if (platform === 'ios') assert.deepEqual(node.props.modifiers, [{ modifier: 'foregroundStyle', args: ['native(systemRed)'] }]);
        else assert.equal(node.props.style.color, 'error');
      }
    }
    assert.equal(labels.filter(n => text(n) === 'issue failure').length, 2); // Pending retry and inline form each show it in V2.
    assert.doesNotMatch(text(tree), /translated\((?:lookup failure|issue failure|1 kg hisobga olinmagan)/);
    assert.equal(h.calls.length, 0);
  });
  test(`${platform} home preserves source action and selected-printer icons without changing enable conditions`, () => {
    const h = home(platform); let tree = h.render();
    assert.equal(find(tree, n => n.type === (platform === 'ios' ? 'Image' : 'SymbolView') &&
      (platform === 'ios' ? n.props.systemName === 'printer' : n.props.name.android === 'print')).length, 0);
    h.state.printer = { transport: 'wifi' }; tree = h.render();
    const printer = find(tree, n => n.type === (platform === 'ios' ? 'Image' : 'SymbolView') &&
      (platform === 'ios' ? n.props.systemName === 'printer' : n.props.name.android === 'print'))[0];
    assert.equal(printer.props.size, 20); assert.match(text(tree), /Printer: wifi/);
    for (const [label, icon] of [['Skanerlash', platform === 'ios' ? 'qrcode.viewfinder' : 'qr_code_scanner'],
      ['Saqlash va chop etish', platform === 'ios' ? 'printer' : 'print']]) {
      let button = find(tree, n => n.type === buttonType && n.props.label === label)[0];
      assert.equal(platform === 'ios' ? button.props.systemImage : button.props.icon.android, icon); assert.equal(isDisabled(button), false);
      h.controller.locked = true; button = find(h.render(), n => n.type === buttonType && n.props.label === label)[0];
      assert.equal(isDisabled(button), true); h.controller.locked = false;
    }
    h.state.busy = true; tree = h.render();
    if (platform === 'ios') {
      const menu = find(tree, n => n.type === 'Menu')[0];
      for (const button of find(menu, n => n.type === 'Button')) assert.equal(isDisabled(button), true);
    } else assert.equal(find(tree, n => n.type === 'DropdownFilter')[0].props.enabled, false);
    h.state.printer = { transport: 'bluetooth' }; tree = h.render();
    assert.match(text(tree), /Printer: bluetooth/); assert.equal(find(tree, n => n.type === (platform === 'ios' ? 'Menu' : 'DropdownFilter')).length, 0);
    assert.equal(h.calls.length, 0);
  });
}
function details(platform, printerLabel = null, translate = value => value, issueValue = issue, reactOverride = null) {
  const calls = [], react = reactOverride ?? { useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect: fn => { fn(); } };
  const swift = new Proxy({}, { get: (_, name) => name });
  const compose = new Proxy({ useMaterialColors: () => ({ onSurface: 'text', onSurfaceVariant: 'muted', surface: 'surface' }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_, name) => (...args) => ({ modifier: name, args }) }),
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: (_, name) => (...args) => ({ modifier: name, args }) }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', Text: 'NativeText', View: 'View' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../preparation/PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => translate },
    '../preparation/PreparationUI': { usePreparationText: () => translate },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' }, './rawSplitModel': model, './rawSplitHistoryPresentation': presentation };
  const views = load(`RawSplitDetails.${platform}.tsx`, mocks, true);
  const props = { result, printerLabel, showWifiSelector: printerLabel === 'wifi', wifiPrinter: 'zebra', onSelectPrinter: () => calls.push('picker'),
    onWifiChanged: value => calls.push(['wifi', value]), onReprint: async value => { calls.push(['one', value.barcode]); },
    onReprintAll: async () => { calls.push('all'); }, onError: error => { calls.push(['error', error]); } };
  return { calls, props, resultTree: () => views.RawSplitDetails(props), issueTree: (hasResult = true) => views.RawSplitIssueDetails({ issue: issueValue, hasResult }) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} detail sheets show measured data and call reprint handlers`, async () => {
    const h = details(platform), tree = h.resultTree();
    assert.match(text(tree), /100 → 98 kg/); assert.match(text(tree), /Manba QRparent/);
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
const detailRows = tree => find(tree, n => typeof n.type === 'function' && n.type.name === 'RawSplitDetailLine');
for (const platform of ['ios', 'android']) {
  test(`${platform} result details keep separate source labels and unmodified values in source order`, () => {
    const h = details(platform); h.props.result = new model.RawSplitResult({ id: 'result', source: { ...source, warehouse: ' Raw W ' },
      source_kg: '100', output_kg: '98', waste_kg: '2', created_at: 'raw timestamp', issue_id: 'issue', issue_note: '  note\nline  ', outputs: [{ ...output, warehouse: ' Raw W ' }] });
    const rows = detailRows(h.resultTree());
    assert.deepEqual(rows.map(n => [n.props.label, n.props.value]), [['Manba QR', 'parent'], ['Ombor', ' Raw W '], ['Vaqti', 'raw timestamp'],
      ['Farq', 'Muammo izoh bilan qayd etilgan'], ['Sabab', '  note\nline  ']]);
    for (const node of rows) assert.ok(!node.props.label.endsWith(':'), node.props.label);
  });
  test(`${platform} detail metadata uses native wrapping columns rather than a flattened sentence`, () => {
    const row = detailRows(details(platform).resultTree())[0], rendered = row.type(row.props);
    const labels = find(rendered, n => n.type === 'Text'); assert.equal(labels.length, 2);
    assert.deepEqual(labels.map(text), ['Manba QR', 'parent']);
    if (platform === 'ios') {
      assert.equal(rendered.type, 'HStack'); assert.equal(rendered.props.alignment, 'top');
      assert.ok(labels[0].props.modifiers.some(m => m.modifier === 'frame' && m.args[0].width === 104 && m.args[0].alignment === 'leading'));
      assert.ok(labels[1].props.modifiers.some(m => m.modifier === 'font' && m.args[0].weight === 'semibold'));
      assert.ok(labels.every(n => !n.props.modifiers.some(m => m.modifier === 'lineLimit')));
    } else {
      assert.equal(rendered.type, 'Host'); assert.deepEqual(rendered.props.matchContents, { vertical: true });
      assert.equal(rendered.props.children.type, 'Row'); assert.equal(rendered.props.children.props.verticalAlignment, 'top');
      assert.deepEqual(labels[0].props.modifiers, [{ modifier: 'width', args: [104] }]);
      assert.deepEqual(labels[1].props.modifiers, [{ modifier: 'weight', args: [1] }]);
      assert.equal(labels[0].props.color, 'muted'); assert.equal(labels[1].props.color, 'text');
      assert.equal(labels[1].props.style.fontWeight, '600'); assert.ok(labels.every(n => n.props.maxLines === undefined));
    }
  });
  test(`${platform} both sheets restore the source header icon and selected-printer status icon`, () => {
    const h = details(platform, 'wifi'), resultTree = h.resultTree(), issueTree = h.issueTree();
    const icons = tree => platform === 'ios' ? find(tree, n => n.type === 'Image').map(n => [n.props.systemName, n.props.size])
      : find(tree, n => n.type === 'SymbolView').map(n => [n.props.name.android, n.props.size]);
    assert.ok(icons(resultTree).some(([name, size]) => name === (platform === 'ios' ? 'scissors' : 'content_cut') && size === 24));
    assert.ok(icons(resultTree).some(([name, size]) => name === (platform === 'ios' ? 'printer' : 'print') && size === 20));
    assert.deepEqual(icons(issueTree), [[platform === 'ios' ? 'exclamationmark.triangle' : 'warning_amber', 24]]);
  });
  test(`${platform} metadata stays ordinary Text while V2 Urdu-aware summaries and issue footers are localized`, () => {
    const t = value => `localized(${value})`, h = details(platform, null, t), tree = h.resultTree();
    const rows = detailRows(tree); assert.deepEqual(rows.map(n => n.props.label), ['Manba QR', 'Ombor', 'Farq', 'Sabab']);
    assert.deepEqual(rows.map(n => text(n.type(n.props))), ['Manba QRparent', 'OmborRaw W', 'FarqMuammo izoh bilan qayd etilgan', 'Sababnote']);
    assert.match(text(tree), /localized\(98 kg · 1000 mm · 20 mkm · 1000 m\)/);
    const issueTree = h.issueTree(false);
    assert.deepEqual(detailRows(issueTree).map(n => n.props.label), ['QR', 'Asl', '1-rulon']);
    assert.match(text(issueTree), /localized\(Sabab: note\)/);
    assert.match(text(issueTree), /localized\(Muammo sababi qayd etilgan\.\)/);
    assert.match(text(h.issueTree(true)), /localized\(Muammo bo‘yicha rulonlar saqlangan\.\)/);
    assert.ok(!detailRows(issueTree).some(n => n.props.value.includes('localized(')));
  });
  test(`${platform} missing optional result measurements and metadata add no placeholder rows`, () => {
    const h = details(platform); h.props.result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2',
      outputs: [{ ...output, gross_kg: null, bobina_kg: null, length_m: null }] });
    const tree = h.resultTree(); assert.deepEqual(detailRows(tree).map(n => n.props.label), ['Manba QR', 'Ombor']);
    assert.doesNotMatch(text(tree), /Brutto:|Babina:|Metri:|Vaqti|Farq|Sabab/);
    assert.match(text(tree), /98 kg · 1000 mm · 20 mkm/);
  });
  test(`${platform} result outputs keep snapshot order and each barcode remains selectable`, () => {
    const h = details(platform); h.props.result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2',
      outputs: ['second', 'first'].map(barcode => ({ ...output, stock_id: barcode, barcode, kg: '49', gross_kg: '50', width_mm: '500' })) });
    const tree = h.resultTree(), codes = platform === 'ios' ? find(tree, n => n.type === 'Text' && n.props.modifiers?.some(m => m.modifier === 'textSelection' && m.args[0]))
      : find(tree, n => n.type === 'NativeText' && n.props.selectable === true);
    assert.deepEqual(codes.map(text), ['second', 'first']);
  });
}
for (const platform of ['ios', 'android']) test(`${platform} reprint errors return to the parent instead of becoming unhandled`, async () => {
  const h = details(platform), error = new Error('printer unavailable'); h.props.onReprint = async () => { throw error; };
  const tree = h.resultTree();
  if (platform === 'ios') find(tree, n => n.type === 'Button' && n.props.label === 'Shu rulonni qayta chop etish')[0].props.onPress();
  else find(tree, n => n.type === 'IconButton')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(h.calls, [['error', error]]);
});
function mountedHooks() {
  const slots = [], cleanups = [], pending = [], writes = []; let cursor = 0, mounted = true;
  const react = {
    useRef: value => { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { writes.push({ afterUnmount: !mounted, value: next }); slots[i] = next; }]; },
    useEffect: effect => { const i = cursor++; if (!(i in slots)) { slots[i] = true; pending.push(() => { cleanups[i] = effect(); }); } },
  };
  return { react, writes, render: fn => { cursor = 0; const tree = fn(); while (pending.length) pending.shift()(); return tree; },
    unmount: () => { mounted = false; cleanups.forEach(cleanup => cleanup?.()); } };
}
function reprintButtons(tree, platform) {
  const one = platform === 'ios' ? find(tree, n => n.type === 'Button' && n.props.label === 'Shu rulonni qayta chop etish')[0]
    : find(tree, n => n.type === 'IconButton')[0];
  const all = find(tree, n => n.type === (platform === 'ios' ? 'Button' : 'WorkerSheetButton') && n.props.label === 'Barchasini qayta chop etish')[0];
  return { one, all, clickOne: () => platform === 'ios' ? one.props.onPress() : one.props.onClick(), clickAll: () => all.props.onPress(),
    isDisabled: button => platform === 'ios' ? button.props.modifiers.some(m => m.modifier === 'disabled' && m.args[0] === true)
      : button.type === 'IconButton' ? button.props.enabled === false : button.props.disabled === true };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} reprint waits for a deferred job and suppresses rapid repeated taps`, async () => {
    const hooks = mountedHooks(), h = details(platform, null, value => value, issue, hooks.react); let resolve;
    h.props.onReprint = value => { h.calls.push(['started', value.barcode]); return new Promise(done => { resolve = done; }); };
    const first = reprintButtons(hooks.render(h.resultTree), platform); first.clickOne(); first.clickOne(); first.clickAll();
    assert.deepEqual(h.calls, [['started', 'child']]);
    const busy = reprintButtons(hooks.render(h.resultTree), platform); assert.equal(busy.isDisabled(busy.one), true); assert.equal(busy.isDisabled(busy.all), true);
    busy.clickAll(); assert.deepEqual(h.calls, [['started', 'child']]); resolve(); await new Promise(done => setImmediate(done));
    const idle = reprintButtons(hooks.render(h.resultTree), platform); assert.equal(idle.isDisabled(idle.one), false); assert.equal(idle.isDisabled(idle.all), false);
    idle.clickAll(); await new Promise(done => setImmediate(done)); assert.deepEqual(h.calls, [['started', 'child'], 'all']); hooks.unmount();
  });
  test(`${platform} reprint rejection reports while mounted and recovers the buttons`, async () => {
    const hooks = mountedHooks(), h = details(platform, null, value => value, issue, hooks.react), error = new Error('printer failed'); let reject;
    h.props.onReprint = () => new Promise((_resolve, fail) => { reject = fail; });
    reprintButtons(hooks.render(h.resultTree), platform).clickOne(); reject(error); await new Promise(done => setImmediate(done));
    assert.deepEqual(h.calls, [['error', error]]); const idle = reprintButtons(hooks.render(h.resultTree), platform);
    assert.equal(idle.isDisabled(idle.one), false); assert.equal(idle.isDisabled(idle.all), false); hooks.unmount();
  });
  test(`${platform} late reprint rejection after unmount cannot update the sheet or report to its old owner`, async () => {
    const hooks = mountedHooks(), h = details(platform, null, value => value, issue, hooks.react); let reject;
    h.props.onReprint = () => new Promise((_resolve, fail) => { reject = fail; });
    reprintButtons(hooks.render(h.resultTree), platform).clickOne(); hooks.unmount(); reject(new Error('late')); await new Promise(done => setImmediate(done));
    assert.deepEqual(h.calls, []); assert.equal(hooks.writes.some(write => write.afterUnmount), false);
  });
  test(`${platform} a closed sheet still lets the current history owner report a print failure`, async () => {
    const { RawSplitHistoryController } = load('rawSplitHistoryController.ts', { '../shared/camera/synchronousGuard': load('../shared/camera/synchronousGuard.ts'), './rawSplitApi': { rawSplitSessionIsCurrent: () => true } });
    let reject; const options = { ticket: {}, canMutate: () => true, scope: () => 'account', selectPrinter: async () => ({ transport: 'bluetooth', printer: {} }),
      printerSupported: () => true, onUnsupportedPrinter: () => {}, onMessage: () => {},
      printOne: () => new Promise((_resolve, fail) => { reject = fail; }) };
    const controller = new RawSplitHistoryController(options), hooks = mountedHooks(), h = details(platform, null, value => value, issue, hooks.react);
    h.props.onReprint = value => controller.reprint(result, value);
    reprintButtons(hooks.render(h.resultTree), platform).clickOne(); await new Promise(done => setImmediate(done));
    hooks.unmount(); reject(new Error('offline')); await new Promise(done => setImmediate(done));
    assert.equal(controller.getSnapshot().error, 'Ombordagi hisob o‘zgarmadi. Chop etish: offline');
    assert.deepEqual(h.calls, []); assert.equal(hooks.writes.some(write => write.afterUnmount), false); controller.dispose();
  });
}
function scanner(platform, granted, active = true, isCurrent = () => active) {
  const guardFile = path.resolve(__dirname, '../src/shared/camera/synchronousGuard.ts'), guardModule = new Module(guardFile, module);
  guardModule.filename = guardFile; guardModule.paths = module.paths;
  guardModule._compile(ts.transpileModule(fs.readFileSync(guardFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, guardFile);
  const calls = [], scan = { permission: { granted }, checking: false, canUseCamera: () => granted, failed: false, manual: 'manual-code', setManual: value => calls.push(['manual', value]),
    complete: value => calls.push(['complete', value]), cameraFailed: () => calls.push('camera-failed'), title: 'Homashyo QR',
    manualLabel: 'Barcode', unavailable: 'Kamera ochilmadi. Quyidagi maydonga QR yoki barcode kiriting.', guide: 'QR kodni shu to‘r ichiga olib keling' };
  const state = value => ({ current: value, get() { return this.current; }, set(next) { this.current = next; } });
  const swift = new Proxy({ useNativeState: state }, { get: (o, name) => o[name] ?? name });
  const compose = new Proxy({ useNativeState: state, useMaterialColors: () => ({ surface: 'surface', onSurface: 'text' }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: fn => fn() }, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: () => () => ({}) }), '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: () => () => ({}) }), '../shared/camera/CameraSurface': { CameraSurface: 'CameraSurface' }, '../shared/camera/synchronousGuard': guardModule.exports,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Text: 'NativeText', View: 'View', PlatformColor: x => x,
      StyleSheet: { create: value => value, absoluteFill: {} } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, './useRawSplitScanner': { useRawSplitScanner: () => scan } };
  // Compose slots are components, represented by names in this static render harness.
  mocks['@expo/ui/jetpack-compose'].OutlinedTextField = Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' });
  const component = load(`RawSplitScanner.${platform}.tsx`, mocks, true).RawSplitScanner;
  const root = component({ visible: true, active, isCurrent, onClose: () => calls.push('close'), onComplete: () => {} });
  return { calls, scan, tree: root.type(root.props) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} scanner forwards camera and manual codes and closes on back`, () => {
    const h = scanner(platform, true), camera = find(h.tree, n => n.type === 'CameraSurface')[0];
    assert.ok(camera); assert.deepEqual(camera.props.barcodeTypes, ['qr', 'datamatrix']);
    camera.props.onDetection({ raw: 'raw-code', data: 'display-code' });
    find(h.tree, n => n.type === 'WorkerSheetButton' && n.props.label === 'OK')[0].props.onPress();
    find(h.tree, n => n.type === 'Modal')[0].props.onRequestClose();
    assert.deepEqual(h.calls, [['complete', 'raw-code'], ['complete', 'manual-code'], 'close']);
  });
  test(`${platform} scanner permission failure retains manual entry`, () => {
    const h = scanner(platform, false); assert.equal(find(h.tree, n => n.type === 'CameraSurface').length, 0);
    assert.match(text(h.tree), /Kamera ochilmadi/); assert.ok(find(h.tree, n => n.type === 'WorkerSheetButton' && n.props.label === 'OK').length);
  });
}

const localeFile = path.resolve(__dirname, '../src/shared/localization/index.ts'), localeModule = new Module(localeFile, module);
localeModule.filename = localeFile; localeModule.paths = module.paths;
localeModule._compile(ts.transpileModule(fs.readFileSync(localeFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, localeFile);
const translateUrdu = value => localeModule.exports.uiText(value, 'ur');
for (const platform of ['ios', 'android']) test(`${platform} reuses actual Urdu translations where V2 uses UrduAwareText`, () => {
  const homeView = home(platform, translateUrdu), homeTree = homeView.render();
  const buttonType = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
  assert.ok(find(homeTree, n => n.type === buttonType && n.props.label === translateUrdu('Skanerlash')).length);
  assert.ok(find(homeTree, n => n.type === buttonType && n.props.label === translateUrdu('Saqlash va chop etish')).length);
  // V2 leaves ordinary numeric field labels as TextField labels, not UrduAwareText.
  assert.ok(find(homeTree, n => n.props?.label === 'Eni (mm)').length);
  const h = history(platform, translateUrdu); h.state.snapshot = { warehouses: [], history: [], issues: [issue] }; const historyTree = h.render();
  assert.ok(platform === 'ios' ? find(historyTree, n => n.type === 'Section' && n.props.title === translateUrdu('Muammolar')).length
    : text(historyTree).includes(translateUrdu('Muammolar')));
  const d = details(platform, null, translateUrdu); assert.ok(find(d.resultTree(), n => n.type === buttonType && n.props.label === translateUrdu('Printer tanlash')).length);
  assert.notEqual(translateUrdu('Skanerlash'), 'Skanerlash'); assert.notEqual(translateUrdu('Muammolar'), 'Muammolar');
});

for (const platform of ['ios', 'android']) test(`${platform} candidate passes active lifecycle control to the shared camera surface`, () => {
  const h = scanner(platform, true, false), camera = find(h.tree, n => n.type === 'CameraSurface')[0];
  assert.equal(camera.props.active, false); assert.equal(camera.props.torch, false);
  // V2 uses raw when present, even an empty raw string; role gate decides whether it is usable.
  camera.props.onDetection({ raw: '', data: 'display-value' }); assert.deepEqual(h.calls, [['complete', '']]);
});

for (const platform of ['ios', 'android']) test(`${platform} issue sheet retains V2 microsecond precision`, () => {
  const previous = process.env.TZ; process.env.TZ = 'UTC';
  try { const precise = { ...issue, createdAt: new Date('2026-09-08T12:34:56.123Z'), createdAtMicrosecond: 456 };
    assert.match(text(details(platform, null, value => value, precise).issueTree()), /2026-09-08 12:34:56\.123456/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

for (const platform of ['ios', 'android']) test(`${platform} role scanner rejects async owner guards without authorizing camera`, async () => {
  for (const guard of [() => Promise.resolve(true), () => Promise.reject(new Error('stale'))]) {
    const h = scanner(platform, true, true, guard), camera = find(h.tree, n => n.type === 'CameraSurface')[0];
    assert.equal(camera.props.isCurrent(), false); await new Promise(resolve => setImmediate(resolve));
  }
});

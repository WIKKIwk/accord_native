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

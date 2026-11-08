// JS/React lifecycle mocks only; native scrolling, geometry and device timing need phone verification.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => find(value, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)]; }
function load(name, mocks) { const filename = path.resolve(__dirname, `../src/homashyo/${name}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports; }
function hooks() {
  const slots = [], pending = []; let cursor = 0;
  const next = initial => { const n = cursor++; if (!(n in slots)) slots[n] = initial(); return [n, slots[n]]; };
  const react = { useRef: initial => next(() => ({ current: initial }))[1],
    useState: initial => { const [n, value] = next(() => initial); return [value, v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v; }]; },
    useSyncExternalStore: (_subscribe, get) => { cursor++; return get(); },
    useEffect: (effect, deps) => { const n = cursor++, old = slots[n]; if (!old || deps.some((v, i) => v !== old.deps[i]))
      pending.push(() => { old?.cleanup?.(); slots[n] = { deps, cleanup: effect() }; }); } };
  react.useLayoutEffect = react.useEffect;
  const native = initial => next(() => { let value = initial; return { writes: [], get: () => value, set(nextValue) { value = nextValue; this.writes.push(nextValue); } }; })[1];
  return { react, native, render: fn => { cursor = 0; const tree = fn(); while (pending.length) pending.shift()(); return tree; },
    unmount: () => slots.forEach(value => value?.cleanup?.()) };
}
function environment(platform) {
  const h = hooks(), state = { error: null, pending: null, pendingIssue: null, snapshot: { warehouses: ['Raw'] }, barcode: '',
    source: { itemName: 'Film', warehouse: 'Raw' }, outputs: [], waste: '1', issueNote: '', showIssue: false, issueError: null, issueSaved: false, busy: false, printer: null };
  const controller = { subscribe() {}, getSnapshot: () => state, reload: async () => {}, locked: false,
    widthPlan: { canAdd: false, errors: [] }, wasteCheck: { kind: 'missing', message: 'discrepancy', waste: null } };
  const swift = new Proxy({ useNativeState: h.native }, { get: (o, key) => o[key] ?? key });
  const compose = new Proxy({ useMaterialColors: () => ({ error: 'error', surface: 'surface', onSurfaceVariant: 'muted' }) }, { get: (o, key) => o[key] ?? key });
  const modifiers = new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) });
  const mocks = { 'react/jsx-runtime': jsx, react: h.react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': { ScrollView: 'ScrollView', Text: 'Text', View: 'View', PlatformColor: name => `native(${name})` }, 'expo-symbols': { SymbolView: 'Symbol' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' }, '../preparation/PreparationUI': { usePreparationText: () => s => s },
    '../preparation/PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => s => s },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'Dropdown' }, './rawSplitHomePresentation': new Proxy({}, { get: () => () => '' }) };
  const component = load(`RawSplitHome.${platform}.tsx`, mocks).RawSplitHome;
  return { state, render: issueRevision => h.render(() => component({ controller, issueRevision, onScan() {} })), unmount: h.unmount };
}
function frames() { let next = 0; const tasks = new Map(), oldFrame = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = fn => { const id = ++next; tasks.set(id, fn); return id; }; global.cancelAnimationFrame = id => tasks.delete(id);
  return { count: () => tasks.size, run: () => { const entries = [...tasks.values()]; tasks.clear(); entries.forEach(fn => fn()); },
    restore: () => { global.requestAnimationFrame = oldFrame; global.cancelAnimationFrame = oldCancel; } };
}
test('iOS issue scroll targets the form once per revision and cancels pending work on unmount', () => {
  const f = frames(); try {
    const h = environment('ios'); h.render(0); h.state.showIssue = true; let tree = h.render(1);
    const scroll = find(tree, n => n.type === 'ScrollView')[0], binding = scroll.props.modifiers.find(m => m.kind === 'scrollPosition');
    assert.equal(binding.args[1].anchor, 'top'); const target = binding.args[0];
    assert.ok(find(tree, n => n.props?.modifiers?.some(m => m.kind === 'id' && m.args[0] === 'raw-split-issue')).length);
    assert.ok(find(tree, n => n.props?.modifiers?.some(m => m.kind === 'scrollTargetLayout')).length);
    assert.deepEqual(target.writes, [null]); assert.equal(f.count(), 1); f.run(); assert.deepEqual(target.writes, [null, 'raw-split-issue']);
    h.render(1); assert.equal(f.count(), 0); tree = h.render(2); assert.equal(f.count(), 1); h.unmount(); assert.equal(f.count(), 0);
    f.run(); assert.deepEqual(target.writes, [null, 'raw-split-issue', null]);
  } finally { f.restore(); }
});
test('Android waits for form layout, scrolls to its measured position and ignores old or cancelled revisions', () => {
  const f = frames(); try {
    const h = environment('android'); h.render(0); h.state.showIssue = true; let tree = h.render(1), moves = [];
    tree.props.ref.current = { scrollTo: command => moves.push(command) };
    assert.equal(f.count(), 0); const issue = find(tree, n => typeof n.props?.onLayout === 'function')[0];
    issue.props.onLayout({ nativeEvent: { layout: { y: 345 } } }); tree = h.render(1); assert.equal(f.count(), 1);
    f.run(); assert.deepEqual(moves, [{ y: 345, animated: true }]); h.render(1); assert.equal(f.count(), 0);
    h.render(2); assert.equal(f.count(), 1); issue.props.onLayout({ nativeEvent: { layout: { y: 410 } } });
    h.render(2); assert.equal(f.count(), 1); f.run(); assert.deepEqual(moves[1], { y: 410, animated: true });
    h.render(3); assert.equal(f.count(), 1); h.unmount(); assert.equal(f.count(), 0); f.run(); assert.equal(moves.length, 2);
  } finally { f.restore(); }
});

test('Android never reuses a prior source form position before the new form is laid out', () => {
  const f = frames(); try {
    const h = environment('android'); h.state.showIssue = true; let tree = h.render(1), moves = [];
    tree.props.ref.current = { scrollTo: command => moves.push(command) };
    find(tree, n => typeof n.props?.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { y: 100 } } });
    h.render(1); f.run(); assert.equal(moves[0].y, 100);
    h.state.source = { itemName: 'New film', warehouse: 'Raw' }; tree = h.render(2);
    assert.equal(f.count(), 0); find(tree, n => typeof n.props?.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { y: 250 } } });
    h.render(2); f.run(); assert.equal(moves[1].y, 250); h.unmount();
  } finally { f.restore(); }
});

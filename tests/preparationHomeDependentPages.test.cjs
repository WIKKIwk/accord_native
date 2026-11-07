const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

function setup(platform, screen) {
  const home = { snapshot: null, warehouse: null, loading: true, error: null, locked: true, saving: false };
  let loads = 0, focus = () => {}, index = 0, effects = [], sheetContent, sheetOptions;
  const slots = [];
  home.controller = { loadForPage() { loads++; }, reload() {}, getSnapshot: () => home };
  const react = {
    useCallback: fn => fn,
    useRef(value) { const at = index++; return slots[at] ??= { current: value }; },
    useState(value) {
      const at = index++;
      if (!(at in slots)) slots[at] = typeof value === 'function' ? value() : value;
      return [slots[at], next => { slots[at] = typeof next === 'function' ? next(slots[at]) : next; }];
    },
    useEffect(effect, deps) {
      const at = index++, previous = slots[at];
      if (!previous || deps.some((dep, i) => dep !== previous[i])) effects.push(effect);
      slots[at] = deps;
    },
  };
  const dialogs = { input: async () => 'reason', confirm: async () => true };
  const sheet = { open(content, options) { sheetContent = content; sheetOptions = options; }, close() { sheetOptions?.onDismiss?.(); } };
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => dialogs }, { get: (obj, key) => obj[key] ?? key });
  const swift = new Proxy({}, { get: (_, key) => key });
  const context = { usePreparationContext: () => ({ home, session: {} }) };
  const mocks = {
    '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: () => () => ({}) }),
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    'expo-router': { router: {}, Stack: { Screen: 'Stack.Screen' }, useFocusEffect: callback => { focus = callback; } },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', PlatformColor: value => value, StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../nativeSheet': { useNativeSheet: () => sheet },
    './PreparationContext': context, './PreparationContext.android': context,
    './PreparationUI': ui, './PreparationUI.android': ui,
    './preparationLogic': { preparationReceiptMode: () => 'warehouse', preparationVisibleMaterials: () => [],
      preparationReverseHistory: (entries, id, result) => [...entries.map(entry => entry.id === id ? { ...entry, reversed: true } : entry), result] },
    './preparationCommandApi': { preparationReverseReceipt: async () => ({ id: 'reversal', name: 'Reversal' }) },
    './preparationHistoryModel': { preparationHistoryCard: doc => ({ title: doc.reversed ? `${doc.name} reversed` : doc.name, subtitle: '', value: '' }),
      preparationReceiptActionSubtitle: () => '', preparationReceiptReverseMessage: () => '' },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
  };
  const filename = path.resolve(__dirname, platform === 'ios'
    ? `../src/preparation/Preparation${screen}.ios.tsx` : '../src/preparation/PreparationStock.android.tsx');
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : id === 'react' ? react
    : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const component = mod.exports[`Preparation${screen}${platform === 'android' ? 'Screen' : ''}`];
  const render = () => {
    index = 0; effects = [];
    const tree = component();
    for (const effect of effects) effect();
    return tree;
  };
  return { home, render, focus: () => focus(), loads: () => loads, sheetContent: () => sheetContent };
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: history accepts a snapshot that arrives after the screen opens`, () => {
    const view = setup(platform, 'History');
    let page = view.render();
    assert.equal(view.loads(), 1);
    assert.equal(findAll(page, node => node.props?.children === 'Hali kirim yoki sarf yo‘q.').length, 0);
    view.home.loading = false;
    view.home.error = 'offline';
    page = view.render();
    assert.equal(findAll(page, node => node.props?.children === 'Hali kirim yoki sarf yo‘q.').length, 0);
    if (platform === 'ios') assert.equal(findAll(page, node => node.type === 'PreparationStatus')[0].props.error, 'offline');
    else assert.ok(findAll(page, node => node.type === 'PreparationButton' && node.props.label === 'Qayta urinish').length);
    view.home.error = null;
    view.home.snapshot = { history: [{ id: '1', name: 'First receipt' }] };
    page = view.render();
    assert.ok(findAll(page, node => node.props?.doc?.id === '1' || node.props?.title === 'First receipt').length);
    view.home.snapshot = { history: [{ id: '2', name: 'New receipt' }] };
    page = view.render();
    assert.ok(findAll(page, node => node.props?.doc?.id === '2' || node.props?.title === 'New receipt').length);
    assert.equal(view.loads(), 1);
  });

  test(`${platform}: warehouse waits for its data instead of reporting an empty warehouse`, () => {
    const view = setup(platform, 'Warehouse');
    let page = view.render();
    view.focus();
    assert.equal(view.loads(), 1);
    assert.equal(findAll(page, node => typeof node.props?.children === 'string' &&
      /biriktirilmagan|hali kirim yo‘q|ombor tanlang/i.test(node.props.children)).length, 0);
    view.home.loading = false;
    view.home.error = 'offline';
    page = view.render();
    if (platform === 'ios') assert.equal(findAll(page, node => node.type === 'PreparationStatus')[0].props.error, 'offline');
    else assert.ok(findAll(page, node => node.type === 'PreparationButton' && node.props.label === 'Qayta urinish').length);
  });

  test(`${platform}: receipt reversal remains visible until a newer snapshot arrives`, async () => {
    const view = setup(platform, 'History');
    view.home.loading = false;
    view.home.snapshot = { history: [{ id: '1', name: 'First receipt', kind: 'receipt', can_reverse: true }] };
    let page = view.render();
    const row = findAll(page, node => node.props?.doc?.id === '1' || node.props?.title === 'First receipt')[0];
    row.props.onLongPress();
    if (platform === 'ios') {
      view.sheetContent().props.reverse();
      page = view.render();
      findAll(page, node => node.props?.doc?.id === '1' && node.props.confirm)[0].props.confirm('reason');
    } else {
      findAll(view.sheetContent(), node => node.type === 'PreparationRow' && node.props.title === 'Kirimni bekor qilish')[0].props.onPress();
    }
    await new Promise(resolve => setImmediate(resolve));
    page = view.render();
    assert.ok(findAll(page, node => node.props?.doc?.reversed === true || node.props?.title === 'First receipt reversed').length);
    view.home.snapshot = { history: [{ id: '2', name: 'New receipt' }] };
    page = view.render();
    assert.ok(findAll(page, node => node.props?.doc?.id === '2' || node.props?.title === 'New receipt').length);
    assert.equal(findAll(page, node => node.props?.doc?.id === '1' || node.props?.title === 'First receipt reversed').length, 0);
  });
}

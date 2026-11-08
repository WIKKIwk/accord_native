const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(x => nodes(x, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
for (const platform of ['ios', 'android']) {
  test(`${platform}: picker renders shared rows and forwards search and selection`, () => {
    const calls = [], item = { code: 'I-1', name: 'Film', uom: 'kg', warehouse: 'WH' };
    const state = { query: '', items: [item], loading: false }, controller = { setQuery: q => calls.push(['query', q]), submit: () => calls.push('submit') };
    const shared = initial => ({ value: initial, get() { return this.value; }, set(value) { this.value = value; } });
    const elements = new Proxy({ useNativeState: shared, useMaterialColors: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
    const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
    const mocks = { 'react/jsx-runtime': jsx, react: { useEffect() {} }, '@expo/ui': elements, '@expo/ui/swift-ui': elements,
      '@expo/ui/jetpack-compose': elements, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
      'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ height: 800 }) },
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
      './useRezkaSplit': { useRezkaItemPicker: () => ({ controller, state }), useRezkaText: () => text => text } };
    // JSX uses the component's Label slot on Android.
    elements.OutlinedTextField = Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' });
    const filename = path.resolve(__dirname, `../src/rezka/RezkaItemPicker.${platform}.tsx`), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
    const page = mod.exports.RezkaItemPicker({ session: {}, scope: 'scope', select: value => calls.push(['select', value]) });
    assert.ok(JSON.stringify(page).includes('ERPNext item qidirish')); assert.ok(JSON.stringify(page).includes('Film'));
    const field = nodes(page, n => n.type === (platform === 'ios' ? 'TextField' : elements.OutlinedTextField))[0];
    (field.props.onTextChange ?? field.props.onValueChange)('film'); assert.deepEqual(calls.at(-1), ['query', 'film']);
    const result = nodes(page, n => n.type === (platform === 'ios' ? 'Button' : 'WorkerQueueCard') &&
      (platform === 'ios' ? JSON.stringify(n).includes('Film') : true))[0];
    (result.props.onPress ?? result.props.onClick)(); assert.deepEqual(calls.at(-1), ['select', item]);
  });
}

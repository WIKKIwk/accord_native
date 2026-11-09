const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/'); if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const projection = load('qolip/qolipProductPassivePresentation.ts');
function harness(platform) {
  const records = [], boundary = {}, state = { valid: true, checks: 0, expireOn: Infinity };
  const product = (qolip_code, set_id, overrides = {}) => ({ qolip_code, set_id, is_extension: false, is_in_use: false, size: 0, color: '', order_image_order_id: '', ...overrides });
  const container = { catalogId: 'id', code: 'I-1', name: 'Product', itemGroup: '', imageOrderId: 'unfetched-cover', children: [
    product('Q-A', 'set-a', { is_in_use: true, size: 42, color: '#E53935' }), product('Q-B', 'set-b', { size: 40 }),
    product('Q-C', 'ignored', { is_extension: true }),
  ] };
  const rows = [{ container, expanded: true, loading: false, errorMessage: null }], reworkCodes = new Set(['q-a']);
  const component = name => props => { records.push({ name, props }); return React.createElement('div', null, props.label ?? props.children); };
  const ui = Object.fromEntries(['Box', 'Circle', 'Column', 'Host', 'HStack', 'Image', 'ProgressView', 'RNHostView', 'Row', 'Text', 'VStack', 'ZStack']
    .map(name => [name, component(name)]));
  ui.useMaterialColors = () => ({ surface: 'surface', onSurfaceVariant: 'secondary', outlineVariant: 'outline', error: 'error' });
  const modifier = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityLabel', 'background', 'font', 'foregroundStyle', 'frame', 'lineLimit', 'padding',
    'clip', 'fillMaxSize', 'fillMaxWidth', 'paddingAll', 'semantics', 'size', 'weight'].map(name => [name, modifier(name)]));
  mods.shapes = { roundedRectangle: () => 'rounded' }; mods.Shapes = { RoundedCorner: () => 'rounded', Circle: 'circle' };
  const filename = path.join(root, `qolip/QolipProductPassiveContent.${platform}.tsx`), loaded = new Module(filename, module);
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'expo-symbols': { SymbolView: component('SymbolView') }, 'react-native': { ActivityIndicator: component('ActivityIndicator'), ScrollView: component('ScrollView'), PlatformColor: name => name },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) },
    '../shared/localization': { localizedMethod: (_key, _locale, values) => `color:${values.raw}`,
      extensionText: (method, key, _locale, values = {}) => `${method}.${key}${Object.keys(values).length ? `:${Object.values(values).join(',')}` : ''}` },
    './qolipProductPassivePresentation': projection,
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => `${key}${values ? `:${Object.values(values).join(',')}` : ''}` }) },
    './useQolipPassiveBoundary': { useQolipPassiveBoundary: value => { assert.equal(value, boundary); return { valid: state.valid,
      isCurrent: () => { state.checks++; return state.valid && state.checks < state.expireOn; } }; } } };
  loaded.require = name => name in mocks ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const Content = loaded.exports.QolipProductPassiveContent;
  const render = () => { records.length = 0; state.checks = 0; return renderToStaticMarkup(React.createElement(Content, { boundary, rows, reworkCodes })); };
  return { rows, reworkCodes, records, state, container, render };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} passive product rows show source detail without image requests or action callbacks`, () => {
    const h = harness(platform), markup = h.render(); assert.match(markup, /Product/); assert.match(markup, /products\.count_in_use:3/);
    assert.match(markup, /qolipReworkText\.in_rework_count:1/); assert.match(markup, /qolipSharedSetText\.id: set-a/);
    assert.match(markup, /products\.alternative_set 1/); assert.match(markup, /products\.alternative_set 2/);
    assert.match(markup, /qolipSharedSetText\.extensions/); assert.match(markup, /Q-A/); assert.match(markup, /qolipReworkText\.open/);
    assert.match(markup, /Q-B/); assert.match(markup, /products\.size_value:40/); assert.match(markup, /Q-C/);
    assert.doesNotMatch(markup, /unfetched-cover|retry|copy|print|edit|add/);
    assert.equal(h.records.some(record => Object.keys(record.props).some(key => /^on(?:Press|Click|Tap|Long)/.test(key))), false);
    assert.equal(h.records.find(record => record.name === 'ScrollView').props.contentContainerStyle.paddingBottom, 132);
  });
  test(`${platform} passive product loading/error branches require real supplied flags and omit retry`, () => {
    const h = harness(platform); h.rows[0].loading = true; h.render();
    assert.equal(h.records.filter(record => record.name === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 2);
    h.rows[0].errorMessage = 'Source error'; const markup = h.render(); assert.match(markup, /Source error/); assert.doesNotMatch(markup, /Q-A|retry/);
    assert.equal(h.records.filter(record => record.name === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
  });
  test(`${platform} passive product content blanks before or during projection on witness invalidation`, () => {
    const h = harness(platform); h.state.valid = false; assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
    h.state.valid = true; h.state.expireOn = 2; assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
  });
}

test('passive boundary hook subscribes to the supplied original lifetime and remains closed across ABA', () => {
  let valid = true, signal, cleaned = false; const listeners = new Set(), effects = [], boundary = { current: () => valid,
    subscribe: callback => { signal = callback; return () => { cleaned = true; }; } };
  const real = load('qolip/qolipLocationChoiceLifetime.ts');
  const filename = path.join(root, 'qolip/useQolipPassiveBoundary.ts'), loaded = new Module(filename, module);
  const react = { useMemo: make => make(), useSyncExternalStore: (subscribe, get) => { subscribe(() => listeners.add('notified')); return get(); },
    useLayoutEffect: effect => { effects.push(effect); } };
  loaded.require = name => name === 'react' ? react : name === './qolipLocationChoiceLifetime' ? real : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const result = loaded.exports.useQolipPassiveBoundary(boundary), cleanup = effects[0](); assert.equal(result.valid, true); assert.equal(result.isCurrent(), true);
  valid = false; signal(); assert.equal(result.isCurrent(), false); assert.ok(listeners.has('notified')); valid = true; assert.equal(result.isCurrent(), false);
  cleanup(); assert.equal(cleaned, true);
});


test('passive boundary hook cannot adopt a replacement witness or revive the original after ABA', () => {
  const real = load('qolip/qolipLocationChoiceLifetime.ts'), filename = path.join(root, 'qolip/useQolipPassiveBoundary.ts'), loaded = new Module(filename, module);
  const slots = [], pending = []; let index = 0; const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { useMemo: (make, deps) => { const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) slots[slot] = { deps, value: make() }; return slots[slot].value; },
    useSyncExternalStore: (_subscribe, get) => { index++; return get(); }, useLayoutEffect: (effect, deps) => {
      const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) { slots[slot] = { deps }; pending.push(effect); }
    } };
  loaded.require = name => name === 'react' ? react : name === './qolipLocationChoiceLifetime' ? real : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const hook = loaded.exports.useQolipPassiveBoundary, a = { current: () => true, subscribe: () => () => {} }, b = { current: () => true, subscribe: () => () => {} };
  const render = boundary => { index = 0; const result = hook(boundary); while (pending.length) pending.shift()(); return result; };
  assert.equal(render(a).valid, true); assert.equal(render(b).valid, false); const returned = render(a);
  assert.equal(returned.valid, false); assert.equal(returned.isCurrent(), false);
});

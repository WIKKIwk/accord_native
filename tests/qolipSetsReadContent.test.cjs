const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(platform) {
  const records = [], calls = [], initials = [], member = (qolip_code, size, is_in_use) => ({ qolip_code, size, is_in_use, color: '' });
  const entry = { name: 'Named', display_name: 'Named', set: { id: 'S-1', members: [member('Q-1', 42, false), member('Q-2', 10, true)],
    product_labels: ['Product A (A)', 'Product B (B)'] } };
  const row = { entry, expanded: false }, actions = { setSearch: value => calls.push(['search', value]), tap: (...args) => calls.push(['tap', ...args]) };
  const snapshot = { invalid: false, loading: false, error: false, search: '', saving: false, rows: [row], actions };
  const component = name => props => { records.push({ name, props }); return React.createElement('div', null, props.label ?? props.children); };
  const ui = Object.fromEntries(['Button', 'Column', 'Host', 'HStack', 'IconButton', 'Image', 'OutlinedTextField', 'ProgressView',
    'RNHostView', 'Row', 'Text', 'TextField', 'VStack'].map(name => [name, component(name)]));
  for (const slot of ['Placeholder', 'LeadingIcon', 'TrailingIcon']) ui.OutlinedTextField[slot] = component(`OutlinedTextField.${slot}`);
  let value = ''; ui.useNativeState = initial => { initials.push(initial); value = initial; return { get: () => value, set: next => { value = next; } }; };
  ui.useMaterialColors = () => ({ onSurfaceVariant: 'secondary', surface: 'surface' });
  const modifier = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityIdentifier', 'accessibilityLabel', 'background', 'contentShape', 'disabled', 'font', 'frame',
    'labelStyle', 'lineLimit', 'onTapGesture', 'padding', 'clickable', 'clip', 'fillMaxWidth', 'paddingAll', 'semantics', 'testID', 'weight'].map(name => [name, modifier(name)]));
  mods.shapes = { rectangle: () => 'rect', roundedRectangle: () => 'rounded' }; mods.Shapes = { RoundedCorner: () => 'rounded' };
  const filename = path.resolve(__dirname, `../src/qolip/QolipSetsReadContent.${platform}.tsx`), loaded = new Module(filename, module);
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'expo-symbols': { SymbolView: component('SymbolView') }, 'react-native': { ActivityIndicator: component('ActivityIndicator'), ScrollView: component('ScrollView'),
      View: component('View'), PlatformColor: name => name }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) },
    '../shared/localization': { localizedGetter: key => key, extensionText: (_method, key, _locale, values) => `${key}${Object.keys(values).length ? `:${Object.values(values).join(',')}` : ''}` },
    './qolipApiCommon': { trimDart: value => value.trim() },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => `${key}${values ? `:${Object.values(values).join(',')}` : ''}` }) } };
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  const Content = loaded.exports.QolipSetsReadContent;
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(Content, { snapshot })); };
  const rowRecord = () => records.find(record => (record.name === 'HStack' || record.name === 'Row') &&
    record.props.modifiers?.some(mod => mod.name === (platform === 'ios' ? 'accessibilityIdentifier' : 'testID') && String(mod.args[0]).startsWith('qolip-set-row-')));
  return { snapshot, entry, row, actions, records, calls, initials, render, rowRecord };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} sets content shows source title/count and captures the rendered expansion without a write action`, () => {
    const h = harness(platform), markup = h.render(); assert.match(markup, /Named/); assert.match(markup, /S-1 · products\.mold_count:2/);
    assert.doesNotMatch(markup, /rename|copy_code|action\.delete|linked|retry|create/);
    const modifier = h.rowRecord().props.modifiers.find(value => value.name === (platform === 'ios' ? 'onTapGesture' : 'clickable'));
    h.row.expanded = true; modifier.args[0](); assert.deepEqual(h.calls, [['tap', h.entry, false]]);
    assert.equal(h.records.find(record => record.name === 'ScrollView').props.contentContainerStyle.paddingBottom, 132);
  });

  test(`${platform} expanded content shows linked labels and source member status without mutation controls`, () => {
    const h = harness(platform); h.row.expanded = true; const markup = h.render();
    assert.match(markup, /linked:2/); assert.match(markup, /Product A \(A\), Product B \(B\)/);
    assert.match(markup, /Q-1/); assert.match(markup, /products\.size_value:42/); assert.match(markup, /Q-2/);
    assert.match(markup, /products\.issued/); assert.doesNotMatch(markup, /action\.delete|copy_code|retry|create/);
    h.entry.name = ''; h.entry.display_name = 'S-1'; const fallback = h.render();
    assert.doesNotMatch(fallback, /S-1 · products\.mold_count/);
  });

  test(`${platform} saving prevents row activation; loading, error, empty and invalid states remain read-only`, () => {
    const h = harness(platform); h.snapshot.saving = true; h.render(); const mods = h.rowRecord().props.modifiers;
    if (platform === 'ios') assert.equal(mods.find(mod => mod.name === 'disabled').args[0], true);
    else assert.equal(mods.some(mod => mod.name === 'clickable'), false);
    h.snapshot.saving = false; h.snapshot.loading = true; h.render();
    assert.ok(h.records.some(record => record.name === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')));
    h.snapshot.loading = false; h.snapshot.error = true; let markup = h.render();
    assert.match(markup, /serverDisconnectedRetry/); assert.doesNotMatch(markup, /retry/);
    h.snapshot.error = false; h.snapshot.rows = []; assert.match(h.render(), /empty/);
    h.snapshot.invalid = true; assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
  });

  test(`${platform} search starts from its real query and clearing changes only search`, () => {
    const h = harness(platform); h.snapshot.search = ' Needle '; h.render(); assert.equal(h.initials[0], ' Needle ');
    const button = h.records.find(record => record.name === (platform === 'ios' ? 'Button' : 'IconButton'));
    (platform === 'ios' ? button.props.onPress : button.props.onClick)(); assert.deepEqual(h.calls, [['search', '']]);
  });
}

test('read-only sets owner forwards the actual session, original boundary, saving lock and snapshot', () => {
  const filename = path.resolve(__dirname, '../src/qolip/QolipSetsReadOnlyOwner.tsx'), loaded = new Module(filename, module), calls = [];
  const session = {}, boundary = {}, snapshot = {}, Content = () => null;
  loaded.require = name => name === './useQolipSetsRead' ? { useQolipSetsRead: (...args) => { calls.push(args); return snapshot; } }
    : name === './QolipSetsReadContent' ? { QolipSetsReadContent: Content } : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const result = loaded.exports.QolipSetsReadOnlyOwner({ session, boundary, saving: true });
  assert.deepEqual(calls, [[session, boundary, true]]); assert.equal(result.type, Content); assert.equal(result.props.snapshot, snapshot);
  assert.deepEqual(Object.keys(result.props), ['snapshot']);
});

test('sets hook updates the actual saving lock without recreating the owner', () => {
  const filename = path.resolve(__dirname, '../src/qolip/useQolipSetsRead.ts'), loaded = new Module(filename, module), calls = [], effects = [];
  const owner = { subscribe() {}, getSnapshot: () => ({ invalid: true }), activate: () => () => {}, updateSaving: value => calls.push(value) };
  let index = 0; const slots = [], same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { useMemo: (make, deps) => { const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) slots[slot] = { deps, value: make() }; return slots[slot].value; },
    useSyncExternalStore: (_subscribe, get) => { index++; return get(); }, useLayoutEffect: (effect, deps) => {
      const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) { slots[slot] = { deps }; effects.push(effect); }
    } };
  const made = []; loaded.require = name => name === 'react' ? react : name === './qolipSetsReadRuntime' ? { createQolipSetsRead: (...args) => { made.push(args); return owner; } } : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const hook = loaded.exports.useQolipSetsRead, session = {}, boundary = {};
  const render = saving => { index = 0; hook(session, boundary, saving); while (effects.length) effects.shift()(); };
  render(false); render(false); render(true); assert.deepEqual(made, [[session, boundary, false]]); assert.deepEqual(calls, [false, true]);
});

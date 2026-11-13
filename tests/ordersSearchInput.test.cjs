const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/shared/orders', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}

function headerHarness(initial = '') {
  const refs = [], effects = [], writes = [], changes = [];
  let cursor, text = initial;
  const native = { get: () => text, set: value => { text = value; writes.push(value); } };
  const { OrdersHeader } = load('OrdersHeader.tsx', {
    'react/jsx-runtime': jsx,
    react: {
      useRef: value => { const id = cursor++; return refs[id] ??= { current: value }; },
      useState: value => {
        const id = cursor++; const state = refs[id] ??= { value };
        return [state.value, next => { state.value = next; }];
      },
      useCallback: fn => fn,
      useEffect: fn => effects.push(fn),
    },
    '@expo/ui': { useNativeState: () => native },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value } },
    '../../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    './OrdersSearchInput': { OrdersSearchInput: 'OrdersSearchInput' },
    './SearchTextSync': load('SearchTextSync.ts'),
  });
  return {
    writes, changes, get text() { return text; },
    render(search) {
      cursor = 0;
      const tree = OrdersHeader({ search, onSearchChange: value => changes.push(value), onMenu() {}, onProfile() {}, actions: jsx.jsx('CutActions', {}) });
      while (effects.length) effects.shift()();
      return tree;
    },
    type(tree, value) { text = value; nodes(tree, 'OrdersSearchInput')[0].props.onChangeText(value); },
  };
}

test('delayed React acknowledgements never overwrite newer native product names, spaces or numbers', () => {
  for (const edits of [['M', 'Mi', 'Mitti', 'Mitti ', 'Mitti brownie'], ['0', '03', '030', '0304'], ['a', 'ab', 'a']]) {
    const x = headerHarness(), tree = x.render('');
    for (const value of edits) x.type(tree, value);
    for (const value of edits) {
      x.render(value);
      assert.equal(x.text, edits.at(-1));
    }
    assert.deepEqual(x.changes, edits);
    assert.deepEqual(x.writes, []);
  }
});

test('batched native edits, deletion and unchanged parent renders preserve the latest text', () => {
  const x = headerHarness(), tree = x.render('');
  x.type(tree, 'keks'); x.type(tree, 'kek'); x.type(tree, 'keks');
  x.render(''); x.render('keks'); x.render('keks');
  assert.equal(x.text, 'keks'); assert.deepEqual(x.writes, []);
});

test('clear writes the native value once and external search replacement still works', () => {
  const x = headerHarness(), tree = x.render('');
  x.type(tree, '0304');
  const searched = x.render('0304');
  nodes(searched, 'Pressable')[0].props.onPress();
  x.render('');
  assert.equal(x.text, ''); assert.deepEqual(x.writes, ['']);
  assert.deepEqual(x.changes, ['0304', '']);
  x.render('Mitti brownie');
  assert.equal(x.text, 'Mitti brownie'); assert.deepEqual(x.writes, ['', 'Mitti brownie']);
});

test('Android narrow search uses one native editable line and a separately bounded placeholder', () => {
  const field = { DecorationBox: 'DecorationBox', Placeholder: 'Placeholder', InnerTextField: 'InnerTextField' };
  // Component functions carry their native decoration slots.
  function Basic() {}
  Object.assign(Basic, field);
  const modifiers = Object.fromEntries(['fillMaxSize', 'fillMaxWidth', 'height'].map(name => [name, value => ({ name, value })]));
  const { OrdersSearchInput } = load('OrdersSearchInput.android.tsx', {
    'react/jsx-runtime': jsx,
    react: { useRef: value => ({ current: value }), useImperativeHandle() {} },
    '@expo/ui/jetpack-compose': { BasicTextField: Basic, Box: 'Box', Host: 'Host', Text: 'Text' },
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': { StyleSheet: { create: value => value } },
  });
  const changes = [], value = { get: () => 'Mitti brownie' };
  const tree = OrdersSearchInput({ value, onChangeText: text => changes.push(text), placeholder: 'Buyurtmani izlash' });
  const input = nodes(tree, Basic)[0];
  assert.equal(input.props.value, value); assert.equal(input.props.singleLine, true);
  input.props.onValueChange('0304'); assert.deepEqual(changes, ['0304']);
  const placeholder = nodes(tree, 'Text')[0];
  assert.equal(placeholder.props.maxLines, 1); assert.equal(placeholder.props.softWrap, false);
  assert.equal(placeholder.props.overflow, 'ellipsis');
  assert.equal(nodes(tree, 'InnerTextField').length, 1);
  assert.equal(tree.props.style.minWidth, 0);
});

test('focused rezka search reclaims menu and profile space while keeping paddon actions and close', () => {
  const x = headerHarness(), tree = x.render('');
  assert.equal(nodes(tree, 'RoleHeaderButton').length, 2);
  nodes(tree, 'OrdersSearchInput')[0].props.onFocus();
  const focused = x.render('');
  assert.equal(nodes(focused, 'RoleHeaderButton').length, 0);
  assert.equal(nodes(focused, 'CutActions').length, 1);
  assert.equal(nodes(focused, 'Pressable')[0].props.accessibilityLabel, 'Yopish');
  let blurred = false;
  const input = nodes(focused, 'OrdersSearchInput')[0];
  input.props.inputRef.current = { blur: () => { blurred = true; input.props.onBlur(); } };
  nodes(focused, 'Pressable')[0].props.onPress();
  assert.equal(blurred, true); assert.deepEqual(x.writes, []);
  assert.equal(nodes(x.render(''), 'RoleHeaderButton').length, 2);
});

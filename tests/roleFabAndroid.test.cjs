/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');

const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];

function setup() {
  const root = hooks(), item = hooks(), listeners = []; let active = root;
  const react = new Proxy({}, { get: (_target, key) => (...args) => active.react[key](...args) });
  const colors = { primaryContainer: 'primary', onPrimaryContainer: 'on-primary', secondaryContainer: 'secondary',
    onSecondaryContainer: 'on-secondary', surfaceContainerHighest: 'disabled-background', onSurfaceVariant: 'disabled-text' };
  const modifiers = new Proxy({}, { get: (_target, key) => (...args) => ({ name: key, args }) });
  const mocks = {
    react, 'react/jsx-runtime': jsx,
    '@expo/ui/jetpack-compose': { Button: 'Button', FloatingActionButton: Object.assign(() => {}, { Icon: 'FloatingActionButton.Icon' }),
      Host: 'Host', Icon: 'Icon', RNHostView: 'RNHostView', Row: 'Row', Shape: { Pill: () => 'pill' }, Text: 'Text', useMaterialColors: () => colors },
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 400 }),
      StyleSheet: { absoluteFill: {}, create: value => value }, BackHandler: { addEventListener: (_name, fn) => {
        listeners.push(fn); return { remove() { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } };
      } } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useAnimatedReaction: () => {},
      useAnimatedStyle: callback => callback(), useSharedValue: value => ({ value }), withSpring: value => value },
    '../../../assets/icons/fab-add.xml': 'fab-icon',
  };
  const file = path.resolve(__dirname, '../src/shared/navigation/RoleFab.android.tsx'), mod = new Module(file, module);
  mod.filename = file; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  return { listeners, render(props) { active = root; root.begin(); const tree = mod.exports.RoleFab(props); root.flush(); return tree; },
    renderItem(element) { active = item; item.begin(); const tree = element.type(element.props); item.flush(); return tree; },
    dispose() { root.dispose(); item.dispose(); } };
}

test('Android FAB prevents disabled actions and uses system disabled colors', () => {
  const h = setup(), calls = [], actions = [
    { id: 'scan', label: 'Scan', icon: 'qr_code_scanner', width: 200, disabled: true },
    { id: 'add', label: 'Add', icon: 'playlist_add', width: 160 },
  ];
  try {
    const tree = h.render({ actions, onSelect: id => calls.push(id) });
    const items = walk(tree).filter(node => typeof node.type === 'function' && node.type.name === 'MenuItem');
    const disabled = items.find(node => node.props.action.id === 'scan'), enabled = items.find(node => node.props.action.id === 'add');
    const button = walk(h.renderItem(disabled)).find(node => node.type === 'Button');
    assert.equal(button.props.enabled, false);
    assert.equal(button.props.colors.disabledContainerColor, 'disabled-background');
    assert.equal(button.props.colors.disabledContentColor, 'disabled-text');
    button.props.onClick(); disabled.props.onSelect('scan'); assert.deepEqual(calls, []);
    enabled.props.onSelect('add'); assert.deepEqual(calls, ['add']);
  } finally { h.dispose(); }
});

test('Android FAB consumes the hardware back action while its menu is open', () => {
  const h = setup(), actions = [{ id: 'scan', label: 'Scan', icon: 'qr_code_scanner', width: 200 }];
  try {
    const props = { actions, onSelect() {} }, first = h.render(props);
    const fab = walk(first).find(node => typeof node.type === 'function' && node.type.Icon === 'FloatingActionButton.Icon');
    fab.props.onClick(); h.render(props); assert.equal(h.listeners.length, 1);
    assert.equal(h.listeners[0](), true); h.render(props); assert.equal(h.listeners.length, 0);
  } finally { h.dispose(); }
});

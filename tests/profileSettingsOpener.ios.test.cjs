const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function fixture(role, registerSettingsOpener) {
  const hooks = []; let cursor = 0, focusEffect, focusCleanup, writes = [];
  const react = { useCallback: fn => fn, useState: initial => { const i = cursor++;
    if (!hooks[i]) hooks[i] = { value: initial };
    return [hooks[i].value, value => { hooks[i].value = value; writes.push([i, value]); }]; } };
  const ui = new Proxy({}, { get: (_target, name) => String(name) });
  const modifiers = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}), capsule: () => ({}) } },
    { get: (target, name) => target[name] ?? (() => ({})) });
  const filename = path.resolve(__dirname, '../src/components/ProfileView.ios.tsx'), loaded = new Module(filename, module);
  const mocks = { react, 'react/jsx-runtime': jsx, 'expo-router': { useFocusEffect: fn => { focusEffect = fn; } },
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { PlatformColor: value => value },
    '../profileModel': { profileDisplay: () => ({ name: 'Name', role: 'Role', phone: '', legalName: '', apparatusLabels: [] }) },
    '../shared/themeRuntime': { themeController: { setThemeMode: async () => {} } }, './BaseHost': { BaseHost: 'BaseHost' },
    './ProfileSettings.ios': { ProfileSettings: 'ProfileSettings' }, './useBaseLocale.ios': { useBaseLocale: () => ({ text: key => key }) },
    './useSwitchPinSetup.ios': { useSwitchPinSetup: () => ({ busy: false, close() {} }) } };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const props = { session: { profile: { role } }, snapshot: { profile: {} }, editing: false, busy: false, onRefresh: async () => {},
    onOpenEditor() {}, onCloseEditor() {}, onLogout() {}, registerSettingsOpener };
  const render = () => { cursor = 0; return loaded.exports.ProfileView(props); };
  return { render, focus: () => { focusCleanup = focusEffect(); }, blur: () => focusCleanup?.(), writes };
}
function settingsSheet(tree) { return nodes(tree, n => n.type === 'BottomSheet' && nodes(n, c => c.type === 'ProfileSettings').length)[0]; }
for (const role of ['aparatchi', 'tayyorlov_masteri']) test(`${role} keeps existing Profile settings without opt-in`, () => {
  const f = fixture(role), tree = f.render(); f.focus();
  const sheet = settingsSheet(tree); assert.equal(sheet.props.isPresented, false);
  sheet.props.anchor.props.onPress();
  assert.deepEqual(f.writes, [[0, true]]); assert.equal(settingsSheet(f.render()).props.isPresented, true);
  f.blur();
});
test('opt-in registers while focused, opens the existing Settings once, and invalidates a stale opener on blur', () => {
  let registered, removed = 0;
  const f = fixture('boyoqchi', open => { registered = open; return () => { removed++; }; });
  let tree = f.render(); f.focus(); assert.equal(typeof registered, 'function');
  assert.equal(settingsSheet(tree).props.isPresented, false);
  registered(); assert.deepEqual(f.writes, [[0, true]]);
  tree = f.render(); const sheet = settingsSheet(tree);
  assert.equal(sheet.props.isPresented, true); assert.equal(nodes(tree, n => n.type === 'ProfileSettings').length, 1);
  sheet.props.onIsPresentedChange(false); assert.deepEqual(f.writes, [[0, true], [0, false]]);
  f.blur(); assert.equal(removed, 1); registered(); assert.deepEqual(f.writes, [[0, true], [0, false]]);
  settingsSheet(f.render()).props.anchor.props.onPress(); assert.deepEqual(f.writes, [[0, true], [0, false], [0, true]]);
});

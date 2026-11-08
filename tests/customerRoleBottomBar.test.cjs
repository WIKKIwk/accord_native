const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const NavigationBarItem = Object.assign(() => null, { Icon: 'NavigationBarItem.Icon', Label: 'NavigationBarItem.Label' });
const BadgedBox = Object.assign(() => null, { Badge: 'BadgedBox.Badge' });
const palette = { onSecondaryContainer: 'selected', onSurface: 'surface', secondaryContainer: 'indicator',
  onSurfaceVariant: 'muted', surfaceContainerLow: 'background' };
const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': { Badge: 'Badge', BadgedBox, Host: 'Host', Icon: 'Icon',
  NavigationBar: 'NavigationBar', NavigationBarItem, RNHostView: 'RNHostView', Text: 'Text', useMaterialColors: () => palette },
  '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => 'fillMaxWidth', testID: id => `testID:${id}` },
  'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', StyleSheet: { create: value => value } } };
function load(source) {
  const filename = path.resolve(__dirname, '../src/shared/navigation/RoleBottomBar.android.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.xml') ? id : require(id);
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports.RoleBottomBar;
}
const newBar = load(fs.readFileSync(path.resolve(__dirname, '../src/shared/navigation/RoleBottomBar.android.tsx'), 'utf8'));
function renderedItem(Bar, item, active, select = () => {}) {
  const bar = Bar({ active, items: [item], onSelect: select, bottomInset: 9 });
  const nav = bar.props.children.props.children;
  const itemElement = nav.props.children[0];
  return { bar, nav, item: itemElement.type(itemElement.props) };
}
test('no badge keeps existing selected/unselected icons, labels, styles and interaction', () => {
  for (const [item, selectedSource, unselectedSource] of [
    [{ id: 'home', label: 'Asosiy', icon: 'home', testID: 'home' },
      '../../../assets/icons/navigation/filled/home_fill.xml', '../../../assets/icons/navigation/outlined/home.xml'],
    [{ id: 'chat', label: 'Chat', icon: 'chat_bubble' },
      '../../../assets/icons/navigation/filled/chat_bubble_fill.xml', '../../../assets/icons/navigation/outlined/chat_bubble.xml'],
  ]) {
    for (const selected of [true, false]) {
      const calls = [], rendered = renderedItem(newBar, item, selected ? item.id : 'other', id => calls.push(id));
      assert.deepEqual(rendered.bar.props.style, [{ width: '100%' }, { backgroundColor: 'background', paddingBottom: 9 }]);
      assert.deepEqual(rendered.nav.props.modifiers, ['fillMaxWidth']);
      assert.equal(rendered.item.props.selected, selected);
      assert.deepEqual(rendered.item.props.modifiers, item.testID ? [`testID:${item.testID}`] : undefined);
      const [iconSlot, labelSlot] = rendered.item.props.children;
      assert.equal(iconSlot.props.children.type, 'Icon');
      assert.equal(iconSlot.props.children.props.source, selected ? selectedSource : unselectedSource);
      assert.equal(iconSlot.props.children.props.tint, selected ? 'selected' : 'muted');
      assert.equal(labelSlot.props.children.props.children, item.label);
      rendered.item.props.onClick(); assert.deepEqual(calls, [item.id]);
    }
  }
  const fallback = renderedItem(newBar, { id: 'other', label: 'Boshqa', icon: 'notifications' }, 'other').item;
  assert.equal(fallback.props.children[0].props.children.type, 'RNHostView');
  assert.equal(fallback.props.children[0].props.children.props.children.type, 'SymbolView');
});

test('an opt-in badge wraps the same native icon with a dot and retains label and selection', () => {
  const item = { id: 'notifications', label: 'Bildirishnomalar', icon: 'notifications', showBadge: true, testID: 'customer-notifications' };
  const selected = renderedItem(newBar, item, 'notifications').item;
  assert.equal(selected.props.selected, true); assert.deepEqual(selected.props.modifiers, ['testID:customer-notifications']);
  const [iconSlot, labelSlot] = selected.props.children;
  assert.equal(iconSlot.type, 'NavigationBarItem.Icon'); assert.equal(iconSlot.props.children.type, BadgedBox);
  const [badgeSlot, icon] = iconSlot.props.children.props.children;
  assert.equal(badgeSlot.type, 'BadgedBox.Badge'); assert.equal(badgeSlot.props.children.type, 'Badge');
  assert.equal(icon.type, 'RNHostView'); assert.equal(labelSlot.props.children.props.children, 'Bildirishnomalar');
});

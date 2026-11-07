const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id]
    : id.endsWith('.xml') ? id : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}

test('worker FAB and navigation retain their destinations when using shared controls', () => {
  const calls = [];
  const { WorkerFab } = load('components/WorkerFab.android.tsx', {
    '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' },
  });
  const fab = WorkerFab({ onScan: () => calls.push('scan'), onSelect: id => calls.push(id), bottomOffset: 120 });
  assert.equal(fab.type, 'RoleFab');
  assert.deepEqual(fab.props.actions.map(action => action.id), ['scan', 'daily', 'paddons']);
  assert.equal(fab.props.testIDPrefix, 'worker-fab');
  assert.equal(fab.props.bottomOffset, 120);
  fab.props.onSelect('scan'); fab.props.onSelect('daily');
  assert.deepEqual(calls, ['scan', 'daily']);

  const { WorkerBottomBar } = load('components/WorkerBottomBar.android.tsx', {
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
  });
  const bar = WorkerBottomBar({ active: 'profile', onSelect: id => calls.push(id) });
  assert.equal(bar.type, 'RoleBottomBar');
  assert.equal(bar.props.active, 'profile');
  assert.deepEqual(bar.props.items.map(item => item.id), ['home', 'profile', 'chat']);
  bar.props.onSelect('chat');
  assert.equal(calls.at(-1), 'chat');
});

test('shared navigation fills only the selected Google icon and keeps all destinations clickable', () => {
  const calls = [], item = Object.assign(function NavigationItem() {}, { Icon: 'ItemIcon', Label: 'ItemLabel' });
  const { RoleBottomBar } = load('shared/navigation/RoleBottomBar.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'Host', Icon: 'Icon', NavigationBar: 'NavigationBar', NavigationBarItem: item,
      RNHostView: 'RNHostView', Text: 'Text', useMaterialColors: () => ({ onSecondaryContainer: 'selected', onSurfaceVariant: 'outline' }) },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}), testID: value => value },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', StyleSheet: { create: value => value } },
  });
  const items = [{ id: 'home', label: 'Tayyorlov', icon: 'home' }, { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
    { id: 'profile', label: 'Profil', icon: 'person' }];
  for (const active of ['home', 'chat', 'profile']) {
    const tree = RoleBottomBar({ active, items, onSelect: id => calls.push(id) });
    const buttons = nodes(tree, node => node.type?.name === 'NavItem').map(node => node.type(node.props));
    buttons.forEach((button, index) => {
      const selected = items[index].id === active, icon = nodes(button, node => node.type === 'Icon')[0];
      assert.equal(button.props.selected, selected);
      assert.match(icon.props.source, selected ? /\/filled\/.*_fill\.xml$/ : /\/outlined\/.*\.xml$/);
      assert.equal(icon.props.tint, selected ? 'selected' : 'outline');
      button.props.onClick();
    });
    assert.deepEqual(calls.slice(-3), ['home', 'chat', 'profile']);
  }
});

test('shared header button keeps the worker menu icon and callback', () => {
  const calls = [];
  const { RoleHeaderButton } = load('shared/navigation/RoleHeaderButton.tsx', {
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: styles => styles } },
  });
  const button = RoleHeaderButton({ icon: 'menu', label: 'Bo‘limlar', onPress: () => calls.push('menu'), tintColor: 'ink' });
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.children.props.name.android, 'menu');
  assert.equal(button.props.children.props.size, 25);
  button.props.onPress();
  assert.deepEqual(calls, ['menu']);
});

test('shared FAB opens, scrolls long menus, dispatches an action and closes on Android back', () => {
  const state = [], effects = [], calls = [];
  let cursor = 0, back;
  const react = {
    useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }]; },
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
  };
  const fab = Object.assign(function Fab() {}, { Icon: 'Fab.Icon' });
  const ui = { Button: 'Button', FloatingActionButton: fab, Host: 'Host', Icon: 'Icon', RNHostView: 'RNHostView', Row: 'Row',
    Shape: { Pill: () => 'pill' }, Text: 'Text', useMaterialColors: () => ({}) };
  const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) });
  const reanimated = { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: value => ({ value }),
    useAnimatedReaction() {}, useAnimatedStyle: fn => fn(), withSpring: value => value };
  const { RoleFab } = load('shared/navigation/RoleFab.android.tsx', {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, 'expo-symbols': { SymbolView: 'SymbolView' },
    react, 'react-native-reanimated': reanimated, '../../../assets/icons/fab-add.xml': 'asset',
    'react-native': { BackHandler: { addEventListener: (_name, handler) => { back = handler; return { remove() {} }; } },
      Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} },
      useWindowDimensions: () => ({ width: 360 }) },
  });
  const actions = Array.from({ length: 7 }, (_, index) => ({ id: `action-${index}`, label: `Action ${index}`, icon: 'home', width: 240 }));
  const render = resetKey => { cursor = 0; effects.length = 0; return RoleFab({ actions, onSelect: id => calls.push(id), bottomOffset: 96, resetKey }); };
  let tree = render();
  tree.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  tree = render();
  assert.equal(nodes(tree, node => node.type === 'ScrollView')[0].props.scrollEnabled, true);
  nodes(tree, node => node.type === fab)[0].props.onClick();
  tree = render();
  effects.forEach(effect => effect());
  assert.equal(nodes(tree, node => node.type === 'Pressable')[0].props.accessible, true);
  assert.equal(back(), true);
  tree = render();
  assert.equal(nodes(tree, node => node.type === 'Pressable')[0].props.accessible, false);
  nodes(tree, node => node.type === fab)[0].props.onClick();
  tree = render();
  const item = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'MenuItem')[0];
  const rendered = item.type(item.props);
  nodes(rendered, node => node.type === 'Button')[0].props.onClick();
  assert.deepEqual(calls, ['action-0']);
  assert.equal(nodes(render(), node => node.type === 'Pressable')[0].props.accessible, false);

  const previousFrame = global.requestAnimationFrame, previousCancel = global.cancelAnimationFrame;
  let scheduled;
  global.requestAnimationFrame = callback => { scheduled = callback; return 1; };
  global.cancelAnimationFrame = () => {};
  try {
    tree = render('home'); effects[0](); scheduled();
    tree = render('home'); nodes(tree, node => node.type === fab)[0].props.onClick();
    tree = render('warehouse');
    assert.equal(nodes(tree, node => node.type === 'Pressable')[0].props.accessible, true);
    effects[0](); scheduled();
    assert.equal(nodes(render('warehouse'), node => node.type === 'Pressable')[0].props.accessible, false);
  } finally { global.requestAnimationFrame = previousFrame; global.cancelAnimationFrame = previousCancel; }
});

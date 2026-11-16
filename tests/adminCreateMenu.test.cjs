const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const strict = load('shared/camera/synchronousGuard.ts');
const { AdminCreateMenuController } = load('admin/adminCreateMenuController.ts', { '../shared/camera/synchronousGuard': strict });
function fixture() {
  const calls = [], frames = [];
  let current = true;
  const actions = Array.from({ length: 5 }, (_, index) => ({ id: String(index), label: `Action ${index}`,
    icon: { ios: 'plus', android: 'add' }, enabled: index !== 2, onPress: () => { calls.push(index); } }));
  const controller = new AdminCreateMenuController(actions, () => current, () => new Promise(resolve => frames.push(resolve)));
  return { controller, actions, calls, frames, retire: () => { current = false; }, restore: () => { current = true; } };
}

test('create menu retains source order, closes before selection and invokes only after a frame', async () => {
  const f = fixture(); f.controller.toggle(); assert.equal(f.controller.getSnapshot().open, true);
  const pending = f.controller.select('3');
  assert.equal(f.controller.getSnapshot().open, false); assert.deepEqual(f.calls, []);
  assert.deepEqual(f.controller.getSnapshot().actions.map(a => a.id), ['0', '1', '2', '3', '4']);
  f.frames[0](); await pending; assert.deepEqual(f.calls, [3]);
});
test('disabled and unknown actions never close or schedule a callback', async () => {
  const f = fixture(); f.controller.toggle(); await f.controller.select('2'); await f.controller.select('missing');
  assert.equal(f.controller.getSnapshot().open, true); assert.deepEqual(f.frames, []); assert.deepEqual(f.calls, []);
});
test('duplicate native taps after dismissal dispatch a single selected action', async () => {
  const f = fixture(); f.controller.toggle();
  const first = f.controller.select('1'), second = f.controller.select('1');
  assert.equal(f.frames.length, 1); f.frames[0](); await Promise.all([first, second]);
  assert.deepEqual(f.calls, [1]);
});
test('account loss, unmount or action replacement between close and frame rejects the old action', async () => {
  for (const end of [f => f.retire(), f => f.controller.detach(), f => f.controller.configure([])]) {
    const f = fixture(); f.controller.toggle(); const pending = f.controller.select('0'); end(f);
    f.frames[0](); await pending; assert.deepEqual(f.calls, []);
  }
});
test('a synchronous close subscriber replacing the menu cannot dispatch its old action', async () => {
  const f = fixture(); f.controller.toggle();
  let once = false;
  f.controller.subscribe(() => { if (!once) { once = true; f.controller.configure([]); } });
  const pending = f.controller.select('1'); f.frames[0](); await pending; assert.deepEqual(f.calls, []);
});
test('a hidden primary action closes the menu and retires already scheduled native selections', async () => {
  const f = fixture(); f.controller.toggle(); const pending = f.controller.select('0');
  f.controller.setVisible(false); f.frames[0](); await pending;
  assert.deepEqual(f.calls, []); f.controller.toggle(); assert.equal(f.controller.getSnapshot().open, false);
  f.controller.setVisible(true); f.controller.toggle(); assert.equal(f.controller.getSnapshot().open, true);
});
test('StrictMode attachment may resume, while an observed expired witness never revives', () => {
  const f = fixture(); f.controller.detach(); f.controller.activate(); f.controller.toggle();
  assert.equal(f.controller.getSnapshot().open, true);
  f.retire(); f.controller.recheck(); assert.equal(f.controller.getSnapshot().open, false);
  f.restore(); f.controller.activate(); f.controller.toggle(); assert.equal(f.controller.getSnapshot().open, false);
});
test('async/nonboolean current callbacks fail closed without unhandled rejections', async () => {
  for (const value of [() => 'yes', () => Promise.reject(Error('not synchronous'))]) {
    const f = fixture(), controller = new AdminCreateMenuController(f.actions, value, async () => {});
    controller.toggle(); await controller.select('0');
    assert.equal(controller.getSnapshot().open, false); assert.deepEqual(f.calls, []);
  }
  await new Promise(resolve => setImmediate(resolve));
});

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const nodes = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(n => nodes(n, predicate))
  : [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
function render(platform, open = true) {
  const f = fixture(), calls = [], mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
  const compose = { Host: 'Host', Button: 'ComposeButton', RNHostView: 'RNHostView', Row: 'Row', Text: 'ComposeText',
    Shape: { Pill: () => 'pill', Circle: () => 'circle', RoundedCorner: value => value },
    useMaterialColors: () => ({ primaryContainer: 'primary', onPrimaryContainer: 'onPrimary', secondaryContainer: 'secondary', onSecondaryContainer: 'onSecondary' }) };
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: fn => fn() },
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': mods,
    '@expo/ui/swift-ui': { Host: 'Host', Menu: 'Menu', Button: 'SwiftButton' }, '@expo/ui/swift-ui/modifiers': mods,
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x, absoluteFill: {} },
      BackHandler: { addEventListener: (_event, fn) => { calls.push(fn); return { remove() {} }; } } },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, useSharedValue: value => ({ value }), useAnimatedStyle: fn => fn(), withSpring: value => value },
    '../components/useBaseTheme': { useBaseTheme: () => ({ mode: 'light' }) },
    './useAdminCreateMenu': { useAdminCreateMenu: () => ({ state: { open, actions: f.actions }, controller: {
      close: () => calls.push('close'), toggle: () => calls.push('toggle'), select: id => { calls.push(id); return Promise.resolve(); } } }) },
  };
  const { AdminCreateMenu } = load(`admin/AdminCreateMenu.${platform}.tsx`, mocks);
  const props = { actions: f.actions, isCurrent: () => true, openLabel: 'Yangi', closeLabel: 'Yopish' };
  return { tree: AdminCreateMenu(props), calls, props, AdminCreateMenu };
}
test('Android overlay actions use V2 56-point native pills, 14-point padding, 10-point icon gaps and full settled opacity', () => {
  const { tree, calls } = render('android');
  const actions = nodes(tree, n => typeof n.type === 'function' && n.type.name === 'Action');
  assert.equal(actions.length, 5); assert.deepEqual(actions.map(a => a.props.order), [4, 3, 2, 1, 0]);
  for (const entry of actions) {
    const row = entry.type(entry.props), button = nodes(row, n => n.type === 'ComposeButton')[0];
    assert.equal(row.props.style[1].opacity, 1);
    assert.deepEqual(button.props.contentPadding, { start: 14, end: 14, top: 0, bottom: 0 });
    assert.deepEqual(button.props.modifiers.find(m => m.name === 'height').args, [56]);
    assert.deepEqual(nodes(button, n => n.type === 'Row')[0].props.horizontalArrangement, { spacedBy: 10 });
  }
  const backdrop = nodes(tree, n => n.type === 'Pressable')[0]; backdrop.props.onPress(); assert.equal(calls.at(-1), 'close');
  const back = calls.find(call => typeof call === 'function'); assert.equal(back(), true); assert.equal(calls.at(-1), 'close');
});
test('iOS uses a real native menu with source-ordered actions and the disabled action retained', () => {
  const { tree, calls } = render('ios'), menu = nodes(tree, n => n.type === 'Menu')[0];
  assert.equal(menu.props.label, 'Yangi');
  const buttons = nodes(menu, n => n.type === 'SwiftButton');
  assert.deepEqual(buttons.map(b => b.props.label), ['Action 0', 'Action 1', 'Action 2', 'Action 3', 'Action 4']);
  assert.deepEqual(buttons[2].props.modifiers[0].args, [true]);
  buttons[1].props.onPress(); assert.deepEqual(calls, ['1']);
});

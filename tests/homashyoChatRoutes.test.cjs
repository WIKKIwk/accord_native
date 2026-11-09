const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(relative, mocks) {
  const filename = path.resolve(__dirname, `../src/${relative}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
test('installed Expo Router resolves all physical Homashyo Chat destinations on both platforms', () => {
  const appRoot = path.resolve(__dirname, '../src/app');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const keys = walk(appRoot).map(file => `./${path.relative(appRoot, file).split(path.sep).join('/')}`);
  const context = () => ({ default: () => null }); context.keys = () => keys;
  for (const platform of ['ios', 'android']) {
    const root = getRoutes(context, { platform, skipGenerated: true, ignoreEntryPoints: true, internal_stripLoadRoute: true });
    const actual = [];
    const visit = route => { actual.push(route.contextKey); (route.children ?? []).forEach(visit); }; visit(root);
    for (const prefix of ['ios-homashyo', 'android-homashyo']) {
      for (const page of ['_layout', 'index', 'new', '[conversationId]']) assert.ok(actual.includes(`./${prefix}/chat/${page}.tsx`));
    }
  }
});
test('Android dock appends Chat, shows the real unread dot and rejects navigation after session change', () => {
  const context = { ticket: {}, unread: 0 }, calls = []; let current = true;
  const { rawSplitNonChatDockItems } = load('homashyo/rawSplitNavigationModel.ts', {});
  const { RawSplitDock } = load('homashyo/RawSplitDock.android.tsx', {
    'expo-router': { router: { navigate: route => calls.push(route), dismissTo: route => calls.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 12 }) },
    '../preparation/PreparationUI.android': { usePreparationText: () => value => value },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'Bar' },
    './RawSplitContext': { useRawSplitContext: () => context }, './rawSplitApi': { rawSplitSessionIsCurrent: () => current },
    './rawSplitNavigationModel': { rawSplitNonChatDockItems },
  });
  let bar = RawSplitDock({}).props;
  assert.deepEqual(bar.items.map(item => item.id), ['home', 'profile', 'chat']);
  assert.equal(bar.items[2].showBadge, false); assert.equal(bar.active, 'home');
  context.unread = 2; bar = RawSplitDock({ chat: true }).props;
  assert.equal(bar.items[2].showBadge, true); assert.equal(bar.active, 'chat');
  bar.onSelect('chat'); bar.onSelect('home');
  assert.deepEqual(calls, ['/android-homashyo/chat', '/android-homashyo']);
  current = false; bar.onSelect('profile'); assert.equal(calls.length, 2);
});
test('iOS dock keeps V2 order and hides only inside Chat children until their closing transition', () => {
  const state = { unread: 0, chatClosing: false }; let pathname = '/ios-homashyo/chat';
  const Trigger = Object.assign(() => {}, { Icon: 'Icon', Label: 'Label', Badge: 'Badge' });
  const NativeTabs = Object.assign(() => {}, { Trigger });
  const Layout = load('app/ios-homashyo/_layout.tsx', {
    'expo-router': { usePathname: () => pathname }, 'expo-router/native-tabs': { NativeTabs },
    '../../homashyo/RawSplitContext': { useRawSplitContext: () => state },
    '../../homashyo/RawSplitDrawer': { RawSplitDrawer: 'Drawer' },
    '../../homashyo/RawSplitSessionGate': { RawSplitSessionGate: 'Gate' },
    '../../preparation/PreparationUI': { usePreparationText: () => value => value },
  }).default;
  const render = Layout().props.children.props.children.type;
  const badge = tree => tree.props.children.at(-1).props.children.find(child => child.type === 'Badge');
  let tabs = render(); assert.equal(tabs.props.hidden, false);
  assert.deepEqual(tabs.props.children.map(child => child.props.name), ['(home)', 'profile', 'chat']);
  assert.equal(badge(tabs).props.hidden, true);
  state.unread = 1; pathname += '/conversation'; tabs = render();
  assert.equal(tabs.props.hidden, true); assert.equal(badge(tabs).props.hidden, false);
  state.chatClosing = true; assert.equal(render().props.hidden, false);
});

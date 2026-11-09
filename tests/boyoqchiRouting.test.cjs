const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const routes = loaded.exports;
const session = { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'paint-1', role: 'boyoqchi' },
  capabilities: ['boyoqchi.access'], assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: 'scope' };

test('Boyoqchi entry follows V2 home and route capability eligibility', () => {
  assert.equal(routes.homeRoute(session), routes.appRoutes.boyoqchiHome);
  assert.equal(routes.homeTarget(session, 'ios'), '/ios-boyoqchi');
  assert.equal(routes.homeTarget(session, 'android'), '/android-boyoqchi');
  assert.equal(routes.homeTarget({ ...session, profile: { ...session.profile, role: 'aparatchi' } }, 'ios'), '/ios-boyoqchi');
  for (const role of ['rezka_master', 'brigader', 'sales_manager']) {
    const restricted = { ...session, profile: { ...session.profile, role } };
    assert.equal(routes.homeRoute(restricted), routes.appRoutes.boyoqchiHome);
    assert.equal(routes.canOpenRoute(restricted, routes.appRoutes.boyoqchiHome), false);
    assert.equal(routes.homeTarget(restricted, 'ios'), null);
  }
  assert.equal(routes.canOpenRoute(session, routes.appRoutes.boyoqchiHome), true);
  assert.equal(routes.canOpenRoute(session, routes.appRoutes.boyoqchiAstatka), true);
  assert.equal(routes.canOpenRoute({ ...session, capabilities: [] }, routes.appRoutes.boyoqchiAstatka), false);
});

test('role route trees expose Profile and all shared Chat destinations on both platforms', () => {
  for (const platform of ['ios', 'android']) {
    const root = path.resolve(__dirname, `../src/app/${platform}-boyoqchi`);
    const chat = platform === 'ios' ? '(tabs)/chat' : 'chat';
    assert.equal(fs.existsSync(path.join(root, '_layout.tsx')), true);
    for (const relative of [`${chat}/_layout.tsx`, `${chat}/index.tsx`, `${chat}/new.tsx`, `${chat}/[conversationId].tsx`]) {
      assert.equal(fs.existsSync(path.join(root, relative)), true, `${platform} ${relative}`);
    }
    assert.match(fs.readFileSync(path.join(root, chat, '_layout.tsx'), 'utf8'), /ChatRouteProvider/);
  }
});

test('role docks and drawer preserve V2 destination order with real unread dots', () => {
  const android = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiDock.android.tsx'), 'utf8');
  const ios = fs.readFileSync(path.resolve(__dirname, '../src/app/ios-boyoqchi/(tabs)/_layout.tsx'), 'utf8');
  const drawer = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiDrawer.tsx'), 'utf8');
  const context = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiContext.tsx'), 'utf8');
  assert.ok(android.indexOf("id: 'home'") < android.indexOf("id: 'astatka'"));
  assert.ok(android.indexOf("id: 'astatka'") < android.indexOf("id: 'profile'"));
  assert.ok(android.indexOf("id: 'profile'") < android.indexOf("id: 'chat'"));
  assert.ok(drawer.indexOf("id: 'astatka'") < drawer.indexOf("id: 'chat'"));
  assert.ok(drawer.indexOf("id: 'chat'") < drawer.indexOf("id: 'profile'"));
  assert.match(android, /showBadge: unread > 0/);
  assert.match(ios, /name="chat"/);
  assert.match(ios, /NativeTabs\.Trigger\.Badge hidden=\{unread <= 0\}/);
  assert.match(context, /useChatUnreadCount\(session\)/);
});

test('mounting the role provider uses the shared session unread runtime', () => {
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiContext.tsx');
  const loaded = new Module(filename, module), onLogout = () => {};
  let starts = 0;
  const mocks = {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => null, useRef: value => ({ current: value }),
      useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../shared/chat/useChatUnreadCount': { useChatUnreadCount: value => { assert.equal(value, session); starts++; return 7; } },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const provider = loaded.exports.BoyoqchiProvider({ session, onLogout, children: null });
  assert.equal(starts, 1);
  assert.equal(provider.props.value.session, session);
  assert.equal(provider.props.value.onLogout, onLogout);
  assert.equal(provider.props.value.unread, 7);
});

test('iOS hides its dock inside a conversation and derives the unread dot from the shared count', () => {
  const filename = path.resolve(__dirname, '../src/app/ios-boyoqchi/(tabs)/_layout.tsx');
  const loaded = new Module(filename, module);
  const Trigger = Object.assign(() => {}, { Icon: 'Icon', Label: 'Label', Badge: 'Badge' });
  const NativeTabs = Object.assign(() => {}, { Trigger });
  const state = { unread: 0, chatClosing: false };
  let pathname = '/ios-boyoqchi/chat';
  const mocks = {
    'expo-router': { usePathname: () => pathname }, 'expo-router/native-tabs': { NativeTabs },
    '../../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => state },
    '../../../boyoqchi/useBoyoqchiText': { useBoyoqchiGetter: () => key => key, useBoyoqchiText: () => key => key },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const render = loaded.exports.default;
  let tabs = render();
  assert.equal(tabs.props.hidden, false);
  assert.deepEqual(tabs.props.children.map(child => child.props.name), ['(home)', '(astatka)', 'profile', 'chat']);
  const badge = tree => tree.props.children.at(-1).props.children.find(child => child.type === 'Badge');
  assert.equal(badge(tabs).props.hidden, true);
  state.unread = 3; pathname = '/ios-boyoqchi/chat/conversation-1'; tabs = render();
  assert.equal(tabs.props.hidden, true); assert.equal(badge(tabs).props.hidden, false);
  assert.equal(badge(tabs).props.children, '', 'an unread dot has no invented count label');
  state.chatClosing = true; assert.equal(render().props.hidden, false);
});

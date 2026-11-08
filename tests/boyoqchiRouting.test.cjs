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

test('role route trees expose Profile while shared Chat routes stay held on both platforms', () => {
  for (const platform of ['ios', 'android']) {
    const root = path.resolve(__dirname, `../src/app/${platform}-boyoqchi`);
    const held = path.resolve(__dirname, `../src/held-routes/${platform}-boyoqchi`);
    const chat = platform === 'ios' ? '(tabs)/chat' : 'chat';
    assert.equal(fs.existsSync(path.join(root, '_layout.tsx')), true);
    for (const relative of [`${chat}/_layout.${platform}.tsx`, `${chat}/index.${platform}.tsx`, `${chat}/new.${platform}.tsx`, `${chat}/[conversationId].${platform}.tsx`]) {
      assert.equal(fs.existsSync(path.join(held, relative)), true, `${platform} ${relative}`);
    }
    assert.equal(fs.existsSync(path.join(root, chat)), false);
    assert.match(fs.readFileSync(path.join(held, chat, `_layout.${platform}.tsx`), 'utf8'), /ChatRouteProvider/);
  }
});

test('role docks and drawer omit Chat and its unread runtime while the transport is held', () => {
  const android = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiDock.android.tsx'), 'utf8');
  const ios = fs.readFileSync(path.resolve(__dirname, '../src/app/ios-boyoqchi/(tabs)/_layout.tsx'), 'utf8');
  const drawer = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiDrawer.tsx'), 'utf8');
  const context = fs.readFileSync(path.resolve(__dirname, '../src/boyoqchi/BoyoqchiContext.tsx'), 'utf8');
  assert.ok(android.indexOf("id: 'home'") < android.indexOf("id: 'astatka'"));
  assert.ok(android.indexOf("id: 'astatka'") < android.indexOf("id: 'profile'"));
  assert.doesNotMatch(android, /id: 'chat'|showBadge|useChatUnreadCount|chatUnreadRuntimeFor/);
  assert.doesNotMatch(ios, /name="chat"|NativeTabs\.Trigger\.Badge|useChatUnreadCount|chatUnreadRuntimeFor/);
  assert.doesNotMatch(drawer, /id: 'chat'/);
  assert.doesNotMatch(context, /useChatUnreadCount|chatUnreadRuntimeFor/);
});

test('mounting the role provider does not start the opt-in unread runtime or invent an unread count', () => {
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiContext.tsx');
  const loaded = new Module(filename, module), onLogout = () => {};
  let starts = 0;
  const mocks = {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => null, useRef: value => ({ current: value }),
      useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../shared/chat/useChatUnreadCount': { useChatUnreadCount: () => { starts++; return 7; } },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const provider = loaded.exports.BoyoqchiProvider({ session, onLogout, children: null });
  assert.equal(starts, 0);
  assert.equal(provider.props.value.session, session);
  assert.equal(provider.props.value.onLogout, onLogout);
  assert.equal(Object.hasOwn(provider.props.value, 'unread'), false);
});

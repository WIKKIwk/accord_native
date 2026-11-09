const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/supplier/supplierNavigationModel.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { supplierDrawerItems, supplierDockItems, supplierDockIntent } = mod.exports;
const l = key => `translated:${key}`;
const state = (overrides = {}) => ({ activeTab: 'home', centerActive: false, chatActive: false,
  primaryVisible: true, notificationUnread: false, chatUnreadCount: 0, ...overrides });

test('drawer follows V2 destination order and localized getters', () => {
  const items = supplierDrawerItems(l);
  assert.deepEqual(items.map(x => x.id), ['home', 'notifications', 'recent', 'profile']);
  assert.deepEqual(items.map(x => x.label), ['translated:homeNavTitle', 'translated:notificationsShortTitle',
    'translated:historyNavTitle', 'translated:profileTitle']);
});

test('dock badges, primary visibility and selection match V2', () => {
  const items = supplierDockItems(l, state({ notificationUnread: true, chatUnreadCount: 2 }));
  assert.deepEqual(items.map(x => x.id), ['home', 'notifications', 'create', 'recent', 'chat']);
  assert.deepEqual(items.filter(x => x.active).map(x => x.id), ['home']);
  assert.equal(items.find(x => x.id === 'notifications').showBadge, true);
  assert.equal(items.find(x => x.id === 'chat').showBadge, true);
  assert.equal(items.find(x => x.id === 'create').primary, true);
  const notices = supplierDockItems(l, state({ activeTab: 'notifications', notificationUnread: true }));
  assert.equal(notices.find(x => x.id === 'notifications').showBadge, false);
  const profile = supplierDockItems(l, state({ activeTab: null, primaryVisible: false }));
  assert.equal(profile.some(x => x.id === 'create'), false);
  assert.equal(profile.some(x => x.active), false);
  const chat = supplierDockItems(l, state({ chatActive: true, chatUnreadCount: 1 }));
  assert.deepEqual(chat.filter(x => x.active).map(x => x.id), ['chat']);
  assert.equal(chat.find(x => x.id === 'chat').showBadge, true);
  const unavailable = supplierDockItems(l, state({ chatUnreadCount: undefined }));
  assert.equal(unavailable.find(x => x.id === 'chat').showBadge, undefined, 'unavailable Chat state is not a fabricated count');
  const create = supplierDockItems(l, state({ activeTab: null, centerActive: true }));
  assert.deepEqual(create.filter(x => x.active).map(x => x.id), ['create']);
});

test('dock navigation is guarded for current destination, pushes create and navigates root destinations', () => {
  const home = state();
  assert.equal(supplierDockIntent('home', home), null);
  assert.deepEqual(supplierDockIntent('notifications', home), { kind: 'root', destination: 'notifications' });
  assert.deepEqual(supplierDockIntent('recent', home), { kind: 'root', destination: 'recent' });
  assert.deepEqual(supplierDockIntent('chat', home), { kind: 'root', destination: 'chat' });
  assert.deepEqual(supplierDockIntent('create', home), { kind: 'push', destination: 'create' });
  assert.equal(supplierDockIntent('create', state({ activeTab: null, centerActive: true })), null);
  assert.equal(supplierDockIntent('create', state({ primaryVisible: false })), null);
  assert.equal(supplierDockIntent('chat', state({ chatActive: true })), null);
  assert.deepEqual(supplierDockIntent('home', state({ activeTab: 'home', centerActive: true })), { kind: 'root', destination: 'home' });
  assert.deepEqual(supplierDockIntent('home', state({ activeTab: 'home', chatActive: true })), { kind: 'root', destination: 'home' });
});

test('real Expo StackRouter pops to an existing dock target and pushes an absent target', () => {
  // Exercise the SDK's actual stack reducer, not an imitation of its navigation rules.
  const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
  const { createInitialState } = require('../node_modules/expo-router/build/react-navigation/core/createInitialState.js');
  const { supplierRootStackAction } = mod.exports;
  const routeNames = ['home', 'notifications', 'recent', 'chat', 'create', 'profile', 'detail'];
  const router = StackRouter({ initialRouteName: 'home' }), options = { routeParamList: {}, routeGetIdList: {} };
  const initial = () => createInitialState({ routeNames, initialRouteName: 'home' });
  const reduce = (s, action) => {
    const result = router.getStateForAction(s, action, options);
    assert.ok(result && result.state, `Unhandled ${JSON.stringify(action)}`);
    return result.state;
  };
  const names = s => s.routes.slice(0, s.index + 1).map(x => x.name);
  let s = reduce(initial(), { type: 'PUSH', payload: { name: 'detail' } });
  s = reduce(s, supplierRootStackAction('notifications'));
  assert.deepEqual(names(s), ['home', 'detail', 'notifications'], 'absent target must push');
  s = reduce(s, supplierRootStackAction('home'));
  assert.deepEqual(names(s), ['home'], 'existing target must remove screens above it');
  s = reduce(s, { type: 'PUSH', payload: { name: 'notifications' } });
  s = reduce(s, { type: 'PUSH', payload: { name: 'home' } });
  s = reduce(s, { type: 'PUSH', payload: { name: 'detail' } });
  s = reduce(s, supplierRootStackAction('home'));
  assert.deepEqual(names(s), ['home', 'notifications', 'home'], 'last existing matching route wins');

  const before = reduce(initial(), { type: 'PUSH', payload: { name: 'detail' } });
  const dismissed = reduce(before, { type: 'POP_TO', payload: { name: 'notifications' } });
  assert.deepEqual(names(dismissed), ['home', 'notifications'], 'dismissTo replaces absent target and is not the V2 root operation');
});

test('real Expo StackRouter replaces only the current screen for drawer navigation', () => {
  const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
  const { createInitialState } = require('../node_modules/expo-router/build/react-navigation/core/createInitialState.js');
  const { supplierDrawerStackAction } = mod.exports;
  const routeNames = ['home', 'notifications', 'recent', 'profile'];
  const router = StackRouter({ initialRouteName: 'home' }), options = { routeParamList: {}, routeGetIdList: {} };
  const reduce = (s, action) => router.getStateForAction(s, action, options).state;
  let s = createInitialState({ routeNames, initialRouteName: 'home' });
  s = reduce(s, { type: 'PUSH', payload: { name: 'notifications' } });
  assert.equal(supplierDrawerStackAction('notifications', 'notifications'), null);
  s = reduce(s, supplierDrawerStackAction('notifications', 'profile'));
  assert.deepEqual(s.routes.slice(0, s.index + 1).map(x => x.name), ['home', 'profile']);
  s = reduce(s, supplierDrawerStackAction('profile', 'home'));
  assert.deepEqual(s.routes.slice(0, s.index + 1).map(x => x.name), ['home', 'home'],
    'drawer replacement must not pop to the older matching root');
});

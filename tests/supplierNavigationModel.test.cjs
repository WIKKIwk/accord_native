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

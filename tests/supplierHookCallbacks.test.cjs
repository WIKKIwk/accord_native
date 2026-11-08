const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Render-time hook stand-ins intentionally leave effects pending to cover the first-render window.
const react = { useEffect: () => {}, useMemo: create => create(), useState: create => [create(), () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
function load(file, overrides) {
  const filename = path.resolve(__dirname, '../src/supplier', `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
class ConfirmController {
  constructor(_session, _item, _qty, _services, callbacks) { this.callbacks = callbacks; }
  subscribe() { return () => {}; } getSnapshot() { return false; }
}
class NotificationsController {
  constructor(_session, _store, _hidden, _unread, onReceipt) { this.onReceipt = onReceipt; }
  subscribe() { return () => {}; } getSnapshot() { return 0; }
  get visibleItems() { return []; } get highlightedIds() { return new Set(); }
}

test('confirmation uses supplied callbacks immediately, before effects run', async () => {
  const failures = [], records = [], record = { id: 'receipt-1' };
  const { useSupplierConfirm } = load('useSupplierCreate', {
    react, 'react-native': { AppState: {} }, '../preparation/usePreparationNotice': { usePreparationNotice: () => ({ message: '', show: value => failures.push(value) }) },
    './supplierApi': {}, './supplierCreateController': { SupplierConfirmController: ConfirmController },
  });
  const { controller } = useSupplierConfirm({ session: {}, item: {}, qty: 1, store: {}, onSuccess: async value => records.push(value) });
  await controller.callbacks.onSuccess(record); controller.callbacks.onFailure('failure');
  assert.deepEqual(records, [record]); assert.deepEqual(failures, ['failure']);
});

test('notification navigation uses supplied callback immediately, before effects run', () => {
  const opened = [];
  const { useSupplierNotifications } = load('useSupplierNotifications', {
    react, 'react-native': { AppState: {} },
    '../shared/notificationStoresRuntime': { notificationHiddenStore: {}, notificationUnreadStore: {}, refreshHub: {} },
    './supplierNotificationsController': { SupplierNotificationsController: NotificationsController },
  });
  const store = { subscribe: () => () => {}, getSnapshot: () => 0 };
  const { controller } = useSupplierNotifications({ session: {}, store, onReceipt: id => opened.push(id) });
  controller.onReceipt('receipt-2'); assert.deepEqual(opened, ['receipt-2']);
});

function hookHarness() {
  let cursor = 0; const slots = []; let pending = [];
  const changed = (before, after) => !before || before.length !== after.length || after.some((value, i) => value !== before[i]);
  return {
    react: {
      useState: create => { const i = cursor++; if (!(i in slots)) slots[i] = create(); return [slots[i], () => {}]; },
      useMemo: (create, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: create(), deps }; return slots[i].value; },
      useEffect: (effect, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { slots[i] = { deps }; pending.push(effect); } },
      useSyncExternalStore: (_subscribe, getSnapshot) => { cursor++; return getSnapshot(); },
    },
    render: render => { cursor = 0; pending = []; return render(); },
    effects: () => pending,
  };
}

test('notification callback updates after rerender without recreating its controller', () => {
  const h = hookHarness(), opened = [], store = { subscribe: () => () => {}, getSnapshot: () => 0 }, session = {};
  const { useSupplierNotifications } = load('useSupplierNotifications', {
    react: h.react, 'react-native': { AppState: {} },
    '../shared/notificationStoresRuntime': { notificationHiddenStore: {}, notificationUnreadStore: {}, refreshHub: {} },
    './supplierNotificationsController': { SupplierNotificationsController: NotificationsController },
  });
  const first = h.render(() => useSupplierNotifications({ session, store, onReceipt: id => opened.push(`old:${id}`) }));
  const second = h.render(() => useSupplierNotifications({ session, store, onReceipt: id => opened.push(`new:${id}`) }));
  assert.equal(first.controller, second.controller); h.effects()[0]();
  second.controller.onReceipt('receipt'); assert.deepEqual(opened, ['new:receipt']);
});

test('confirmation callback updates after rerender without recreating its controller', async () => {
  const h = hookHarness(), records = [], store = {}, item = {}, session = {}, notice = { message: '', show: () => {} };
  const { useSupplierConfirm } = load('useSupplierCreate', {
    react: h.react, 'react-native': { AppState: {} }, '../preparation/usePreparationNotice': { usePreparationNotice: () => notice },
    './supplierApi': {}, './supplierCreateController': { SupplierConfirmController: ConfirmController },
  });
  const first = h.render(() => useSupplierConfirm({ session, item, qty: 1, store, onSuccess: async () => records.push('old') }));
  const second = h.render(() => useSupplierConfirm({ session, item, qty: 1, store, onSuccess: async () => records.push('new') }));
  assert.equal(first.controller, second.controller); h.effects()[0]();
  await second.controller.callbacks.onSuccess({ id: 'receipt' }); assert.deepEqual(records, ['new']);
});

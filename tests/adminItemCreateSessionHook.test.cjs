/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const s = require('./adminItemCreateSessionSupport.cjs');
const view = require('./adminSupplierDetailViewSupport.cjs');
test('session adapters pass original scope reads into actual list/tree/UOM and duplicate query5, independent of initialTabIndex', async () => {
  const f = s.fixture({ props: { initialTabIndex: 99, initialItemGroup: ' Seed ' } }); f.owner.controller.start(); await s.flush();
  assert.equal(f.owner.controller.getSnapshot().form.draft.group, 'All Item Groups'); assert.equal(f.owner.controller.getSnapshot().list.group, '');
  assert.deepEqual(f.calls.filter(call => ['items', 'uoms', 'tree'].includes(call[0])).map(call => call[0]).sort(), ['items', 'tree', 'uoms']);
  const first = f.calls.find(call => call[0] === 'items'); assert.equal(first[1], f.session); assert.deepEqual(first[2], { query: '', group: '', limit: 80, offset: 0 }); assert.equal(first[4](), false);
  f.owner.controller.openDialog(); const dialog = f.owner.controller.getSnapshot().form.dialog; f.owner.controller.form.changeField(dialog, 'code', ' lookup '); await f.owner.controller.save(dialog);
  assert.deepEqual(f.calls.filter(call => call[0] === 'items')[1][2], { query: 'lookup', limit: 5 });
});
test('session holds genuine missing capability-visible destinations without faking callbacks or filtering source actions', () => {
  for (const props of [{ onOpenItem: undefined }, { onCreateCustomer: undefined }, { returnOnCreate: true, onReturnCreated: undefined }]) assert.equal(s.fixture({ props }).owner.ready, false);
  const f = s.fixture(); f.session.profile.role = 'sales_manager'; f.session.capabilities = ['catalog.item.create']; const owner = f.factory.createAdminItemCreateSession({ ...f.props, onOpenItem: undefined, onCreateCustomer: undefined });
  assert.equal(owner.ready, true); assert.equal(owner.needsItemDetail, false); assert.equal(owner.needsCustomerCreate, false); assert.equal(owner.canSelect, false);
});
test('original epoch/token/witness/scope/route/strict parent authority is latched; restoring values never revives retired owner', () => {
  for (const [key, value] of [['epoch', 4], ['token', null], ['witness', false], ['scope', 'new'], ['route', false], ['parent', false], ['parent', Promise.resolve(true)]]) {
    const f = s.fixture(); assert.equal(f.owner.current(), true); const old = f.authority[key]; f.authority[key] = value; assert.equal(f.owner.current(), false, key); f.authority[key] = old; assert.equal(f.owner.current(), false, key);
  }
});
test('same-account token refresh preserves original owner, cross-witness replacement and test token do not', () => {
  const f = s.fixture(); f.authority.token = 'refreshed'; assert.equal(f.owner.current(), true); f.props.witness.session = {}; assert.equal(f.owner.current(), false);
  const testToken = s.fixture(); testToken.session.token = 'test-mode-token'; assert.equal(testToken.owner.current(), false);
});
test('parent throwing or synchronously reentering original owner fails closed', () => {
  const f = s.fixture(); let owner; owner = f.factory.createAdminItemCreateSession({ ...f.props, isCurrent: () => owner.current() }); assert.equal(owner.current(), false);
  const throwing = f.factory.createAdminItemCreateSession({ ...f.props, isCurrent: () => { throw Error('parent'); } }); assert.equal(throwing.current(), false);
});
function hook(overrides = {}) {
  const f = s.fixture(overrides), r = view.runtime(); let focused = true; const witnessListeners = new Set(), frames = new Map(); let serial = 0;
  const oldRequest = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; }; global.cancelAnimationFrame = id => frames.delete(id);
  const module = view.compile(path.resolve(__dirname, '../src/admin/useAdminItemCreate.ts'), { react: r.react,
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => r.react.useEffect(callback, [callback]) }, 'react-native': { Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, BackHandler: {} },
    '../auth': { subscribeSessionWitness: callback => { witnessListeners.add(callback); return () => witnessListeners.delete(callback); } },
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, '../shared/profileSessionGuard': s.profile,
    './AdminOwnedBackContext': { useAdminOwnedBack() {} }, './adminItemCreateSession': f.factory, './dartJsonString': s.strings });
  const result = { ...f, r, frames, render: () => r.render(() => module.useAdminItemCreate(f.props)), focus: value => { focused = value; }, notify: () => witnessListeners.forEach(callback => callback()),
    frame: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    cleanup: () => { r.unmount(); global.requestAnimationFrame = oldRequest; global.cancelAnimationFrame = oldCancel; } };
  return result;
}
test('actual hook waits postframe to open source initial dialog and retires saved native callbacks across StrictMode replay', async () => {
  const f = hook({ props: { openCreateDialog: true } }); try {
    const initial = f.render(); assert.equal(initial.state.form.dialog, null); assert.equal(initial.current(), false); await s.flush(); f.frame(); let model = f.render(); assert.ok(model.state.form.dialog);
    const old = model; f.r.replay(); await s.flush(); old.changeName('retired'); old.closeDialog(true); old.openDialog(); f.frame(); model = f.render(); assert.equal(model.state.form.draft.name, ''); assert.ok(model.state.form.dialog);
    model.changeName('fresh'); assert.equal(model.owner.controller.getSnapshot().form.draft.name, 'fresh');
  } finally { f.cleanup(); }
});
test('actual hook holds unavailable destination owner without initial requests or an automatic dialog', async () => {
  const f = hook({ props: { onOpenItem: undefined, openCreateDialog: true } }); try { f.render(); await s.flush(); f.frame(); const model = f.render(); assert.equal(model.owner.ready, false); assert.equal(f.calls.length, 0); assert.equal(model.state.form.dialog, null); } finally { f.cleanup(); }
});
test('focus guards native interactions while original reads and native sheet dismissal acknowledgement survive blur', async () => {
  const f = hook(); try {
    f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); model.openPicker('group'); await s.flush(); model = f.render(); model.selectPickerString('All Item Groups');
    const original = model; f.focus(false); model = f.render(); assert.equal(model.nativeCurrent(), false); original.changeName('blurred'); model.completePicker(); assert.equal(model.owner.controller.getSnapshot().picker, null); assert.equal(model.owner.controller.getSnapshot().form.draft.name, '');
    f.focus(true); model = f.render(); model.changeName('focused'); assert.equal(model.owner.controller.getSnapshot().form.draft.name, 'focused');
  } finally { f.cleanup(); }
});
test('account subscription scrubs pending form/list and all retained native callbacks immediately', async () => {
  const response = s.deferred(), f = hook({ catalog: { adminCatalogItemsPage: () => response.promise } }); try {
    f.render(); await s.flush(); const model = f.render(); model.openDialog(); f.authority.witness = false; f.notify(); model.search('private'); model.openDialog(); response.resolve([s.item('secret')]); await s.flush();
    const current = f.render(); assert.equal(current.state.form.valid, false); assert.equal(current.state.list.valid, false); assert.deepEqual(current.state.list.items, []); assert.equal(current.state.form.dialog, null);
  } finally { f.cleanup(); }
});
test('retained old row callback cannot select or open a replacement query row in the same owner', async () => {
  let rows = [s.item('A')], opened = 0; const f = hook({ catalog: { adminCatalogItemsPage: async () => rows }, props: { onOpenItem: async () => { opened++; } } }); try {
    f.render(); await s.flush(); const old = f.render(), row = old.state.list.items[0]; rows = [s.item('B')]; await old.owner.controller.list.reload(); old.toggleItem(row); old.openItem(row); await s.flush();
    assert.deepEqual(old.owner.controller.getSnapshot().list.selectedCodes, []); assert.equal(opened, 0);
  } finally { f.cleanup(); }
});
test('actual customer empty-action guard treats U+0085 as blank while header add permits the genuine empty initialName', async () => {
  const created = [], f = hook({ props: { onCreateCustomer: async query => { created.push(query); return null; } } }); try {
    f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); model.openPicker('customer'); await s.flush(); model = f.render(); model.pickerSearch('\u0085 \u0085');
    model.createCustomer(false); await s.flush(); assert.deepEqual(created, []); model.createCustomer(true); await s.flush(); assert.deepEqual(created, ['']);
  } finally { f.cleanup(); }
});
test('real header blur after detail navigation preserves original mounted authority and restores profile on return; retired-generation blur is inert', async () => {
  const navigation = s.deferred(), row = s.item('A'); let f; f = hook({ catalog: { adminCatalogItemsPage: async () => [row] }, props: { onOpenItem: async () => { f.focus(false); await navigation.promise; } } });
  try {
    f.render(); await s.flush(); let model = f.render(); model.searchFocus(true); model = f.render(); assert.equal(model.profileVisible, false);
    const original = model; model.openItem(row); f.render(); original.searchFocus(false); model = f.render(); assert.equal(model.profileVisible, true);
    navigation.resolve(); await s.flush(); f.focus(true); model = f.render(); assert.equal(model.profileVisible, true);
    f.r.replay(); await s.flush(); model = f.render(); model.searchFocus(true); model = f.render(); original.searchFocus(false); assert.equal(f.render().profileVisible, false);
  } finally { f.cleanup(); }
});

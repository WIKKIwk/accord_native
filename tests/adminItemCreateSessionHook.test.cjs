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
  const f = s.fixture(overrides), r = view.runtime(); let focused = true; const witnessListeners = new Set(), frames = new Map(), keyboard = []; let serial = 0;
  const oldRequest = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; }; global.cancelAnimationFrame = id => frames.delete(id);
  const module = view.compile(path.resolve(__dirname, '../src/admin/useAdminItemCreate.ts'), { react: r.react,
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => r.react.useEffect(callback, [callback]) }, 'react-native': { Platform: { OS: 'ios' }, Keyboard: { dismiss() { keyboard.push('dismiss'); } }, BackHandler: {} },
    '../auth': { subscribeSessionWitness: callback => { witnessListeners.add(callback); return () => witnessListeners.delete(callback); } },
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, '../shared/profileSessionGuard': s.profile,
    './AdminOwnedBackContext': { useAdminOwnedBack() {} }, './adminItemCreateSession': f.factory, './dartJsonString': s.strings });
  const overlayDomain = s.load('admin/AdminItemCreateOverlayController', { '../shared/camera/synchronousGuard': s.strict });
  const overlayModule = view.compile(path.resolve(__dirname, '../src/admin/useAdminItemCreateOverlays.ts'), { react: r.react, './AdminItemCreateOverlayController': overlayDomain });
  const result = { ...f, r, frames, keyboard, render: () => r.render(() => { const model = module.useAdminItemCreate(f.props); return overrides.overlays ? { ...model, overlay: overlayModule.useAdminItemCreateOverlays(model) } : model; }), focus: value => { focused = value; }, notify: () => witnessListeners.forEach(callback => callback()),
    frame: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    cleanup: () => { r.unmount(); global.requestAnimationFrame = oldRequest; global.cancelAnimationFrame = oldCancel; } };
  return result;
}
test('genuine OWN native dialog remains interactive through expected page blur without enabling covered page controls', async () => {
  let ownTop = true; const seen = [], f = hook({ props: { canInteractOwnedSurface: surface => { seen.push(surface); return ownTop; } } });
  try {
    f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); const originalDialog = model.state.form.dialog;
    f.focus(false); f.props.canInteract = () => false; model = f.render(); assert.equal(model.nativeCurrent(), false); assert.equal(model.dialogNativeCurrent(originalDialog), true);
    model.changeName('actual own dialog'); model.search('covered page search'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, 'actual own dialog'); assert.equal(model.owner.controller.list.getSnapshot().query, '');
    assert.ok(seen.some(surface => surface.kind === 'dialog' && surface.dialog === originalDialog));
    ownTop = false; model.changeName('covered dialog'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, 'actual own dialog'); ownTop = true; model.changeName('returned own dialog'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, 'returned own dialog');
  } finally { f.cleanup(); }
});
test('genuine OWN picker authority uses its exact original object while parent page is blurred and native ACK remains separate', async () => {
  let allowed = true; const seen = [], f = hook({ props: { canInteractOwnedSurface: surface => { seen.push(surface); return allowed; } } });
  try {
    f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); model.openPicker('group'); await s.flush(); f.focus(false); model = f.render(); const picker = model.state.picker;
    assert.equal(model.nativeCurrent(), false); assert.equal(model.pickerNativeCurrent(picker), true); assert.equal(model.dialogNativeCurrent(model.state.form.dialog), false);
    model.pickerSearch('own query'); assert.equal(picker.controller.getSnapshot().searchDraft, 'own query'); allowed = false; model.pickerSearch('covered'); assert.equal(picker.controller.getSnapshot().searchDraft, 'own query');
    allowed = true; model.dismissPicker(); assert.equal(picker.controller.getSnapshot().closing, true); assert.equal(model.owner.controller.getSnapshot().picker, picker); model.completePicker(); assert.equal(model.owner.controller.getSnapshot().picker, null);
    assert.ok(seen.some(surface => surface.kind === 'picker' && surface.picker === picker));
  } finally { f.cleanup(); }
});
test('old dialog version cannot adopt fresh native authority even with the same original native window id', async () => {
  const f = hook({ props: { canInteractOwnedSurface: () => true } });
  try { f.render(); await s.flush(); let old = f.render(); old.openDialog(); old = f.render(); old.owner.controller.form.refreshDialog(old.state.form.dialog.id); const fresh = f.render(); assert.equal(old.state.form.dialog.id, fresh.state.form.dialog.id); assert.notEqual(old.state.form.dialog, fresh.state.form.dialog); old.changeName('old snapshot'); assert.equal(fresh.owner.controller.form.getSnapshot().draft.name, ''); fresh.changeName('current snapshot'); assert.equal(fresh.owner.controller.form.getSnapshot().draft.name, 'current snapshot'); }
  finally { f.cleanup(); }
});
test('same-page OWN resolver replacement does not retarget retained native controls to a new host callback', async () => {
  let oldReads = 0, newReads = 0; const f = hook({ props: { canInteractOwnedSurface: () => { oldReads++; return true; } } });
  try { f.render(); await s.flush(); let old = f.render(); old.openDialog(); old = f.render(); f.props.canInteractOwnedSurface = () => { newReads++; return true; }; const fresh = f.render(); old.changeName('retargeted'); assert.equal(oldReads, 0); assert.equal(newReads, 0); fresh.changeName('new current host'); assert.equal(fresh.owner.controller.form.getSnapshot().draft.name, 'new current host'); assert.equal(newReads, 1); }
  finally { f.cleanup(); }
});
test('legacy and OWN mode replacement retires old native dialog callbacks in both directions', async () => {
  const f = hook();
  try {
    f.render(); await s.flush(); let legacy = f.render(); legacy.openDialog(); legacy = f.render();
    f.props.canInteractOwnedSurface = () => false; const held = f.render(); legacy.changeName('old legacy bypass'); held.changeName('own not top'); assert.equal(held.owner.controller.form.getSnapshot().draft.name, '');
    f.props.canInteractOwnedSurface = () => true; const owned = f.render(); owned.changeName('actual own'); assert.equal(owned.owner.controller.form.getSnapshot().draft.name, 'actual own');
    delete f.props.canInteractOwnedSurface; const freshLegacy = f.render(); owned.changeName('retired own'); assert.equal(freshLegacy.owner.controller.form.getSnapshot().draft.name, 'actual own'); freshLegacy.changeName('current legacy'); assert.equal(freshLegacy.owner.controller.form.getSnapshot().draft.name, 'current legacy');
  } finally { f.cleanup(); }
});
test('legacy native guard replacing OWN mode during dispatch cannot authorize an old dialog edit', async () => {
  let replace = false; const f = hook({ props: { canInteract: () => { if (replace) { replace = false; f.props.canInteractOwnedSurface = () => false; f.render(); } return true; } } });
  try { f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); replace = true; model.changeName('mode changed during guard'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, ''); }
  finally { f.cleanup(); }
});
test('OWN surface guard rejects async/throwing/reentrant callbacks without leaking rejected promises or sending a mutation', async () => {
  let model, mode = 'async'; const f = hook({ props: { canInteractOwnedSurface: () => { if (mode === 'async') return Promise.reject(Error('not synchronous')); if (mode === 'throw') throw Error('not ready'); if (mode === 'reenter') model.changeName('nested'); return true; } } });
  try { f.render(); await s.flush(); model = f.render(); model.openDialog(); model = f.render(); for (mode of ['async', 'throw', 'reenter']) { model.changeName(mode); assert.equal(model.owner.controller.form.getSnapshot().draft.name, ''); } await s.flush(); mode = 'valid'; model.changeName('genuine current'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, 'genuine current'); assert.equal(f.calls.some(call => call[0] === 'create'), false); }
  finally { f.cleanup(); }
});
test('OWN resolver reentrantly removing its actual dialog or unmounting its page cannot authorize a queued edit', async () => {
  for (const mode of ['dialog', 'unmount']) {
    let model; const f = hook({ props: { canInteractOwnedSurface: () => { if (mode === 'unmount') f.r.unmount(); else model.owner.controller.closeDialog(model.state.form.dialog, true); return true; } } });
    try { f.render(); await s.flush(); model = f.render(); model.openDialog(); model = f.render(); model.changeName('stale'); assert.equal(model.owner.controller.form.getSnapshot().draft.name, ''); assert.equal(f.calls.some(call => call[0] === 'create'), false); }
    finally { f.cleanup(); }
  }
});
test('original account retirement precedes OWN surface dispatch and cannot be revived by a positive native top receipt', async () => {
  let checks = 0; const f = hook({ props: { canInteractOwnedSurface: () => { checks++; return true; } } });
  try { f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); f.authority.witness = false; f.notify(); model.changeName('private'); assert.equal(checks, 0); assert.equal(model.owner.controller.form.getSnapshot().valid, false); f.authority.witness = true; model.changeName('revived'); assert.equal(checks, 0); }
  finally { f.cleanup(); }
});
test('accepted OWN native dialog Save can run through page blur, but created return still waits for genuine dialog completion', async () => {
  const returned = [], f = hook({ props: { returnOnCreate: true, onReturnCreated: item => returned.push(item), canInteractOwnedSurface: () => true } });
  try { f.render(); await s.flush(); let model = f.render(); model.openDialog(); f.focus(false); model = f.render(); model.changeCode('NEW'); model.changeName('Actual own dialog'); model.save(); await s.flush();
    const closing = model.owner.controller.getSnapshot().closingDialog; assert.ok(closing); assert.equal(f.calls.filter(call => call[0] === 'create').length, 1); assert.deepEqual(returned, []); model.completeDialog(closing.id); assert.equal(returned.length, 1); assert.equal(returned[0].code, 'created'); }
  finally { f.cleanup(); }
});
test('OWN move confirmation checks the actual prompt while covered page input stays blocked; acceptance still waits native ACK', async () => {
  let top = false; const seen = [], f = hook({ props: { canInteractOwnedSurface: surface => { seen.push(surface); return surface.kind === 'move' && top; } } });
  try { f.render(); await s.flush(); let model = f.render(); model.owner.controller.list.toggleItem(s.item('A')); model.owner.controller.list.changeGroup('G'); await s.flush(); model.owner.controller.list.requestMove(); f.focus(false); model = f.render(); assert.ok(model.state.list.prompt); assert.equal(model.nativeCurrent(), false);
    const Module = s.load('admin/AdminItemCreateOverlayController', { '../shared/camera/synchronousGuard': s.strict }); const overlays = new Module.AdminItemCreateOverlayController(model.owner, model.current, model.moveNativeCurrent); overlays.start(); const original = overlays.getSnapshot().move;
    overlays.chooseMove(original, false); assert.equal(overlays.getSnapshot().moveVisible, true); top = true; assert.equal(model.moveNativeCurrent(), true); overlays.chooseMove(original, false); assert.equal(overlays.getSnapshot().moveVisible, false); assert.equal(overlays.getSnapshot().move, original); assert.ok(seen.some(surface => surface.kind === 'move' && surface.prompt === original.prompt)); await overlays.completeMove(original); assert.equal(overlays.getSnapshot().move, null); assert.equal(f.calls.some(call => call[0] === 'move'), false); overlays.dispose(); }
  finally { f.cleanup(); }
});
test('accepted original move survives OWN resolver replacement and commits only after its original native completion', async () => {
  const f = hook({ overlays: true, props: { canInteractOwnedSurface: () => true } });
  try {
    f.render(); await s.flush(); let model = f.render(); model.owner.controller.list.toggleItem(s.item('A')); model.owner.controller.list.changeGroup('G'); await s.flush(); model.owner.controller.list.requestMove(); model = f.render();
    const original = model.overlay.controller, ticket = model.overlay.move; model.overlay.chooseMove(ticket, true); assert.equal(model.owner.controller.list.getSnapshot().moving, true); assert.equal(f.calls.some(call => call[0] === 'move'), false);
    f.props.canInteractOwnedSurface = () => true; const fresh = f.render(); assert.equal(fresh.overlay.controller, original); assert.equal(fresh.overlay.move, ticket); assert.equal(fresh.overlay.moveVisible, false);
    await original.completeMove(ticket); await s.flush(); assert.equal(f.calls.filter(call => call[0] === 'move').length, 1); assert.equal(model.owner.controller.list.getSnapshot().moving, false); await original.completeMove(ticket); assert.equal(f.calls.filter(call => call[0] === 'move').length, 1);
  } finally { f.cleanup(); }
});
test('stable overlay owner does not retarget retained old move commands to a replacement OWN resolver', async () => {
  const f = hook({ overlays: true, props: { canInteractOwnedSurface: () => true } });
  try {
    f.render(); await s.flush(); let old = f.render(); old.owner.controller.list.toggleItem(s.item('A')); old.owner.controller.list.changeGroup('G'); await s.flush(); old.owner.controller.list.requestMove(); old = f.render(); const ticket = old.overlay.move;
    f.props.canInteractOwnedSurface = () => true; const fresh = f.render(); old.overlay.chooseMove(ticket, true); assert.equal(fresh.overlay.controller.getSnapshot().moveVisible, true); assert.equal(fresh.owner.controller.list.getSnapshot().prompt, ticket.prompt); assert.equal(f.calls.some(call => call[0] === 'move'), false);
    fresh.overlay.chooseMove(ticket, false); assert.equal(fresh.overlay.controller.getSnapshot().moveVisible, false); await fresh.overlay.controller.completeMove(ticket); assert.equal(f.calls.some(call => call[0] === 'move'), false);
  } finally { f.cleanup(); }
});
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
test('accepted customer page opening dismisses the original picker keyboard before navigation; blank, pending and retired actions do not', async () => {
  const pending = s.deferred(), opened = []; let f;
  f = hook({ props: { onCreateCustomer: async query => { opened.push([query, [...f.keyboard]]); return pending.promise; } } });
  try {
    f.render(); await s.flush(); let model = f.render(); model.openDialog(); model = f.render(); model.openPicker('customer'); await s.flush(); model = f.render(); f.keyboard.length = 0;
    model.pickerSearch('\u0085'); model.createCustomer(false); assert.deepEqual(f.keyboard, []); assert.deepEqual(opened, []);
    model.createCustomer(true); await s.flush(); assert.deepEqual(opened, [['', ['dismiss']]]); assert.deepEqual(f.keyboard, ['dismiss']);
    model.createCustomer(true); assert.deepEqual(f.keyboard, ['dismiss']); f.authority.parent = false; model.createCustomer(true); assert.deepEqual(f.keyboard, ['dismiss']);
    pending.resolve(null); await s.flush(); assert.equal(opened.length, 1);
  } finally { f.cleanup(); }
});

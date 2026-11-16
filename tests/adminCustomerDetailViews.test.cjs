const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminCustomerDetailViewSupport.cjs');
const disabled = (node, platform) => platform === 'android' ? node.props.enabled === false : !!node.props.modifiers?.some(mod => mod.name === 'disabled' && mod.args[0]);
const warehouse = model => ({ session: {}, witness: {}, isCurrent: model.current, isInteractive: model.controlsCurrent, principalRole: 'material_taminotchi', principalRef: model.detail.ref,
  displayName: model.detail.name, assignedWarehouses: model.detail.assigned_warehouses, reloadAssignedWarehouses: async () => ['New W'], onChanged() {}, assignedMessage: model.a('detail.material_scope_message'),
  chipKeyPrefix: 'admin-material-detail-warehouse-', addButtonKey: 'admin-material-detail-add-warehouse', buttonRadius: 14 });

for (const platform of ['android', 'ios']) {
  test(`${platform} customer retains the source card, genuine children and overlay footer while loading or offline`, () => {
    for (const loading of [true, false]) {
      const f = s.model({ loading, loadError: loading ? null : Error('offline'), expanded: false }), v = s.view(platform, f.model), tree = v.render();
      assert.equal(v.avatars.length, 1); assert.equal(v.avatars[0].size, 92); assert.equal(v.avatars[0].displayName, f.model.initials); assert.equal(v.avatars[0].isCurrent, f.model.current); assert.equal(v.avatars[0].canInteract, f.model.interactive);
      assert.equal(s.nodes(tree, node => node.type === 'ActualApparatusCard').length, 1); assert.equal(v.apparatus[0], f.model.apparatus);
      assert.equal(s.nodes(tree, node => node.type === 'ActualChatAction').length, 1); assert.equal(s.nodes(tree, node => node.type === 'LoadingIndicator').length, 0);
      const dock = s.nodes(tree, node => node.type === 'View' && node.props.children?.type === 'ActualDock')[0]; assert.equal(dock.props.style.position, 'absolute');
      assert.equal(s.byId(tree, 'admin-customer-detail-phone-action'), undefined); s.click(s.byId(tree, 'admin-customer-detail-admin-toggle'), platform); assert.equal(f.calls[0], 'toggle');
      if (!loading) { s.click(s.byId(tree, 'admin-customer-detail-retry'), platform); assert.ok(f.calls.includes('reload')); }
      if (platform === 'android') { assert.equal(s.nodes(tree, node => node.type === 'ActualProfileAction').length, 1);
        assert.ok(s.nodes(tree, node => node.type === 'TopAppBar')[0].props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 60)); }
      else assert.equal(s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight().type, 'ActualProfileAction');
    }
  });
  test(`${platform} readOnly/customer modes hide complete management controls and genuine assignment children`, () => {
    const f = s.model({}, { management: false, items: false, remove: false }), v = s.view(platform, f.model), tree = v.render();
    for (const id of ['admin-toggle', 'phone-action', 'copy-code', 'code-regenerate', 'items-view', 'items-add', 'remove']) assert.equal(s.byId(tree, `admin-customer-detail-${id}`), undefined);
    assert.equal(v.apparatus.length, 0); assert.equal(v.warehouses.length, 0); assert.equal(v.avatars.length, 1);
  });
  test(`${platform} customer preserves independent busy flags, raw code/captured DTO and immutable DTO retry text`, () => {
    const f = s.model({ savingPhone: true, removing: true, seconds: 1 }), tree = s.view(platform, f.model).render();
    assert.equal(disabled(s.byId(tree, 'admin-customer-detail-phone-action'), platform), true); assert.equal(disabled(s.byId(tree, 'admin-customer-detail-remove'), platform), true);
    assert.equal(disabled(s.byId(tree, 'admin-customer-detail-code-regenerate'), platform), false, 'code_locked and positive countdown do not disable regeneration');
    assert.equal(disabled(s.byId(tree, 'admin-customer-detail-items-add'), platform), false);
    for (const id of ['copy-code', 'code-regenerate', 'items-view', 'items-add']) s.click(s.byId(tree, `admin-customer-detail-${id}`), platform);
    assert.deepEqual(f.calls, [['copy', ' raw code '], 'regen', ['view', f.model.detail], 'add']);
    assert.ok(s.texts(tree).includes(f.model.a('profile.code_wait', { seconds: 27 }))); assert.equal(s.texts(tree).includes(f.model.a('profile.code_wait', { seconds: 1 })), false);
    const busy = s.model({ regenerating: true, addingItem: true }), next = s.view(platform, busy.model).render();
    assert.equal(disabled(s.byId(next, 'admin-customer-detail-code-regenerate'), platform), true); assert.equal(disabled(s.byId(next, 'admin-customer-detail-items-add'), platform), true);
    assert.equal(disabled(s.byId(next, 'admin-customer-detail-phone-action'), platform), false); assert.equal(disabled(s.byId(next, 'admin-customer-detail-remove'), platform), false);
  });
  test(`${platform} material renders raw group order and the genuine warehouse owner only for actual detail`, () => {
    const f = s.model({ detail: s.detail({ assigned_item_groups: [' Z ', 'a', 'a'] }) }, { material: true, items: false, remove: false }); f.model.materialWarehouse = warehouse(f.model);
    const v = s.view(platform, f.model), tree = v.render(); assert.equal(v.warehouses.length, 1); assert.equal(v.warehouses[0].principalRole, 'material_taminotchi');
    assert.equal(v.warehouses[0].principalRef, f.model.detail.ref); assert.equal(v.warehouses[0].isCurrent(), true);
    assert.equal(v.warehouses[0].chipKeyPrefix, 'admin-material-detail-warehouse-'); assert.equal(v.warehouses[0].buttonRadius, 14);
    assert.equal(s.byId(tree, 'admin-customer-detail-items-add'), undefined); assert.equal(s.byId(tree, 'admin-customer-detail-remove'), undefined);
    const text = s.texts(tree); assert.ok(text.indexOf(' Z ') < text.indexOf('a')); assert.equal(text.filter(value => value === 'a').length, 2);
    s.click(s.byId(tree, 'admin-material-detail-edit-item-groups'), platform); assert.deepEqual(f.calls, ['groups']);
    const initial = s.model({ detail: null, loading: true }, { material: true, items: false, remove: false }), loadingView = s.view(platform, initial.model); loadingView.render(); assert.equal(loadingView.warehouses.length, 0);
    v.runtime.unmount(); assert.equal(v.warehouses[0].isCurrent(), false); assert.equal(v.warehouses[0].isInteractive(), false);
  });
  test(`${platform} native item sheets retain short-content sizing, original rows, active-code-only busy state and captured caption`, () => {
    const f = s.model(), first = s.item(' A ', 'First'), second = s.item('B', 'Second');
    f.model.overlays.sheets.push({ id: 7, kind: 'available', detail: s.detail({ name: 'Captured customer' }), items: [first, second], activeCode: ' A ', collapsingCodes: [], closing: false });
    const v = s.view(platform, f.model), tree = v.render(), rows = v.rows(tree);
    assert.ok(s.texts(tree).includes('Captured customer')); assert.equal(disabled(s.byId(rows, 'admin-customer-available-item- A '), platform), true);
    assert.equal(disabled(s.byId(rows, 'admin-customer-available-item-B'), platform), false); s.click(s.byId(rows, 'admin-customer-available-item-B'), platform);
    assert.deepEqual(f.calls, [['item', 7, second]]);
    const native = s.nodes(tree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet'))[0];
    if (platform === 'android') { assert.equal(native.props.showDragHandle, false); native.props.onDismissRequest(); assert.deepEqual(f.calls.slice(-2), [['nativeClose', 7], ['finishClose', 7]]); }
    else { assert.equal(native.props.fitToContents, true); native.props.onIsPresentedChange(false); assert.deepEqual(f.calls.at(-1), ['nativeClose', 7]); native.props.onDismiss(); assert.deepEqual(f.calls.at(-1), ['finishClose', 7]); }
  });
  test(`${platform} groups use a 78 percent native sheet and preserve original selection/search/close acknowledgments`, async () => {
    const f = s.model({}, { material: true, items: false, remove: false }), sheet = { id: 9, kind: 'groups', choices: { available: ['Rulon', 'Kley'], selected: [], isCurrent: () => true }, selectedKeys: [], query: '', closing: false };
    f.model.overlays.sheets.push(sheet); const v = s.view(platform, f.model), tree = v.render(), rows = v.rows(tree), save = s.byId(tree, 'admin-material-item-groups-save');
    assert.equal(disabled(save, platform), true); const search = s.byId(tree, 'admin-material-item-groups-search'); search.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('  KLEY ');
    assert.deepEqual(f.calls[0], ['search', 9, '  KLEY ']);
    const toggle = s.nodes(rows, node => node.type === (platform === 'android' ? 'Checkbox' : 'Toggle'))[0]; toggle.props[platform === 'android' ? 'onCheckedChange' : 'onIsOnChange'](true);
    assert.deepEqual(f.calls[1], ['group', 9, 'Rulon', true]);
    if (platform === 'android') assert.ok(s.nodes(tree, node => node.type === 'Column').some(node => node.props.modifiers?.some(mod => mod.name === 'height' && mod.args[0] === 844 * .78)));
    else { assert.equal(s.nodes(tree, node => node.type === 'BottomSheet')[0].props.fitToContents, false); assert.ok(s.nodes(tree, node => node.type === 'Group')[0].props.modifiers.some(mod => mod.name === 'presentationDetents' && mod.args[0][0].fraction === .78)); }
    s.click(s.byId(tree, 'admin-material-item-groups-close'), platform); await s.flush(); assert.deepEqual(f.calls.slice(-1)[0], platform === 'android' ? ['finishClose', 9] : ['beginClose', 9, false]);
  });
  test(`${platform} typed prompt is closed in a committed render before dispatch and outside cancellation uses original prompt`, () => {
    for (const kind of ['customer', 'item']) {
      const prompt = Object.freeze({ serial: 3, kind, ...(kind === 'item' ? { item: s.item('A') } : {}) }), f = s.model({ prompt }), v = s.view(platform, f.model), tree = v.render();
      assert.ok(s.texts(tree).includes('Prompt body')); s.click(s.byId(tree, 'admin-customer-detail-remove-confirm'), platform);
      assert.deepEqual(f.calls, [['choose', prompt, true]]); const closed = v.render(); assert.equal(s.byId(closed, 'admin-customer-detail-remove-confirm'), undefined); assert.deepEqual(f.calls.at(-1), ['confirm', prompt]);
      const outside = s.model({ prompt }), outsideView = s.view(platform, outside.model), modal = outsideView.render();
      if (platform === 'android') s.nodes(modal, node => node.type === 'BasicAlertDialog')[0].props.onDismissRequest(); else s.nodes(modal, node => node.type === 'Pressable')[0].props.onPress();
      outsideView.render(); assert.deepEqual(outside.calls.at(-1), ['dismiss', prompt]);
    }
  });
}

test('customer phone retains the local native draft through handled failure/empty, hydrates idle DTO changes and retires old editor callbacks', async () => {
  const f = s.model(), r = s.runtime(), h = s.hooks(r), buffer = { value: 'original phone', writes: [], get() { return this.value; }, set(value) { this.value = value; this.writes.push(value); } };
  const render = () => r.render(() => h.useAdminCustomerPhoneEditor({ detail: f.model.detail, savingPhone: f.model.state.savingPhone, current: f.model.current, interactive: f.model.controlsCurrent, savePhone: f.model.savePhone }, buffer));
  const idle = render(); f.model.state.savingPhone = true; render(); idle.action(); assert.equal(render().editing, false); f.model.state.savingPhone = false; render().action(); const editing = render(); buffer.value = ' draft ';
  f.model.detail = s.detail({ phone: 'remote while editing' }); render(); assert.deepEqual(buffer.writes, []); await editing.submit(); assert.equal(render().editing, false); assert.equal(buffer.value, ' draft ');
  render().action(); assert.equal(render().editing, true); await editing.submit(); assert.equal(f.calls.length, 1, 'old native submit cannot target a reopened editor'); buffer.value = ' '; await render().submit(); assert.equal(render().editing, false); assert.equal(buffer.value, ' ');
  f.model.detail = s.detail({ phone: ' new phone ' }); render(); assert.equal(buffer.value, 'new phone'); const old = render(); r.unmount(); old.action(); assert.equal(f.calls.length, 2);
});
test('customer phone collapse destroys local edit state and an accepted remote acknowledgment cannot collapse or rewrite a new editor', async () => {
  const f = s.model(), pending = s.deferred(), r = s.runtime(), h = s.hooks(r), buffer = { get: () => 'draft', set() {} }; f.phone(() => pending.promise);
  const render = () => r.render(() => h.useAdminCustomerPhoneEditor({ detail: f.model.detail, savingPhone: false, current: f.model.current, interactive: f.model.controlsCurrent, savePhone: f.model.savePhone }, buffer));
  render().action(); const old = render(), writing = old.submit(); r.unmount(); const writes = r.counters.writes;
  const freshRuntime = s.runtime(), freshHook = s.hooks(freshRuntime), fresh = () => freshRuntime.render(() => freshHook.useAdminCustomerPhoneEditor({ detail: f.model.detail, savingPhone: false, current: f.model.current, interactive: f.model.controlsCurrent, savePhone: f.model.savePhone }, buffer));
  assert.equal(fresh().editing, false); fresh().action(); assert.equal(fresh().editing, true); pending.resolve(true); await writing; assert.equal(r.counters.writes, writes); assert.equal(fresh().editing, true);
});

async function realHook(t, modes = {}, options = {}) {
  let valid = true, focused = true, reads = 0, read = options.read ?? (async () => s.detail()), ticks, writes = [], back = [];
  const mode = { management: true, items: true, remove: true, material: false, ...modes };
  const controller = new s.AdminCustomerDetailController({ mode, isCurrent: () => valid, read: async () => { reads++; return read(); },
    phone: async (dto, phone) => { writes.push(['phone', dto, phone]); return s.detail({ phone, code_retry_after_sec: 19 }); }, regenerate: async () => { writes.push('regen'); return s.detail(); }, remove: async () => { writes.push('remove'); },
    items: async () => [s.item('A'), s.item('B')], assign: async item => s.detail({ assigned_items: [item] }), unassign: async () => s.detail({ assigned_items: [] }),
    groups: async () => ['Rulon', 'Kley'], updateGroups: async () => s.detail(), copy: async value => { writes.push(['copy', value]); }, everySecond: callback => { ticks = callback; return 1; }, cancelTimer() {} });
  const ownedBacks = new Set(), owner = { current: () => valid, controller, mode }, r = s.runtime(), h = s.hooks(r, { './adminCustomerDetailSession': { createAdminCustomerDetailSession: () => owner }, './AdminOwnedBackContext': { useAdminOwnedBack: handler => r.react.useLayoutEffect(() => { ownedBacks.add(handler); return () => ownedBacks.delete(handler); }, [handler]) },
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => r.react.useEffect(callback, [callback]) } });
  const props = { session: {}, witness: {}, isCurrent: () => true, customerRef: ' raw widget ref ', onBack: changed => back.push(changed), ...options.props };
  const render = () => r.render(() => h.useAdminCustomerDetail(props)); let admitted;
  const initial = r.render(() => { const model = h.useAdminCustomerDetail(props); admitted = model.current(); return model; }); await s.flush();
  t.after(() => { r.unmount(); controller.dispose(); });
  return { render, initial, initiallyAdmitted: admitted, r, h, props, ownedBacks, controller, writes, back, get reads() { return reads; }, read(value) { read = value; }, tick() { ticks?.(); }, focus(value) { focused = value; render(); }, retire() { valid = false; } };
}
test('real customer hook initially gates descendants until the parent starts, then exposes localized fallback without hiding the source card', async t => {
  const pending = s.deferred(), f = await realHook(t, {}, { read: () => pending.promise }); assert.equal(f.initiallyAdmitted, false);
  const loading = f.render(); assert.equal(loading.current(), true); assert.equal(loading.detail.name, loading.a('detail.loading')); assert.equal(loading.status, loading.a('detail.loading'));
  assert.equal(loading.detail.ref, ' raw widget ref '); pending.reject(Error('offline')); await s.flush(); const failed = f.render();
  assert.equal(failed.status, failed.a('detail.error')); assert.equal(failed.detail.name, failed.a('detail.customer')); assert.equal(failed.detail.phone, failed.a('profile.entered')); assert.equal(failed.detail.code, failed.a('profile.not_generated'));
  assert.equal(failed.title, 'Customer'); assert.equal(failed.subtitle, failed.a('detail.customer_profile')); assert.equal(failed.apparatus.customerRef, ' raw widget ref ');
});
test('real material hook derives exact router text, immutable code wait and genuine warehouse reload/change semantics', async t => {
  const f = await realHook(t, { material: true, items: false, remove: false }); f.controller.toggle(); const model = f.render();
  assert.equal(model.title, 'Material taminotchisi'); assert.equal(model.subtitle, 'Material ta’minotchisi profili'); assert.equal(model.apparatus.materialTaminotchi, true);
  const child = model.materialWarehouse; assert.equal(child.principalRef, model.detail.ref); assert.equal(child.displayName, model.detail.name); assert.equal(child.assignedMessage, model.a('detail.material_scope_message'));
  const original = model.detail; f.read(async () => s.detail({ name: 'Read helper only', assigned_warehouses: ['Reloaded'], code_retry_after_sec: 41 }));
  assert.deepEqual(await child.reloadAssignedWarehouses(), ['Reloaded']); assert.equal(f.controller.getSnapshot().detail, original); assert.equal(f.controller.getSnapshot().seconds, 41);
  child.onChanged(['Reloaded']); assert.deepEqual(f.controller.getSnapshot().detail.assigned_warehouses, ['Reloaded']); assert.equal(f.controller.getSnapshot().detail.name, original.name);
  f.tick(); assert.equal(f.render().detail.code_retry_after_sec, 27); assert.equal(f.render().state.seconds, 40);
  f.retire(); child.onChanged(['stale']); await assert.rejects(child.reloadAssignedWarehouses(), /session changed/); assert.deepEqual(f.controller.getSnapshot().detail.assigned_warehouses, ['Reloaded']);
});
test('real customer hook fences blur, replay and stale subordinate callbacks; source apparatus changes return a genuine changed back result', async t => {
  const f = await realHook(t); f.controller.toggle(); const old = f.render(); f.focus(false); old.regenerate(); old.requestRemove(); assert.deepEqual(f.writes, []);
  f.focus(true); f.r.replay(); await s.flush(); f.controller.toggle(); const fresh = f.render(); old.regenerate(); old.apparatus.onChanged(); assert.deepEqual(f.writes, []); assert.equal(f.controller.getSnapshot().changed, false);
  fresh.apparatus.onChanged(); fresh.back(); fresh.back(); assert.deepEqual(f.back, [true]);
  const readOnly = await realHook(t, { management: false, items: false, remove: false }); const readonly = readOnly.render(); readonly.apparatus.onChanged(); readonly.regenerate(); readonly.toggle(); assert.equal(readOnly.controller.getSnapshot().changed, false); assert.deepEqual(readOnly.writes, []);
});
test('Customer original host interaction holds source controls and owned Back without retiring accepted prompt completion', async t => {
  let allowed = true; const f = await realHook(t, {}, { props: { canInteract: () => allowed } }); f.controller.toggle(); let model = f.render();
  allowed = false; model.regenerate(); model.requestRemove(); [...f.ownedBacks][0](); assert.equal(model.current(), true); assert.deepEqual(f.writes, []); assert.deepEqual(f.back, []);
  allowed = true; model.requestRemove(); model = f.render(); const prompt = model.state.prompt; assert.equal(model.choosePrompt(prompt, true), true);
  allowed = false; f.focus(false); await model.confirmPrompt(prompt); assert.deepEqual(f.writes, ['remove']); assert.deepEqual(f.back, [true]);
});
test('real customer typed remove labels retain source customer/item distinction and accepted removal calls back once after host closure', async t => {
  const f = await realHook(t); f.controller.toggle(); let model = f.render(); model.requestRemove(); model = f.render();
  assert.equal(model.promptText.confirm, model.a('detail.customer_remove')); assert.equal(model.promptText.cancel, model.a('action.cancel')); assert.equal(model.promptText.destructive, true);
  const hostRuntime = s.runtime(), host = s.hooks(hostRuntime), renderHost = () => hostRuntime.render(() => host.useAdminCustomerPromptHost(f.render()));
  renderHost().choose(true); assert.deepEqual(f.writes, []); assert.equal(renderHost().visible, false); await s.flush(); assert.deepEqual(f.writes, ['remove']); assert.deepEqual(f.back, [true]); model.back(); assert.deepEqual(f.back, [true]);
  const itemOwner = await realHook(t); itemOwner.controller.toggle(); model = itemOwner.render(); model.openAssigned(model.detail); model = itemOwner.render(); const sheet = model.overlays.sheets[0]; const removing = model.actOnItem(sheet.id, sheet.items[0]); model = itemOwner.render();
  assert.equal(model.promptText.title, model.a('detail.item_unlink_title')); assert.equal(model.promptText.body, model.a('detail.customer_item_remove_message', { item: sheet.items[0].name }));
  assert.equal(model.promptText.cancel, model.a('bulk_move.no')); assert.equal(model.promptText.confirm, model.a('bulk_move.yes')); assert.equal(model.promptText.destructive, false);
  const prompt = model.state.prompt; model.choosePrompt(prompt, false); model.dismissPrompt(prompt); await removing;
});
test('new native material child can start its genuine reader before parent layout; StrictMode replay retains presence and actual collapse retires all original callbacks', async () => {
  const f = s.model({}, { material: true, items: false, remove: false }), parent = s.runtime(), child = s.runtime(), h = s.hooks(parent); let changed = 0, reads = 0, serial = 0;
  const raw = { ...warehouse(f.model), onChanged: () => { changed++; } };
  const props = parent.render(() => { const controls = h.useAdminCustomerControls(f.model); return h.useAdminCustomerWarehouseProps(raw, controls.lifetimeCurrent, controls.current); }, false);
  parent.commit(['insertion']);
  const editor = new s.AdminWorkerDetailEditorController({ mode: 'warehouse', isCurrent: props.isCurrent, nextId: () => ++serial, name: () => props.displayName,
    assignedWarehouses: () => props.assignedWarehouses, assignedMaterials: () => [], warehouses: async (guard, witness) => { guard(); assert.equal(witness(), true); reads++; return [{ warehouse: 'Available', is_group: false }]; },
    materials: async () => [], assignWarehouse: async () => ({}), unassignWarehouse: async () => {}, reloadWarehouses: async () => [], assignMaterial: async () => ({}), unassignMaterial: async () => {}, reloadMaterials: async () => [],
    changedWarehouses: props.onChanged, changedMaterials() {}, text: key => key, notice() {}, rawNotice() {} });
  const renderChild = () => child.render(() => child.react.useLayoutEffect(() => { editor.start(); void editor.add(); return () => editor.dispose(); }, [editor]));
  renderChild(); parent.commit(['layout', 'passive']); await s.flush(); assert.equal(reads, 1); assert.equal(editor.getSnapshot().picker.kind, 'warehouse');
  parent.replayCleanup(); child.replayCleanup(); child.replaySetup(); parent.replaySetup(); await s.flush(); assert.equal(reads, 2); assert.equal(editor.isCurrent(), true);
  props.onChanged(['New']); assert.equal(changed, 1); parent.unmount(); assert.equal(props.isCurrent(), false); props.onChanged(['Stale']); assert.equal(changed, 1);
  await assert.rejects(props.reloadAssignedWarehouses(), /editor changed/); await editor.add(); assert.equal(reads, 2); assert.equal(editor.getSnapshot().phase, 'invalidated'); child.unmount();
});
test('the genuine avatar hook starts its first image read after Customer admission and obtains a fresh owner after parent replay', async t => {
  const f = await realHook(t), r = s.runtime(), imageModel = s.load('admin/adminProfileAvatarModel', { './dartJsonString': s.strings });
  const { AdminProfileAvatarController } = s.load('admin/adminProfileAvatarController', { '../shared/camera/synchronousGuard': s.strict, './adminProfileAvatarModel': imageModel, './dartJsonString': s.strings });
  const reads = [], owners = [];
  const hook = s.load('admin/useAdminProfileAvatar', { react: r.react, '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/camera/synchronousGuard': s.strict,
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './adminProfileAvatarModel': imageModel,
    './adminProfileAvatarSession': { adminProfileAvatarSession: (_session, _witness, isCurrent) => {
      const controller = new AdminProfileAvatarController({ isCurrent, cached: () => null, forget() {}, read: (url, guard, signal) => { guard(); const pending = s.deferred(); reads.push({ url, signal, ...pending }); return pending.promise; } });
      owners.push(controller); return { controller, namespace: 'original customer scope', current: isCurrent };
    } } });
  t.after(() => { r.unmount(); owners.forEach(owner => owner.dispose()); });
  assert.equal(f.initiallyAdmitted, false); assert.equal(reads.length, 0, 'the parent native screen returns null before admission');
  const render = model => r.render(() => hook.useAdminProfileAvatar({ session: f.props.session, witness: f.props.witness, isCurrent: model.current, canInteract: model.interactive,
    avatarUrl: model.detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92 }));
  const parent = f.render(); render(parent); assert.equal(reads.length, 1); assert.equal(reads[0].url, parent.detail.avatar_url); assert.equal(owners[0].isCurrent(), true);
  r.replay(); assert.equal(reads.length, 2); assert.equal(reads[0].signal.aborted, true); assert.equal(owners[0].isCurrent(), true);
  f.r.replay(); await s.flush(); assert.equal(parent.current(), false); render(f.render()); assert.equal(owners.length, 2); assert.equal(reads.length, 3); assert.equal(reads[1].signal.aborted, true);
  reads[0].resolve('old image'); reads[1].resolve('old replay image'); reads[2].resolve('current image'); await s.flush(); assert.equal(owners[0].getSnapshot().uri, null); assert.equal(owners[1].getSnapshot().uri, 'current image');
});

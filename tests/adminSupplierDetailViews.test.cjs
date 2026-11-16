const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');

for (const platform of ['android', 'ios']) {
  test(`${platform} supplier identity, genuine slots and overlay dock retain source profile geometry`, () => {
    const f = s.model({ expanded: false }), v = s.view(platform, f.model), tree = v.render();
    assert.equal(v.avatars.length, 1); assert.equal(v.avatars[0].size, 92); assert.equal(v.avatars[0].displayName, 'SN'); assert.equal(v.avatars[0].isCurrent, f.model.current);
    assert.equal(s.nodes(tree, node => node.type === 'ActualChatAction').length, 1);
    const dock = s.nodes(tree, node => node.type === 'View' && node.props.children?.type === 'ActualDock')[0]; assert.equal(dock.props.style.position, 'absolute'); assert.equal(dock.props.style.bottom, 0);
    if (platform === 'android') assert.equal(s.nodes(tree, node => node.type === 'ActualProfileAction').length, 1);
    else assert.equal(s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight().type, 'ActualProfileAction');
    assert.equal(s.byId(tree, 'admin-supplier-detail-phone-action'), undefined); s.click(s.byId(tree, 'admin-supplier-detail-admin-toggle'), platform); assert.deepEqual(f.calls, ['toggle']);
  });
  test(`${platform} supplier readOnly hides the whole controls group including item navigation and expand toggle`, () => {
    const f = s.model({ expanded: true }, true), tree = s.view(platform, f.model).render();
    for (const id of ['admin-toggle', 'phone-action', 'copy-code', 'regenerate-code', 'items-view', 'items-add', 'status', 'remove']) assert.equal(s.byId(tree, `admin-supplier-detail-${id}`), undefined, id);
    assert.ok(s.texts(tree).includes(f.model.a('detail.items_count', { count: 1 }))); assert.equal(s.nodes(tree, node => node.type === 'ActualAvatar').length, 1);
  });
  test(`${platform} supplier four busy flags stay independent and code/DTO/item actions retain source arguments`, () => {
    const f = s.model({ savingPhone: true, savingStatus: true, seconds: 99 }), tree = s.view(platform, f.model).render();
    const isDisabled = node => platform === 'android' ? node.props.enabled === false : node.props.modifiers?.some(mod => mod.name === 'disabled' && mod.args[0]);
    assert.ok(isDisabled(s.byId(tree, 'admin-supplier-detail-phone-action'))); assert.ok(isDisabled(s.byId(tree, 'admin-supplier-detail-status')));
    assert.equal(!!isDisabled(s.byId(tree, 'admin-supplier-detail-regenerate-code')), false); assert.equal(!!isDisabled(s.byId(tree, 'admin-supplier-detail-remove')), false);
    for (const id of ['items-view', 'items-add', 'copy-code', 'regenerate-code']) s.click(s.byId(tree, `admin-supplier-detail-${id}`), platform);
    assert.deepEqual(f.calls, ['view', 'add', ['copy', ' raw code '], 'regen']); assert.ok(s.texts(tree).includes(f.model.a('profile.code_wait', { seconds: 99 })));
    const other = s.model({ regenerating: true, removing: true }), next = s.view(platform, other.model).render();
    assert.ok(isDisabled(s.byId(next, 'admin-supplier-detail-regenerate-code'))); assert.ok(isDisabled(s.byId(next, 'admin-supplier-detail-remove')));
    assert.equal(!!isDisabled(s.byId(next, 'admin-supplier-detail-status')), false); s.click(s.byId(next, 'admin-supplier-detail-status'), platform); assert.equal(other.calls[0][1], other.model.state.detail);
    if (platform === 'android') assert.ok(s.byId(next, 'admin-supplier-detail-phone-action').props.modifiers.some(mod => mod.name === 'size' && mod.args[0] === 48));
    else assert.equal(s.nodes(s.byId(next, 'admin-supplier-detail-copy-code'), node => node.type === 'Image' && node.props.systemName === 'document.on.document').length, 1);
  });
  test(`${platform} supplier empty code/items and load/error states keep exact source text and retry`, () => {
    const f = s.model({ detail: s.detail({ phone: '', code: ' ', assigned_items: [] }), seconds: 0 }), tree = s.view(platform, f.model).render();
    assert.ok(s.texts(tree).includes(f.model.a('profile.code_not_shown'))); assert.ok(s.texts(tree).includes(f.model.a('detail.assigned_items_empty')));
    assert.equal(s.byId(tree, 'admin-supplier-detail-copy-code'), undefined); assert.equal(s.texts(tree).includes(f.model.a('profile.code_copy_hint')), false);
    for (const phase of ['loading', 'error']) { const owner = s.model({ phase, detail: null }), v = s.view(platform, owner.model), body = v.render(); assert.equal(v.avatars.length, 0);
      if (phase === 'loading' && platform === 'android') assert.equal(s.nodes(body, node => node.type === 'LoadingIndicator').length, 1);
      if (phase === 'error') { assert.ok(s.texts(body).includes(owner.model.t('serverDisconnectedRetry'))); s.click(s.byId(body, 'admin-supplier-detail-retry'), platform); assert.deepEqual(owner.calls, ['reload']); }
    }
  });
  test(`${platform} supplier remove dialog preserves exact title/body/customer_remove label and native outside cancellation`, () => {
    const prompt = Object.freeze({ serial: 8 }), f = s.model({ removePrompt: prompt }), v = s.view(platform, f.model), tree = v.render();
    assert.ok(s.texts(tree).includes(f.model.a('detail.supplier_remove_title'))); assert.ok(s.texts(tree).includes(f.model.a('detail.supplier_remove_message')));
    assert.ok(s.texts(s.byId(tree, 'admin-supplier-detail-remove-confirm')).includes(f.model.a('detail.customer_remove')));
    if (platform === 'android') s.nodes(tree, node => node.type === 'BasicAlertDialog')[0].props.onDismissRequest();
    else s.nodes(tree, node => node.type === 'Pressable')[0].props.onPress();
    assert.deepEqual(f.calls, []); v.render(); assert.deepEqual(f.calls, [['dismiss', prompt]]);
  });
}

test('supplier native private phone controller ignores raw DTO changes while editing; handled failure/empty closes and retains draft', async () => {
  const f = s.model(), r = s.runtime(), helper = s.hooks(r), buffer = { value: 'original phone', writes: [], get() { return this.value; }, set(text) { this.value = text; this.writes.push(text); } };
  const render = () => r.render(() => helper.useAdminSupplierPhoneEditor(f.model, buffer));
  const idle = render(); f.model.state.savingPhone = true; render(); idle.action(); assert.equal(render().editing, false, 'queued idle action observes the committed busy flag');
  f.model.state.savingPhone = false; render().action(); let editor = render(); assert.equal(editor.editing, true); buffer.value = ' draft ';
  f.model.state.detail = s.detail({ phone: 'remote while editing' }); render(); assert.deepEqual(buffer.writes, []);
  await editor.submit(); assert.equal(render().editing, false); assert.equal(buffer.value, ' draft '); assert.equal(f.calls[0][1].phone, ' original phone ', 'submit captures the DTO held by its original native callback');
  render().action(); editor = render(); assert.equal(buffer.value, ' draft '); buffer.value = ' '; await editor.submit(); assert.equal(render().editing, false); assert.equal(buffer.value, ' ');
  f.model.state.detail = s.detail({ phone: ' new idle value ' }); render(); assert.equal(buffer.value, 'new idle value');
});
test('supplier old native phone submit cannot close or save a later editor or a recreated owner', async () => {
  const f = s.model(), r = s.runtime(), helper = s.hooks(r), pending = s.deferred(), buffer = { get: () => 'draft', set() {} }; f.phone(() => pending.promise);
  const render = () => r.render(() => helper.useAdminSupplierPhoneEditor(f.model, buffer));
  render().action(); const old = render(), saving = old.submit(); r.unmount(); const writes = r.counters.writes;
  pending.resolve(true); await saving; await old.submit(); assert.equal(r.counters.writes, writes); assert.equal(f.calls.length, 1);
  const nextRuntime = s.runtime(), nextHelper = s.hooks(nextRuntime), next = () => nextRuntime.render(() => nextHelper.useAdminSupplierPhoneEditor(f.model, buffer));
  assert.equal(next().editing, false); next().action(); assert.equal(next().editing, true); await old.submit(); assert.equal(f.calls.length, 1);
  f.valid(false); next().action(); assert.equal(f.calls.length, 1);
});
test('supplier successful/failed handled return retires the original phone input callback, while false authority return keeps editing', async () => {
  const f = s.model(), r = s.runtime(), helper = s.hooks(r), buffer = { get: () => 'draft', set() {} }, render = () => r.render(() => helper.useAdminSupplierPhoneEditor(f.model, buffer));
  render().action(); const first = render(); f.phone(async () => false); await first.submit(); assert.equal(render().editing, true);
  f.phone(async () => true); await first.submit(); assert.equal(render().editing, false); const count = f.calls.length;
  render().action(); assert.equal(render().editing, true); await first.submit(); assert.equal(f.calls.length, count);
});
test('remove host closes in a committed render before original confirm, consumes once, and never dismisses first', () => {
  const prompt = Object.freeze({ serial: 1 }), f = s.model({ removePrompt: prompt }), r = s.runtime(), helper = s.hooks(r), render = () => r.render(() => helper.useAdminSupplierRemoveHost(f.model));
  const original = render(); assert.equal(original.visible, true); original.choose(true); original.choose(false); assert.deepEqual(f.calls, []);
  assert.equal(render().visible, false); assert.deepEqual(f.calls, [['confirm', prompt]]); render(); original.choose(true); assert.equal(f.calls.length, 1);
});
test('unaccepted hidden remove actions are blocked; accepted original intent survives focus loss but session retirement never revives it', () => {
  const prompt = Object.freeze({ serial: 1 }), f = s.model({ removePrompt: prompt }), r = s.runtime(), helper = s.hooks(r), render = () => r.render(() => helper.useAdminSupplierRemoveHost(f.model));
  const host = render(); f.focus(false); host.choose(true); assert.equal(render().visible, true); f.focus(true); host.choose(true); f.focus(false); render(); assert.deepEqual(f.calls, [['confirm', prompt]]);
  const retired = s.model({ removePrompt: prompt }), runtime = s.runtime(), hooks = s.hooks(runtime), next = () => runtime.render(() => hooks.useAdminSupplierRemoveHost(retired.model));
  next().choose(true); retired.valid(false); next(); retired.valid(true); next(); assert.deepEqual(retired.calls, []);
  const stale = next(); runtime.unmount(); const count = runtime.counters.writes; stale.choose(true); assert.equal(runtime.counters.writes, count);
});

async function realHook(t, readOnly = false) {
  let valid = true, focused = true, back = [], callbacks = [], posted = [], removed, reads = 0, read = async () => s.detail();
  const controller = new s.AdminSupplierDetailController({ isCurrent: () => valid, readOnly, read: async () => { reads++; return read(); }, status: async (dto, blocked) => s.detail({ blocked }),
    phone: async (dto, phone) => s.detail({ phone }), regenerate: async () => s.detail(), remove: async () => { posted.push('remove'); if (removed) await removed.promise; }, copy: async () => {},
    everySecond: () => 1, cancelTimer() {} });
  const owner = { current: () => valid, controller }, r = s.runtime(), h = s.hooks(r, { './adminSupplierDetailSession': { createAdminSupplierDetailSession: () => owner },
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => r.react.useEffect(callback, [callback]) } });
  const props = { session: {}, witness: {}, isCurrent: () => true, supplierRef: ' raw widget ref ', readOnly,
    onBack: changed => back.push(changed), onViewItems: ref => callbacks.push(['view', ref]), onAddItem: ref => callbacks.push(['add', ref]) };
  const render = () => r.render(() => h.useAdminSupplierDetail(props)); render(); await s.flush();
  t.after(() => { r.unmount(); controller.dispose(); });
  return { render, r, controller, callbacks, back, posted, get reads() { return reads; }, read(value) { read = value; }, focus(value) { focused = value; render(); }, retire() { valid = false; }, pendingRemove() { removed = s.deferred(); return removed; } };
}
test('real supplier hook forwards raw item refs, captured DTO writes and changed back result without inventing return refresh', async t => {
  const f = await realHook(t), model = f.render(); model.viewItems(); model.addItem(); assert.deepEqual(f.callbacks, [['view', ' raw widget ref '], ['add', ' raw widget ref ']]);
  await model.savePhone(model.state.detail, '123'); model.back(); assert.deepEqual(f.back, [true]);
  const hidden = await realHook(t, true), readonly = hidden.render(); readonly.viewItems(); readonly.addItem(); readonly.toggle(); assert.deepEqual(hidden.callbacks, []); assert.equal(hidden.controller.getSnapshot().expanded, false);
});
test('real supplier hook rejects callbacks from blur/StrictMode replay and returns remove true only to the original owner', async t => {
  const f = await realHook(t), original = f.render(); f.focus(false); original.viewItems(); original.requestRemove(); assert.deepEqual(f.callbacks, []); assert.equal(f.controller.getSnapshot().removePrompt, null);
  f.focus(true); f.r.replay(); await s.flush(); const fresh = f.render(); original.viewItems(); original.requestRemove(); assert.deepEqual(f.callbacks, []); assert.equal(f.controller.getSnapshot().removePrompt, null);
  fresh.requestRemove(); const prompt = f.controller.getSnapshot().removePrompt, pending = f.pendingRemove(), saving = fresh.confirmRemove(prompt); assert.deepEqual(f.posted, ['remove']);
  f.retire(); pending.resolve(); await saving; assert.deepEqual(f.back, []);
  const valid = await realHook(t), model = valid.render(); model.requestRemove(); await model.confirmRemove(valid.controller.getSnapshot().removePrompt); model.back(); assert.deepEqual(valid.back, [true]);
});
test('real supplier retry callback cannot reload content after its original error surface is gone', async t => {
  const f = await realHook(t); f.read(async () => { throw Error('offline'); }); await f.controller.reload(); const error = f.render();
  assert.equal(error.state.phase, 'error'); f.read(async () => s.detail()); error.reload(); await s.flush(); assert.equal(f.controller.getSnapshot().phase, 'content');
  const reads = f.reads; error.reload(); await s.flush(); assert.equal(f.reads, reads);
});

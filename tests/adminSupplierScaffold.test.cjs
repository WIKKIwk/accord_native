/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');
const { runtime } = require('./adminCustomerDetailViewSupport.cjs');
const { adminSupplierBodySafeAreaBottom: bottom } = s.load('admin/adminSupplierScaffoldLayout');
const raw = patch => Object.freeze({ platform: 'android', width: 390, height: 844, viewPaddingBottom: 34, systemGestureInsetsBottom: 48, viewInsetsBottom: 0, ...patch });
test('actual Flutter extended-body boundary includes equality and removes raw bottom padding while outer AppShell reserve stays independent', () => {
  for (const hostHeight of [60, 75, 199, 232]) {
    for (const ime of [0, 1, hostHeight - .5, hostHeight, hostHeight + .5, 400]) assert.equal(bottom({ metrics: raw({ viewInsetsBottom: ime }), hostHeight }), ime <= hostHeight ? hostHeight : 0);
  }
  const shell = s.load('admin/adminShellLayoutPolicy'); assert.equal(shell.adminShellBottomReserve(raw({ viewInsetsBottom: 1 }), true, true), 0);
  assert.equal(bottom({ metrics: raw({ viewInsetsBottom: 1 }), hostHeight: 199 }), 199);
  assert.equal(bottom({ metrics: raw({ viewPaddingBottom: 900 }), hostHeight: 75 }), 75, 'Scaffold removes bottom MediaQuery padding because an actual bottomNavigationBar exists');
});
test('unknown raw measurements or host height remain unavailable; iOS floating keyboard uses actual zero IME rather than keyboard visibility', () => {
  for (const facts of [{ metrics: null, hostHeight: 199 }, { metrics: raw(), hostHeight: null }, { metrics: raw(), hostHeight: NaN }, { metrics: raw(), hostHeight: -1 },
    { metrics: raw({ viewInsetsBottom: NaN }), hostHeight: 199 }, { metrics: raw({ viewInsetsBottom: -1 }), hostHeight: 199 }]) assert.equal(bottom(facts), null);
  assert.equal(bottom({ metrics: raw({ platform: 'ios', width: 1024, height: 1366, viewInsetsBottom: 0 }), hostHeight: 204 }), 204);
});
function scaffoldFixture(t) {
  const r = runtime(), backs = []; let valid = true, focused = true, facts = { metrics: raw(), hostHeight: null }, readCount = 0, posted = [], save = async phone => s.detail({ phone });
  const controller = new s.AdminSupplierDetailController({ isCurrent: () => valid, readOnly: false, read: async () => { readCount++; return s.detail(); },
    status: async () => s.detail(), phone: async (_dto, phone) => { posted.push(['phone', phone]); return save(phone); }, regenerate: async () => { posted.push('regenerate'); return s.detail(); },
    remove: async () => { posted.push('remove'); }, copy: async code => posted.push(['copy', code]), everySecond: () => 1, cancelTimer() {} });
  const authority = () => valid, canInteract = () => focused, scaffold = s.load('admin/adminSupplierScaffold', { react: r.react, '../shared/camera/synchronousGuard': s.strict,
    './AdminCreateHubProvider': { useAdminCreateHubScaffoldLayout: () => facts }, './adminSupplierScaffoldLayout': { adminSupplierBodySafeAreaBottom: bottom } });
  const detailHooks = s.hooks(r, { './adminSupplierDetailSession': { createAdminSupplierDetailSession: () => ({ controller, current: authority }) } });
  const props = { session: {}, witness: {}, isCurrent: authority, canInteract, supplierRef: ' ref ', onBack: value => backs.push(value), onViewItems() {}, onAddItem() {} };
  const render = () => r.render(() => { const view = scaffold.useAdminSupplierScaffold(authority, canInteract); return { scaffold: view, model: detailHooks.useAdminSupplierDetail({ ...props, ...view }) }; });
  t.after(() => { r.unmount(); controller.dispose(); });
  return { r, controller, render, authority, backs, get reads() { return readCount; }, posted, facts: value => { facts = value; }, focus: value => { focused = value; }, retire: () => { valid = false; }, save: value => { save = value; } };
}
test('genuine Supplier reader remains mounted through unknown/profile/menu/IME geometry and original accepted phone result still settles', async t => {
  const f = scaffoldFixture(t); f.render(); await s.flush(); const unknown = f.render(); assert.equal(f.reads, 1); assert.equal(unknown.model.current(), true); assert.equal(unknown.scaffold.bodySafeAreaBottom, null); assert.equal(unknown.model.bodyInteractive(), false);
  unknown.model.copy(' raw '); unknown.model.regenerate(); assert.deepEqual(f.posted, []);
  f.facts({ metrics: raw(), hostHeight: 199 }); const ready = f.render(); ready.model.toggle(); const expanded = f.render(), generation = expanded.model.generation, pending = s.deferred(); f.save(() => pending.promise);
  const saving = expanded.model.savePhone(expanded.model.state.detail, ' raw draft '); f.facts({ metrics: null, hostHeight: null }); const hidden = f.render();
  assert.equal(hidden.model.generation, generation); assert.equal(f.reads, 1); assert.equal(hidden.model.state.expanded, true); ready.model.regenerate(); assert.deepEqual(f.posted, [['phone', 'raw draft']]);
  pending.resolve(s.detail({ phone: 'ack' })); assert.equal(await saving, true); assert.equal(f.controller.getSnapshot().detail.phone, 'ack');
  for (const facts of [{ metrics: raw(), hostHeight: 75 }, { metrics: raw({ viewInsetsBottom: 75 }), hostHeight: 75 }, { metrics: raw({ viewInsetsBottom: 76 }), hostHeight: 75 }]) {
    f.facts(facts); const next = f.render(); assert.equal(next.model.generation, generation); assert.equal(next.model.state.expanded, true); assert.equal(f.reads, 1);
  }
});
test('geometry fence uses last committed facts and original mount/account even for callbacks retained before native hide', async t => {
  const f = scaffoldFixture(t); f.facts({ metrics: raw(), hostHeight: 199 }); f.render(); await s.flush(); const original = f.render(); assert.equal(original.scaffold.canInteractBody(), true);
  f.facts({ metrics: null, hostHeight: null }); f.render(); assert.equal(original.scaffold.canInteractBody(), false); original.model.copy('hidden'); assert.deepEqual(f.posted, []);
  f.facts({ metrics: raw(), hostHeight: 199 }); f.render(); assert.equal(original.scaffold.canInteractBody(), true); f.focus(false); assert.equal(original.scaffold.canInteractBody(), false); f.focus(true);
  f.retire(); assert.equal(original.scaffold.canInteractBody(), false); original.model.copy('retired'); assert.deepEqual(f.posted, []); f.r.unmount(); assert.equal(original.scaffold.canInteractBody(), false);
});
test('unknown body geometry leaves genuine header Back and original root-modal decisions usable while cached new body actions stay blocked', async t => {
  const f = scaffoldFixture(t); f.render(); await s.flush(); let model = f.render().model; model.back(); assert.deepEqual(f.backs, [false]); assert.equal(f.reads, 1);
  f.facts({ metrics: raw(), hostHeight: 199 }); model = f.render().model; model.requestRemove(); const prompt = f.controller.getSnapshot().removePrompt;
  f.facts({ metrics: null, hostHeight: null }); const unknown = f.render().model; assert.equal(unknown.interactive(), true); assert.equal(unknown.bodyInteractive(), false); model.regenerate(); assert.deepEqual(f.posted, []);
  unknown.back(); assert.equal(f.controller.getSnapshot().removePrompt, null); assert.deepEqual(f.backs, [false]);
  f.facts({ metrics: raw(), hostHeight: 199 }); f.render().model.requestRemove(); assert.notEqual(f.controller.getSnapshot().removePrompt, prompt); f.facts({ metrics: null, hostHeight: null });
  const hostRuntime = runtime(), helpers = s.hooks(hostRuntime), render = () => hostRuntime.render(() => helpers.useAdminSupplierRemoveHost(f.render().model));
  const native = render(); native.choose(false); assert.equal(render().visible, false); assert.equal(f.controller.getSnapshot().removePrompt, null); assert.deepEqual(f.posted, []); hostRuntime.unmount();
});
test('native phone edit buffer survives measured-to-unknown/profile/IME transitions and Source replay fences old callbacks', async t => {
  const f = scaffoldFixture(t), phoneRuntime = runtime(), helpers = s.hooks(phoneRuntime), buffer = { value: 'retained draft', get() { return this.value; }, set(value) { this.value = value; } };
  f.facts({ metrics: raw(), hostHeight: 199 }); f.render(); await s.flush(); let model = f.render().model;
  const renderPhone = () => phoneRuntime.render(() => helpers.useAdminSupplierPhoneEditor(model, buffer)); renderPhone().action(); const original = renderPhone(); assert.equal(original.editing, true);
  f.facts({ metrics: null, hostHeight: null }); model = f.render().model; assert.equal(renderPhone().editing, true); await original.submit(); assert.deepEqual(f.posted, []); assert.equal(buffer.value, 'retained draft');
  f.facts({ metrics: raw({ viewInsetsBottom: 300 }), hostHeight: 75 }); model = f.render().model; assert.equal(renderPhone().editing, true); assert.equal(f.reads, 1);
  const old = model; f.r.replay(); await s.flush(); model = f.render().model; old.copy('stale'); assert.deepEqual(f.posted, []); model.copy(' raw copy '); await s.flush(); assert.deepEqual(f.posted, [['copy', ' raw copy ']]);
  phoneRuntime.unmount();
});
for (const platform of ['android', 'ios']) {
  test(`${platform} inner Supplier SafeArea encloses loading/error/content without changing source outer6/18 reserve or list116`, () => {
    for (const phase of ['loading', 'error', 'content']) {
      const f = s.model({ phase, detail: phase === 'content' ? s.detail() : null }), view = s.view(platform, f.model); view.props.bodySafeAreaBottom = 199;
      let tree = view.render(), inner = s.nodes(tree, node => node.props.testID === 'admin-supplier-detail-inner-safe-area')[0]; assert.equal(inner.props.style[1].paddingBottom, 199);
      const reserve = s.nodes(tree, node => node.props.testID === 'admin-supplier-detail-body-frame-reserve')[0]; assert.equal(reserve.props.style[1].marginHorizontal, undefined); assert.equal(reserve.props.style[1].marginBottom, 92);
      assert.equal(s.nodes(inner, node => node.type === 'ActualDock').length, 0); const count = s.nodes(inner, () => true).length;
      if (phase === 'content') {
        if (platform === 'android') assert.equal(s.nodes(inner, node => node.type === 'RN.ScrollView')[0].props.contentContainerStyle.paddingBottom, 116);
        else assert.ok(s.nodes(inner, node => node.type === 'VStack' && node.props.modifiers?.some(mod => mod.name === 'padding' && mod.args[0].bottom === 116)).length);
      }
      view.props.bodySafeAreaBottom = null; tree = view.render(); inner = s.nodes(tree, node => node.props.testID === 'admin-supplier-detail-inner-safe-area')[0]; assert.equal(inner.props.pointerEvents, 'none'); assert.equal(inner.props.accessibilityElementsHidden, true); assert.equal(inner.props.style[1].opacity, 0); assert.equal(s.nodes(inner, () => true).length, count);
      view.props.bodySafeAreaBottom = 0; inner = s.nodes(view.render(), node => node.props.testID === 'admin-supplier-detail-inner-safe-area')[0]; assert.equal(inner.props.style[1].paddingBottom, 0); assert.equal(inner.props.pointerEvents, 'auto');
      view.props.bodySafeAreaBottom = undefined; assert.equal(s.nodes(view.render(), node => node.props.testID === 'admin-supplier-detail-inner-safe-area')[0], undefined);
    }
  });
  test(`${platform} genuine Scaffold wrapper requires root layout and preserves original session/reader/footer callback identities`, () => {
    const r = runtime(); let facts = { metrics: raw(), hostHeight: 199 };
    const shared = s.load('admin/adminSupplierScaffold', { react: r.react, '../shared/camera/synchronousGuard': s.strict,
      './AdminCreateHubProvider': { useAdminCreateHubScaffoldLayout: () => { if (!facts) throw new Error('AdminCreateHubProvider is required'); return facts; } }, './adminSupplierScaffoldLayout': { adminSupplierBodySafeAreaBottom: bottom } });
    const { AdminSupplierDetailWithScaffold } = s.compile(path.resolve(__dirname, `../src/admin/AdminSupplierDetailWithScaffold.${platform}.tsx`), {
      [`./AdminSupplierDetailRoute.${platform}`]: { AdminSupplierDetailRoute: 'ActualSupplierRoute' }, './adminSupplierScaffold': shared });
    const props = { session: {}, witness: {}, isCurrent: () => true, supplierRef: ' raw ', footer: { type: 'GenuineSourceDock' }, profileAction: { type: 'GenuineProfileAction' }, onBack() {}, onViewItems() {}, onAddItem() {} };
    const tree = r.render(() => AdminSupplierDetailWithScaffold(props)); assert.equal(tree.type, 'ActualSupplierRoute'); assert.equal(tree.props.footer, props.footer); assert.equal(tree.props.profileAction, props.profileAction); assert.equal(tree.props.isCurrent, props.isCurrent); assert.equal(tree.props.witness, props.witness); assert.equal(tree.props.onViewItems, props.onViewItems); assert.equal(tree.props.bodySafeAreaBottom, 199);
    facts = null; assert.throws(() => r.render(() => AdminSupplierDetailWithScaffold(props)), /Provider is required/); r.unmount();
  });
}

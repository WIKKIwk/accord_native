const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminItemCreateScreenSupport.cjs');
const native = require('./adminItemCreateAssemblySupport.cjs');
const root = tree => s.nodes(tree, node => node.props.testID === 'admin-item-create-screen')[0];
async function started(platform, overrides) { const f = s.fixture(platform, overrides); f.render(); await s.flush(); f.render(); return f; }

for (const platform of ['android', 'ios']) {
  test(`${platform} screen composes real header, inline Messenger banner, clipped body/list, absolute dock, original primary and native overlays`, async () => {
    const f = await started(platform); try {
      const tree = f.render(), children = root(tree).props.children.flat(Infinity).filter(Boolean), types = children.map(value => value.type);
      assert.equal(s.flattenStyle(root(tree).props.style).backgroundColor, platform === 'android' ? s.colors.surfaceContainerLow : s.colors.surface); assert.equal(s.flattenStyle(f.leaf.notice.inlineInsets).position, undefined);
      assert.equal(types.indexOf('GenuineInlineTopNoticeHost') < types.indexOf('SourceBodyFrame'), true); assert.equal(f.leaf.notice.scaffold.messenger, f.messenger); assert.deepEqual(f.leaf.notice.inlineInsets, { left: 11, right: 23 });
      assert.equal(f.leaf.notice.dismissLabel, f.props.topNoticeDismissLabel);
      assert.equal(f.leaf.header.model, f.model()); for (const key of ['session', 'witness', 'isCurrent', 'canInteract', 'profileAction', 'onBack']) assert.equal(f.leaf.header.props[key], f.props[key]);
      assert.equal(f.leaf.primary.model, f.model()); assert.equal(f.leaf.primary.render, f.props.renderPrimaryAction); assert.equal(f.leaf.overlays.model, f.model());
      assert.equal(f.leaf.list.bottomPadding, 439); const footer = children.find(value => value.type === 'View' && value.props.children?.type === 'GenuineDock'); assert.equal(s.flattenStyle(footer.props.style).position, 'absolute'); assert.equal(s.flattenStyle(footer.props.style).bottom, 0);
      assert.equal(f.fixedHosts.at(-1).sourceLayout, f.sourceLayout); assert.equal(f.fixedHosts.at(-1).scaffold.messenger, f.messenger); assert.equal(f.fixedHosts.at(-1).isCurrent, f.model().current);
      assert.equal(s.nodes(tree, node => node.type === 'View' && s.flattenStyle(node.props.style).height === 3).length, platform === 'ios' ? 1 : 0);
      if (platform === 'android') { assert.equal(s.flattenStyle(root(tree).props.style).paddingTop, 24); assert.deepEqual(s.nodes(tree, node => node.type === 'SafeAreaView')[0].props.edges, ['left', 'right']); assert.equal(f.leaf.overlays.portal, f.props.dialogPortal); assert.equal(f.leaf.overlays.observer, f.props.windowObserver); }
      else assert.equal(s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerStyle.backgroundColor, s.colors.surface);
    } finally { f.cleanup(); }
  });
  test(`${platform} missing genuine boundary/provider/ancestor never reaches the domain hook or starts original reads`, async () => {
    for (const change of [f => { f.props.canInteract = undefined; }, f => { f.props.footer = null; }, f => { f.props.sourceScaffoldAncestor = undefined; }, f => { f.props.fixedSnackBars = undefined; }, f => { f.props.fixedSnackBars.isAvailable = () => Promise.resolve(true); }, f => f.hubAvailable(false), f => f.noticeAvailable(false), f => f.safeAvailable(false)]) {
      const f = s.fixture(platform); try { change(f); assert.throws(f.render); await s.flush(); assert.equal(f.hookCalls(), 0); assert.deepEqual(f.calls, []); } finally { f.cleanup(); }
    }
  });
  test(`${platform} missing actual ItemDetail/CustomerCreate/result destinations stays genuinely held with no initial read or auto-dialog`, async () => {
    const f = s.fixture(platform, { screenProps: { onOpenItem: undefined, openCreateDialog: true } }); try { f.render(); await s.flush(); f.frame(); f.render(); assert.equal(f.model().owner.ready, false); assert.equal(f.model().state.form.dialog, null); assert.deepEqual(f.calls, []); } finally { f.cleanup(); }
  });
  test(`${platform} missing real dock measurement retains source list owner/read while headerBack remains available`, async () => {
    const f = await started(platform); try { const original = f.model().owner; f.sourceLayout.metrics = null; f.sourceLayout.hostHeight = null; const tree = f.render();
      assert.ok(s.nodes(tree, node => node.type === 'GenuineNativeHeader').length); assert.equal(f.leaf.list.bottomPadding, null); assert.equal(f.model().owner, original); assert.equal(f.model().current(), true); f.leaf.header.model.back(); assert.equal(f.model().owner, original);
    } finally { f.cleanup(); }
  });
  test(`${platform} real hook retains original read/navigation authority through blur but native controls require original actual top`, async () => {
    const pending = s.deferred(), row = s.item('A'), f = s.fixture(platform, { catalog: { adminCatalogItemsPage: async () => pending.promise } }); try {
      f.render(); await s.flush(); f.focus(false); f.top(false); f.render(); pending.resolve([row]); await s.flush(); f.render(); assert.equal(f.model().state.list.items[0], row); assert.equal(f.model().current(), true); assert.equal(f.model().nativeCurrent(), false);
      f.model().openDialog(); assert.equal(f.model().state.form.dialog, null); f.focus(true); f.top(true); f.render(); f.model().openDialog(); f.render(); assert.ok(f.model().state.form.dialog);
    } finally { f.cleanup(); }
  });
  test(`${platform} original-window header/banner use actual viewport facts while unknown geometry preserves original owner and header Back`, async () => {
    const f = s.fixture(platform); try {
      f.bindSourceScene(); f.safeAvailable(false); f.sourceWindowScope({ safeInsets: null, viewportWidth: null, metrics: null, thinGestureBottom: null }); f.sourceLayout.metrics = null; f.sourceLayout.hostHeight = null;
      f.render(); await s.flush(); let tree = f.render(); const original = f.model().owner; assert.ok(s.nodes(tree, node => node.type === 'GenuineNativeHeader').length); assert.equal(f.leaf.notice.inlineInsets, null);
      assert.equal(s.flattenStyle(root(tree).props.style).paddingTop, undefined); assert.equal(s.nodes(tree, node => node.type === 'SafeAreaView').length, 0); assert.equal(f.leaf.list.bottomPadding, null); f.leaf.header.model.back();
      f.sourceWindowScope({ safeInsets: { top: 61, left: 19, right: 27 }, viewportWidth: 480, metrics: null, thinGestureBottom: true }); tree = f.render(); assert.equal(f.model().owner, original); assert.deepEqual(f.leaf.notice.inlineInsets, { left: 19, right: 27, width: 480 });
      if (platform === 'android') { assert.equal(s.flattenStyle(root(tree).props.style).paddingTop, 61); const headerSafe = s.nodes(tree, node => node.props.testID === 'admin-item-create-header-safe-area')[0]; assert.equal(s.flattenStyle(headerSafe.props.style).paddingLeft, 19); assert.equal(s.flattenStyle(headerSafe.props.style).paddingRight, 27); }
      else assert.equal(s.flattenStyle(root(tree).props.style).paddingTop, undefined);
      assert.equal(f.model().current(), true); assert.equal(f.leaf.header.model, f.model());
    } finally { f.cleanup(); }
  });
}
test('Android missing real original observer or portal readiness is rejected before reads, with no synthesized carrier fallback', async () => {
  for (const change of [f => { f.props.windowObserver = undefined; }, f => { f.props.dialogPortal = undefined; }, f => { f.props.dialogPortal.isAvailable = () => false; }]) {
    const f = s.fixture(); try { change(f); assert.throws(f.render, /genuine original Android/); await s.flush(); assert.equal(f.hookCalls(), 0); assert.deepEqual(f.calls, []); } finally { f.cleanup(); }
  }
});
test('top notices resolve once at original controller publication using then-current locale and preserve the same global handle across re-render/locale/replay', async () => {
  const f = await started('android', { catalog: { adminCatalogItemUoms: async () => { throw Error('unavailable'); } } }); try {
    f.model().openDialog(); f.render(); f.locale.locale = 'ru'; f.model().save(); await s.flush(); const first = f.messenger.getSnapshot().head; assert.equal(first.message, s.l10n.adminText('item.uom_load_failed', 'ru'));
    f.locale.locale = 'en'; f.render(); assert.equal(f.messenger.getSnapshot().head, first); assert.equal(f.clock.size(), 1); f.r.replay(); await s.flush(); f.render(); assert.equal(f.messenger.getSnapshot().head, first); assert.equal(f.clock.size(), 1);
    assert.deepEqual(f.fixed, []);
  } finally { f.cleanup(); }
});
test('ordinary bulk-move messages enqueue only in the required separate fixed queue and never overwrite global TopNotice', async () => {
  const row = s.item('A'), f = await started('ios', { catalog: { adminCatalogItemsPage: async () => [row] } }); try {
    const top = f.service.show(f.messenger, { message: 'already visible', tone: 'success' }); f.model().toggleItem(row); f.render(); f.locale.locale = 'uz'; f.model().requestMove();
    assert.equal(f.fixed.length, 1); assert.equal(f.fixed[0].message, s.l10n.adminText('bulk_move.select_group', 'uz')); assert.equal(f.messenger.getSnapshot().head, top.banner); assert.ok(Object.isFrozen(f.fixed[0]));
    f.locale.locale = 'en'; f.render(); assert.equal(f.fixed.length, 1); assert.equal(f.fixed[0].message, s.l10n.adminText('bulk_move.select_group', 'uz')); f.focus(false); f.render(); assert.equal(f.fixedHosts.at(-1).isCurrent(), true);
  } finally { f.cleanup(); }
});
test('retired witness suppresses retained screen/native callbacks and notice publication without touching a fresh global target', async () => {
  const row = s.item('A'), f = await started('android', { catalog: { adminCatalogItemsPage: async () => [row] } }); try {
    const old = f.model(); old.openDialog(); f.render(); f.authority.witness = false; f.notify(); old.search('private'); old.save(); old.requestMove(); await s.flush(); assert.equal(f.render(), null); assert.deepEqual(f.fixed, []); assert.equal(f.messenger.getSnapshot().head, null);
    assert.equal(f.calls.filter(value => ['create', 'move'].includes(value[0])).length, 0);
  } finally { f.cleanup(); }
});
test('actual ItemDetail callback return is awaited across blur before original list invalidation/reload, without retargeting the row DTO', async () => {
  const returned = s.deferred(), opened = [], first = s.item('A'), second = s.item('B'); let rows = [first], f;
  f = await started('android', { catalog: { adminCatalogItemsPage: async () => rows }, props: { onOpenItem: async item => { opened.push(item); f.focus(false); await returned.promise; } } });
  try {
    f.model().openItem(first); f.render(); assert.deepEqual(opened, [first]); assert.equal(f.model().current(), true); assert.equal(f.model().nativeCurrent(), false); rows = [second];
    assert.equal(f.model().state.list.items[0], first); returned.resolve(); await s.flush(); f.focus(true); f.render(); assert.equal(f.model().state.list.items[0], second); assert.equal(f.model().owner.controller.getSnapshot().list.items[0], second);
  } finally { f.cleanup(); }
});
test('Source initial dialog stays postframe and returnOnCreate waits for the exact original native close acknowledgment, even after page blur', async () => {
  const returned = [], created = s.item('new raw code'), f = await started('ios', { catalog: { createAdminCatalogItem: async () => created }, screenProps: { openCreateDialog: true, returnOnCreate: true, onReturnCreated: item => returned.push(item) } });
  try {
    assert.equal(f.model().state.form.dialog, null); f.frame(); f.render(); const dialog = f.model().state.form.dialog; assert.ok(dialog); f.model().save(); await s.flush(); f.render(); assert.deepEqual(returned, []); assert.equal(f.model().state.closingDialog.id, dialog.id);
    f.focus(false); f.render(); f.model().completeDialog(dialog.id + 1); assert.deepEqual(returned, []); f.model().completeDialog(dialog.id); assert.deepEqual(returned, [created]); f.model().completeDialog(dialog.id); assert.deepEqual(returned, [created]);
  } finally { f.cleanup(); }
});
test('resolving a Source error message cannot publish a stale fixed notice after synchronous original witness retirement', async () => {
  const row = s.item('A'); let f; const error = { toString() { f.authority.witness = false; return 'original failure'; } };
  f = await started('android', { catalog: { adminCatalogItemsPage: async () => [row], moveAdminCatalogItems: async () => { throw error; } } });
  try {
    f.model().toggleItem(row); f.model().owner.controller.list.changeGroup('Target'); await s.flush(); f.render(); f.model().requestMove(); f.render(); const prompt = f.model().state.list.prompt, commit = f.model().chooseMove(true); assert.ok(prompt); await commit(); assert.deepEqual(f.fixed, []); assert.equal(f.model().owner.current(), false);
  } finally { f.cleanup(); }
});
test('focused page consumes actual supplied top guard inside every retained page closure and the actual native search/clear handlers', async () => {
  const row = s.item('A'), f = s.fixture('android'); let header;
  try {
    f.memory.writeList(f.memory.ticket('original namespace'), { query: 'kept', group: '', items: [row], hasMore: false }); f.render(); await s.flush(); f.render(); f.model().toggleItem(row); f.render();
    const old = f.model(), state = old.owner.controller.getSnapshot(), calls = f.calls.length; header = native.view('Header', 'android', { model: old, calls: [] }); const tree = header.render(), commands = header.commands.length;
    f.top(false); f.render(); assert.equal(f.model().focused, true); assert.equal(f.model().current(), true); assert.equal(f.model().nativeCurrent(), false);
    old.search('blocked'); old.searchFocus(true); old.toggleGroup(); old.group('blocked'); old.toggleItem(row); old.clearSelection(); old.openItem(row); old.requestMove(); old.openDialog(); old.back(); old.reload(); old.loadMore(); old.scroll(-1);
    native.nativeId(tree, 'admin-item-create-search').props.onValueChange('native blocked'); native.nativeId(tree, 'admin-item-search-close').props.onClick(); await s.flush();
    const after = old.owner.controller.getSnapshot(); assert.equal(after.list.searchDraft, state.list.searchDraft); assert.equal(after.list.group, state.list.group); assert.equal(after.list.groupExpanded, state.list.groupExpanded); assert.deepEqual(after.list.selectedCodes, state.list.selectedCodes); assert.equal(after.form.dialog, null); assert.equal(after.list.prompt, null); assert.equal(f.calls.length, calls); assert.equal(header.commands.length, commands); assert.equal(f.model().owner.current(), true);
    const originalOwner = f.model().owner; f.props.canInteract = () => true; f.render(); assert.equal(f.model().owner, originalOwner); assert.equal(old.nativeCurrent(), false); assert.equal(f.model().nativeCurrent(), true); old.search('stale old guard'); f.model().search('fresh guard'); assert.equal(f.model().owner.controller.getSnapshot().list.searchDraft, 'fresh guard');
  } finally { header?.r.unmount(); f.cleanup(); }
});
test('focused current form and picker native closures obey actual source-owner top while accepted picker completion remains account-owned', async () => {
  const created = [], f = await started('ios', { props: { onCreateCustomer: async name => { created.push(name); return null; } } });
  try {
    f.model().openDialog(); f.render(); f.model().changeName('kept name'); f.model().changeCode('kept code'); f.render(); const dialog = f.model(), draft = dialog.owner.controller.getSnapshot().form.draft, calls = f.calls.length;
    f.top(false); f.render(); assert.equal(f.model().focused, true); assert.equal(f.model().current(), true); assert.equal(f.model().nativeCurrent(), false);
    dialog.changeName('blocked'); dialog.changeCode('blocked'); dialog.clearCustomer(); dialog.save(); dialog.closeDialog(true); dialog.openPicker('group'); dialog.back(); await s.flush();
    assert.deepEqual(dialog.owner.controller.getSnapshot().form.draft, draft); assert.equal(dialog.owner.controller.getSnapshot().form.dialog.id, dialog.state.form.dialog.id); assert.equal(dialog.owner.controller.getSnapshot().picker, null); assert.equal(f.calls.length, calls);
    f.top(true); f.render(); f.model().openPicker('group'); await s.flush(); f.render(); const picker = f.model(), before = picker.state.picker.controller.getSnapshot(); f.top(false); f.render();
    picker.pickerSearch('blocked'); picker.pickerReload(); picker.pickerScroll(-1); picker.selectPickerString('All Item Groups'); picker.dismissPicker(); await s.flush();
    assert.equal(picker.state.picker.controller.getSnapshot(), before); f.top(true); f.render(); f.model().selectPickerString('All Item Groups'); f.top(false); f.render(); f.model().completePicker(); assert.equal(f.model().owner.controller.getSnapshot().picker, null);
    f.top(true); f.render(); f.model().openPicker('customer'); await s.flush(); f.render(); const customer = f.model(), customerState = customer.state.picker.controller.getSnapshot(); f.top(false); f.render(); customer.createCustomer(true); customer.dismissPicker(); customer.pickerSearch('blocked'); await s.flush();
    assert.deepEqual(created, []); assert.equal(customer.state.picker.controller.getSnapshot(), customerState); assert.equal(f.model().owner.current(), true);
  } finally { f.cleanup(); }
});
test('genuine accepted Root add continuation and header blur(false) preserve original account exceptions without relaxing late-dialog focus gap', async () => {
  const f = await started('android'); let primary;
  try {
    f.model().searchFocus(true); f.render(); const old = f.model(); primary = native.view('PrimaryAction', 'android', { model: old, calls: [] }); primary.render(); const accepted = primary.root.at(-1); assert.equal(accepted.canInteract(), true);
    f.focus(false); f.top(false); f.render(); assert.equal(accepted.canInteract(), false); old.searchFocus(false); await accepted.actions[0].onPress(); f.render();
    assert.equal(f.model().profileVisible, true); assert.ok(f.model().state.form.dialog); assert.equal(f.model().current(), true); assert.equal(f.model().nativeCurrent(), false);
    // This is the known held Root-top/page-focus gap, not an account-current substitute.
    f.model().changeName('must remain blocked'); assert.equal(f.model().owner.controller.getSnapshot().form.draft.name, '');
  } finally { primary?.r.unmount(); f.cleanup(); }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailActionMenuNativeSupport.cjs');

for (const platform of ['android', 'ios']) {
  test(`${platform} genuine finished content preserves four Source words/order/keys without inventing another action`, async () => {
    const f = await s.fixture(platform), tree = f.render(), rows = s.rows(tree);
    assert.deepEqual(rows.map(s.rowID), ['admin-finished-action-rename', 'admin-finished-action-customers', 'admin-finished-action-group', 'admin-finished-action-delete']);
    assert.deepEqual(s.texts(tree), ['detail.item_actions', 'detail.edit_name_code', 'detail.manage_customers', 'detail.change_group', 'detail.item_delete_title'].map(f.props.a));
    assert.ok(rows.every(row => !s.disabled(row, platform))); assert.equal(s.nodes(tree, node => ['Modal', 'ModalBottomSheet', 'BottomSheet'].includes(node.type)).length, 0);
    if (platform === 'android') {
      const column = s.nodes(tree, node => node.type === 'Column')[0]; assert.deepEqual(column.props.modifiers.find(value => value.name === 'padding').args, [20, 0, 20, 16]);
      assert.ok(rows.every(row => row.props.modifiers.some(value => value.name === 'defaultMinSize' && value.args[0].minHeight === 56)));
      assert.ok(rows.every(row => row.props.contentPadding.start === 16 && row.props.contentPadding.end === 24));
      assert.ok(s.nodes(tree, node => node.type === 'SymbolView').every(node => node.props.size === 24));
    }
  });
  test(`${platform} locked combo warning and all four disabled actions remain native and cannot issue a close`, async () => {
    const f = await s.fixture(platform, 'combo', 'ur'), tree = f.render(), rows = s.rows(tree);
    assert.equal(rows.length, 4); assert.ok(rows.every(row => s.disabled(row, platform)));
    assert.deepEqual(s.rowID(rows[0]), 'admin-combo-action-rename');
    assert.ok(s.texts(tree).includes(f.props.a('calculate.combo_actions_locked')));
    for (const row of rows) s.press(row, platform); assert.deepEqual(f.closes, []); assert.deepEqual(f.calls, []);
  });
  test(`${platform} choosing fences controls and only requests original native hide; captured action waits genuine host completion`, async () => {
    const f = await s.fixture(platform), old = s.rows(f.render())[0]; s.press(old, platform); s.press(old, platform);
    assert.equal(f.closes.length, 1); assert.deepEqual(f.owner.getSnapshot().dialogs, []); assert.deepEqual(f.calls, []);
    assert.ok(s.rows(f.render()).every(row => s.disabled(row, platform)));
    assert.equal(await f.controller.completeClose({ ...f.closes[0] }), null); assert.deepEqual(f.owner.getSnapshot().dialogs, []);
    // The fixture supplies the host's native-completion boundary; the content never calls it.
    const id = await f.controller.completeClose(f.closes[0]); assert.equal(f.dialog(id).kind, 'edit'); assert.equal(f.dialog(id).detail, f.initial);
    assert.equal(f.render(), null);
  });
  test(`${platform} covered, retired and actually unmounted native content cannot dispatch retained callbacks`, async () => {
    for (const effect of [f => f.interact(() => false), f => f.interact(() => Promise.reject(Error('async top'))), f => f.r.unmount(), f => f.retire()]) {
      const f = await s.fixture(platform), row = s.rows(f.render())[0]; effect(f); s.press(row, platform); assert.deepEqual(f.closes, []); assert.deepEqual(f.calls, []);
    }
    await s.flush();
  });
  test(`${platform} a retained old row never adopts a replacement menu generation or another host callback`, async () => {
    const f = await s.fixture(platform), old = s.rows(f.render())[0]; f.controller.dispose(); f.controller.start();
    const next = f.controller.request(f.initial); assert.ok(next); f.props.ticket = next; f.props.generation = f.controller.interactionGeneration; f.props.surfaceIdentity = {};
    const fresh = s.rows(f.render())[0]; s.press(old, platform); assert.deepEqual(f.closes, []); s.press(fresh, platform); assert.equal(f.closes.length, 1);
    const g = await s.fixture(platform), previous = s.rows(g.render())[0], nextCloses = []; g.props.onCloseRequested = value => nextCloses.push(value); g.render();
    s.press(previous, platform); assert.deepEqual(g.closes, []); assert.deepEqual(nextCloses, []);
  });
  test(`${platform} reentrant original-owner retirement during close publication cannot hide a replacement window`, async () => {
    const f = await s.fixture(platform), row = s.rows(f.render())[0]; f.controller.subscribe(() => { if (f.controller.getSnapshot().menus.some(menu => menu.closing)) f.retire(); });
    s.press(row, platform); assert.deepEqual(f.closes, []); assert.deepEqual(f.calls, []);
    const g = await s.fixture(platform), row2 = s.rows(g.render())[0]; g.controller.subscribe(() => { if (g.controller.getSnapshot().menus.some(menu => menu.closing)) g.surface(() => false); });
    s.press(row2, platform); assert.deepEqual(g.closes, []); assert.deepEqual(g.calls, []);
  });
  test(`${platform} accepted close survives content-only unmount and top loss until the original host actually acknowledges removal`, async () => {
    const f = await s.fixture(platform), row = s.rows(f.render())[0];
    f.controller.subscribe(() => { if (f.controller.getSnapshot().menus.some(menu => menu.closing)) { f.interact(() => false); f.r.unmount(); } });
    s.press(row, platform); assert.equal(f.closes.length, 1); assert.deepEqual(f.owner.getSnapshot().dialogs, []); assert.deepEqual(f.calls, []);
    assert.equal(f.controller.isClosePending({ ...f.closes[0] }, f.ticket, f.controller.interactionGeneration), false);
    s.press(row, platform); assert.equal(f.closes.length, 1);
    const id = await f.controller.completeClose(f.closes[0]); assert.equal(f.dialog(id).kind, 'edit');
  });
  test(`${platform} original surface identity rejects callback retargeting and permits StrictMode replay`, async () => {
    const f = await s.fixture(platform), row = s.rows(f.render())[0]; f.r.replay(); s.press(row, platform); assert.equal(f.closes.length, 1);
    const g = await s.fixture(platform), old = s.rows(g.render())[0], replacement = [];
    g.controller.subscribe(() => { if (g.controller.getSnapshot().menus.some(menu => menu.closing)) { g.props.onCloseRequested = value => replacement.push(value); g.render(); } });
    s.press(old, platform); assert.deepEqual(g.closes, []); assert.deepEqual(replacement, []);
    const h = await s.fixture(platform), stale = s.rows(h.render())[0]; h.props.surfaceIdentity = {}; h.render(); s.press(stale, platform); assert.deepEqual(h.closes, []);
  });
  test(`${platform} an accepted ticket already completed during publication cannot be handed off twice`, async () => {
    const f = await s.fixture(platform), row = s.rows(f.render())[0]; let close;
    const prepare = f.controller.prepareClose.bind(f.controller); f.controller.prepareClose = (...args) => { close = prepare(...args); if (close) void f.controller.completeClose(close); return close; };
    s.press(row, platform); await s.flush(); assert.ok(close); assert.deepEqual(f.closes, []); assert.equal(f.owner.getSnapshot().dialogs.length, 1);
  });
  test(`${platform} actual original hide failure never leaks a rejection or fabricates native completion`, async () => {
    for (const asyncFailure of [false, true]) {
      const f = await s.fixture(platform); f.props.onCloseRequested = () => { if (asyncFailure) return Promise.reject(Error('actual hide failed')); throw Error('actual hide failed'); };
      s.press(s.rows(f.render())[0], platform); await s.flush(); assert.equal(f.controller.getSnapshot().menus[0].closing, true); assert.deepEqual(f.owner.getSnapshot().dialogs, []); assert.deepEqual(f.calls, []);
    }
  });
}
test('missing actual host authority or close target is rejected before native menu content is rendered', async () => {
  const f = await s.fixture('android'); f.props.canInteract = undefined; assert.throws(f.render, /original action-menu host/);
  const g = await s.fixture('ios'); g.props.onCloseRequested = undefined; assert.throws(g.render, /original action-menu host/);
});
test('Android disabled Source ListTile uses ThemeData black38/white38 rather than tinting Scheme.onSurface', async () => {
  const f = await s.fixture('android', 'combo');
  for (const [mode, color] of [['light', '#00000061'], ['dark', '#FFFFFF61']]) {
    f.mode(mode); const tree = f.render(); assert.ok(s.rows(tree).every(row => row.props.colors.disabledContentColor === color));
    assert.ok(s.nodes(tree, node => node.type === 'SymbolView').every(node => node.props.tintColor === color));
  }
});

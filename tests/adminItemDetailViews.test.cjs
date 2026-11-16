const assert = require('node:assert/strict'), test = require('node:test');
const v = require('./adminItemDetailViewsSupport.cjs');
const { s, combos, presentation: p, nodes, byID, text } = v;
const a = key => key, idle = { saving: false, changingGroup: false, deleting: false };
function click(node) { const action = node?.props.onClick ?? node?.props.onPress; assert.equal(typeof action, 'function'); action(); }

test('source ordinary/finished/combo projections preserve branch precedence, title/raw text, field order and empty defaults', () => {
  const ordinary = p.adminItemDetailReadPresentation(s.detail({ name: ' Raw name ', code: ' Raw code ', item_group: ' Kraska ', uom: '' }), idle, a);
  assert.equal(ordinary.kind, 'ordinary'); assert.equal(ordinary.title, ' Raw name '); assert.deepEqual(ordinary.ordinaryRows, [{ label: 'detail.item_name', value: 'Raw name' }, { label: 'detail.item_code', value: 'Raw code' }, { label: 'item.group', value: 'Kraska' }]); assert.equal(ordinary.uom.value, 'profile.entered');
  const finished = p.adminItemDetailReadPresentation(s.detail({ is_finished_goods: true, name: ' Code ', code: 'Code', item_group: ' TAYYOR MAHSULOT ' }), idle, a);
  assert.equal(finished.showCode, false); assert.equal(finished.finishedGroup, null); assert.equal(finished.badge, 'detail.finished_product'); assert.equal(finished.unassigned, 'detail.unassigned');
  const combo = p.adminItemDetailReadPresentation(s.detail({ item_group: ' KoMbO ', is_finished_goods: true, name: 'Name' }), idle, a); assert.equal(combo.kind, 'combo'); assert.equal(combo.badge, 'calculate.combo'); assert.equal(combo.actionsEnabled, true);
});
test('source mutation labels/enables, date fallbacks and raw customer subtitle values remain distinct', () => {
  for (const busy of ['saving', 'changingGroup', 'deleting']) {
    const result = p.adminItemDetailReadPresentation(s.detail(), { ...idle, [busy]: true }, a); assert.equal(result.editEnabled, false); assert.equal(result.groupEnabled, false); assert.equal(result.deleteEnabled, false);
  }
  assert.equal(p.adminItemDetailReadPresentation(s.detail(), { ...idle, saving: true }, a).editLabel, 'action.saving');
  const result = p.adminItemDetailReadPresentation(s.detail({ customers: [{ ref: ' C ', name: '', phone: ' P ' }, { ref: ' ', name: 'Second', phone: ' ' }] }), idle, a);
  assert.deepEqual(result.dates.map(row => row.value), ['detail.date_missing', 'detail.not_changed']); assert.equal(result.customerLabel, 'detail.customers'); assert.deepEqual(result.customers, [{ name: '', subtitle: ' C  •  P ' }, { name: 'Second', subtitle: '' }]);
  assert.equal(p.adminItemDetailReadPresentation(s.detail({ is_finished_goods: true, item_group: ' Finishing ' }), idle, a).finishedGroup.value, 'Finishing');
});
test('authenticated image bytes become native data URIs without changing bytes or accepting an empty image', () => {
  for (const length of [1, 2, 3, 32769]) { const bytes = Uint8Array.from({ length }, (_, index) => index % 256), uri = p.adminItemDetailImageDataUri(bytes); assert.deepEqual(Buffer.from(uri.split(',')[1], 'base64'), Buffer.from(bytes)); }
  assert.match(p.adminItemDetailImageDataUri(new Uint8Array([0x89, 0x50, 1])), /^data:image\/png/); assert.throws(() => p.adminItemDetailImageDataUri(new Uint8Array()), /empty/);
});
test('real decision owner issues exactly one initial include-image GET, keeps init-only route code and has no mutation without native decision completion', async () => {
  const f = v.fixture('android'); let model = f.renderOwner(); await s.flush(); model = f.renderOwner(); assert.deepEqual(f.calls, [['read', 'Route code', { includeImage: true }]]);
  f.props({ itemCode: 'replacement prop' }); model = f.renderOwner(); model.dispatch('edit'); assert.equal(model.controller.getSnapshot().dialogs.at(-1).detail, model.state.detail); assert.equal(f.calls.length, 1);
  f.cleanup(); await s.flush();
});
test('real owner StrictMode reconnect keeps original controller/read and original native callbacks reject hidden, retired and replaced details', async () => {
  const f = v.fixture('android'); f.renderOwner(); await s.flush(); const old = f.renderOwner(); f.replay(); await s.flush(); let model = f.renderOwner(); assert.equal(model.controller, old.controller); assert.equal(f.calls.filter(value => value[0] === 'read').length, 1);
  f.interactive(false); old.dispatch('edit'); assert.equal(model.controller.getSnapshot().dialogs.length, 0); f.interactive(true); old.dispatch('edit'); assert.equal(model.controller.getSnapshot().dialogs.length, 1);
  const id = model.controller.getSnapshot().dialogs[0].id, close = model.controller.prepareClose(id, false); await model.controller.completeClose(close); f.detail(s.detail({ name: 'Replacement' })); await model.controller.reload(); await s.flush(); model = f.renderOwner(); old.dispatch('delete'); assert.equal(model.controller.getSnapshot().dialogs.length, 0);
  f.current(false); f.notify(); model = f.renderOwner(); old.dispatch('edit'); old.back(); assert.equal(f.calls.some(value => value[0] === 'back'), false); f.cleanup(); await s.flush();
});
test('original read may finish through parent blur; back returns actual changed flag and retries use the acknowledged renamed code', async () => {
  const pending = s.deferred(), f = v.fixture('android', { read: () => pending.promise }); f.renderOwner(); f.interactive(false); pending.resolve(s.detail()); await s.flush(); let model = f.renderOwner(); assert.equal(model.state.phase, 'content'); assert.equal(model.canInteract(), false);
  f.interactive(true); model = f.renderOwner(); model.dispatch('edit'); const id = model.controller.getSnapshot().dialogs[0].id; model.controller.changeEdit(id, 'code', 'Renamed'); model.controller.changeEdit(id, 'name', 'Changed'); const ticket = model.controller.prepareClose(id, true); await model.controller.completeClose(ticket); model = f.renderOwner(); model.back(); assert.deepEqual(f.calls.find(value => value[0] === 'back'), ['back', true]); model.retry(); await s.flush(); assert.equal(f.calls.filter(value => value[0] === 'read').at(-1)[1], 'Renamed'); f.cleanup(); await s.flush();
});
for (const platform of ['android', 'ios']) test(`${platform} native ordinary body matches Source section/order and only opens real original controller decisions`, async () => {
  const f = v.fixture(platform); let tree = f.renderRead(); assert.match(text(tree), /detail.item_title|/); await s.flush(); tree = f.renderRead();
  assert.ok(byID(tree, 'admin-item-detail-edit')); assert.ok(byID(tree, 'admin-item-detail-change-group')); assert.ok(byID(tree, 'admin-item-detail-delete')); assert.equal(byID(tree, 'admin-finished-item-actions'), undefined);
  const body = nodes(tree, node => node.type === 'ScrollView')[0]; assert.deepEqual(body.props.contentContainerStyle, { paddingLeft: 8, paddingTop: 8, paddingRight: 8, paddingBottom: 120 });
  const words = text(body); assert.ok(words.indexOf('detail.main_info') < words.indexOf('detail.system_info')); assert.ok(words.indexOf('detail.system_info') < words.lastIndexOf('detail.item_delete_title')); assert.doesNotMatch(words, /detail\.manage_customers/);
  click(byID(tree, 'admin-item-detail-edit')); assert.equal(f.model().controller.getSnapshot().dialogs[0].kind, 'edit'); assert.equal(f.calls.filter(value => value[0] === 'rename').length, 0);
  f.cleanup(); await s.flush();
});
for (const platform of ['android', 'ios']) test(`${platform} native finished branch retains only header actions, badge and one Source information card`, async () => {
  const f = v.fixture(platform, { detail: s.detail({ is_finished_goods: true, item_group: 'tayyor mahsulot', name: 'Code', customers: [{ ref: 'C', name: 'Customer', phone: '+123' }] }) }); f.renderRead(); await s.flush(); const tree = f.renderRead();
  assert.equal(byID(tree, 'admin-item-detail-edit'), undefined); assert.equal(byID(tree, 'admin-item-detail-delete'), undefined); assert.equal(byID(tree, 'admin-item-detail-change-group'), undefined); assert.ok(byID(tree, 'admin-finished-item-image')); assert.ok(byID(tree, 'admin-finished-item-actions'));
  assert.match(text(tree), /detail\.finished_product/); assert.doesNotMatch(text(tree), /item\.group|detail\.system_info/); assert.match(text(tree), /Customer.*C • \+123/);
  click(byID(tree, 'admin-finished-item-actions')); const action = f.calls.find(value => value[0] === 'actions'); assert.equal(action[2].is_finished_goods, true); assert.equal(action[3], 'finished'); assert.equal(action[1].controller, f.model().controller); f.cleanup(); await s.flush();
});
for (const platform of ['android', 'ios']) test(`${platform} native combo loads actual catalog and mounted row names; exposes real readonly actions and source loading/error/empty states`, async () => {
  const pending = s.deferred(), entry = combos.entry(), product = combos.product('SKU', ''), known = combos.product('K', 'Known'); entry.template = { ...entry.template, products: [product, known] };
  const f = v.fixture(platform, { detail: s.detail({ item_group: 'Kombo' }), comboRead: () => pending.promise }); f.renderRead(); await s.flush(); let tree = f.renderRead(); assert.ok(byID(tree, 'admin-combo-item-actions')); assert.equal(f.calls.filter(value => value[0] === 'combo').length, 1); assert.equal(f.calls.filter(value => value[0] === 'product').length, 0);
  pending.resolve(entry); await s.flush(); tree = f.renderRead(); await s.flush(); tree = f.renderRead(); assert.deepEqual(f.calls.filter(value => value[0] === 'product'), [['product', 'SKU']]); assert.match(text(tree), /Resolved product.*12\.25 mm × 3/); assert.match(text(tree), /Known/); assert.doesNotMatch(text(tree), /detail\.system_info|detail\.edit_name_code/);
  click(byID(tree, 'admin-combo-item-actions')); assert.equal(f.calls.find(value => value[0] === 'actions')[3], 'combo'); f.cleanup(); await s.flush();
});
test('required genuine providers/header/dock are checked before any read; no source-ready or current defaults exist', () => {
  for (const platform of ['android', 'ios']) { const f = v.fixture(platform); for (const bad of [{ canInteract: undefined }, { isCurrent: undefined }, { presentations: undefined }, { footer: null }, { pageIdentity: null }, ...(platform === 'ios' ? [{ renderNativeHeader: undefined }] : [])]) assert.throws(() => f.read({ ...f.propsValue(), ...bad }), TypeError); assert.deepEqual(f.calls, []); }
});
test('Source loading/error/header/footer read composition keeps no Profile and actual iOS header adapter', async () => {
  for (const platform of ['android', 'ios']) { const f = v.fixture(platform, { read: () => Promise.reject(Error('controlled')) }); let tree = f.renderRead(); if (platform === 'android') assert.ok(nodes(tree, node => node.type === 'AdminLoadingIndicator').length); await s.flush(); tree = f.renderRead(); assert.match(text(tree), /detail\.item_load_failed.*retry/); assert.equal(nodes(tree, node => node.type === 'RealDock').length, 1); assert.equal(nodes(tree, node => node.type === 'BodyFrame')[0].props.hasFooter, true); assert.equal(nodes(tree, node => node.type === 'ProfileAction').length, 0); if (platform === 'ios') { assert.equal(nodes(tree, node => node.type === 'RealNativeHeaderFixture').length, 1); assert.equal(nodes(tree, node => node.type === 'Stack.Screen').length, 0); } f.cleanup(); await s.flush(); }
});
test('combo waiting retains only its actual previous image; unavailable/error clears it and never invents a catalog', async () => {
  const f = v.fixture('android'), ReadSnapshot = f.moduleFor('AdminItemDetailComboRead.ts').AdminItemDetailComboReadSnapshot;
  let state = Object.freeze({ phase: 'loading', entry: null }), listener; const actual = combos.entry();
  const projection = new ReadSnapshot({ getSnapshot: () => state, subscribe: value => { listener = value; return () => {}; } }); projection.subscribe(() => {});
  state = Object.freeze({ phase: 'content', entry: actual }); listener(); assert.equal(projection.getSnapshot().imageEntry, actual);
  state = Object.freeze({ phase: 'loading', entry: null }); listener(); assert.equal(projection.getSnapshot().imageEntry, actual); assert.equal(projection.getSnapshot().entry, null);
  state = Object.freeze({ phase: 'error', entry: null }); listener(); assert.equal(projection.getSnapshot().imageEntry, null); state = Object.freeze({ phase: 'loading', entry: null }); listener(); assert.equal(projection.getSnapshot().imageEntry, null); f.cleanup(); await s.flush();
});
for (const phase of ['unavailable', 'error', 'empty']) test(`native combo ${phase} uses Source exact control/text and no unauthorized row-name read`, async () => {
  const entry = combos.entry(); entry.template = { ...entry.template, products: [] }; const f = v.fixture('android', { detail: s.detail({ item_group: 'Kombo' }), comboAllowed: phase !== 'unavailable', comboRead: () => phase === 'error' ? Promise.reject(Error('controlled')) : Promise.resolve(entry) });
  f.renderRead(); await s.flush(); let tree = f.renderRead(); await s.flush(); tree = f.renderRead(); assert.equal(f.calls.some(value => value[0] === 'product'), false);
  if (phase === 'empty') assert.match(text(tree), /calculate\.combo_products_empty/); else { assert.match(text(tree), /calculate\.combo_load_failed/); const button = nodes(tree, node => node.type === 'TextButton').find(node => text(node).includes('calculate.combo_load_failed')); assert.equal(button.props.enabled, phase !== 'unavailable'); if (phase === 'unavailable') assert.equal(f.calls.some(value => value[0] === 'combo'), false); }
  f.cleanup(); await s.flush();
});
test('Android Source controls retain56 minimum height/r20, source header24w800/60+3 and card geometry', async () => {
  const f = v.fixture('android'); f.renderRead(); await s.flush(); const tree = f.renderRead();
  for (const id of ['admin-item-detail-edit', 'admin-item-detail-change-group', 'admin-item-detail-delete']) { const button = byID(tree, id); assert.ok(button.props.modifiers.some(modifier => modifier.type === 'defaultMinSize' && modifier.args[0].minHeight === 56)); assert.deepEqual(button.props.shape.value.cornerRadii, { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 }); }
  const top = nodes(tree, node => node.type === 'TopAppBar')[0]; assert.ok(top.props.modifiers.some(value => value.type === 'height' && value.args[0] === 60)); assert.ok(nodes(tree, node => node.type === 'Text' && node.props.style?.fontSize === 24 && node.props.style?.fontWeight === '800').length); assert.ok(nodes(tree, node => node.type === 'Column' && node.props.modifiers?.some(value => value.type === 'padding' && JSON.stringify(value.args) === '[18,18,18,18]')).length); f.cleanup(); await s.flush();
});
test('original scope/epoch invalidation and replaced interaction guard reject queued body/header events and old pending reads', async () => {
  const pending = s.deferred(), f = v.fixture('android', { read: () => pending.promise }); f.renderOwner(); f.scope('new-permission-scope'); f.notify(); pending.resolve(s.detail()); await s.flush(); let model = f.renderOwner(); assert.equal(model.state.phase, 'invalidated'); model.dispatch('edit'); assert.equal(model.controller.getSnapshot().dialogs.length, 0); f.cleanup(); await s.flush();
  const next = v.fixture('android'); next.renderOwner(); await s.flush(); const original = next.renderOwner(); next.props({ canInteract: () => true }); model = next.renderOwner(); original.dispatch('delete'); assert.equal(model.controller.getSnapshot().dialogs.length, 0); model.dispatch('edit'); assert.equal(model.controller.getSnapshot().dialogs.length, 1); next.cleanup(); assert.equal(model.current(), false); original.back(); await s.flush(); assert.equal(next.calls.some(value => value[0] === 'back'), false);
});
test('a retained genuine page identity never adopts replacement original authority/session and a new identity owns a new reader', async () => {
  const f = v.fixture('android'); f.renderOwner(); await s.flush(); const original = f.renderOwner(); f.props({ isCurrent: () => true }); const retired = f.renderOwner(); assert.equal(retired.controller, original.controller); assert.equal(retired.state.phase, 'invalidated'); assert.equal(retired.current(), false); assert.equal(f.calls.filter(value => value[0] === 'read').length, 1);
  f.props({ pageIdentity: {} }); f.renderOwner(); await s.flush(); const fresh = f.renderOwner(); assert.notEqual(fresh.controller, original.controller); assert.equal(fresh.state.phase, 'content'); assert.equal(f.calls.filter(value => value[0] === 'read').length, 2); original.dispatch('delete'); assert.equal(fresh.controller.getSnapshot().dialogs.length, 0); f.cleanup(); await s.flush();
});
test('replaced genuine presentation/back providers retire queued native callbacks without resetting the source reader', async () => {
  const f = v.fixture('ios', { detail: s.detail({ is_finished_goods: true }) }); f.renderOwner(); await s.flush(); const old = f.renderOwner(); let actions = 0, backs = 0;
  f.props({ presentations: { render: () => ({ type: 'NewRealPresenter', props: {} }), onActions: () => { actions++; } }, onBack: () => { backs++; } }); const fresh = f.renderOwner(); old.dispatch('actions'); old.back(); assert.equal(actions, 0); assert.equal(backs, 0); fresh.dispatch('actions'); fresh.back(); assert.equal(actions, 1); assert.equal(backs, 1); assert.equal(f.calls.filter(value => value[0] === 'read').length, 1); f.cleanup(); await s.flush();
});
test('rejected async current/interaction callbacks fail closed without issuing a read or a queued action', async () => {
  const f = v.fixture('android'); f.props({ isCurrent: () => Promise.reject(Error('invalid original current')) }); let model = f.renderOwner(); await s.flush(); model = f.renderOwner(); assert.equal(model.current(), false); assert.deepEqual(f.calls, []); f.cleanup(); await s.flush();
  const other = v.fixture('android'); other.renderOwner(); await s.flush(); other.props({ canInteract: () => Promise.reject(Error('invalid top predicate')) }); model = other.renderOwner(); model.dispatch('delete'); model.back(); await s.flush(); assert.equal(model.controller.getSnapshot().dialogs.length, 0); assert.equal(other.calls.some(value => value[0] === 'back'), false); other.cleanup(); await s.flush();
});
for (const platform of ['android', 'ios']) test(`${platform} actual combo/name owners retain their original pending read through StrictMode and parent blur`, async () => {
  const pending = s.deferred(), f = v.fixture(platform, { detail: s.detail({ item_group: 'Kombo' }), productRead: () => pending.promise }); f.renderRead(); await s.flush(); f.renderRead(); await s.flush(); f.renderRead(); assert.equal(f.calls.filter(value => value[0] === 'product').length, 1);
  f.replay(); f.interactive(false); pending.resolve('Original resolved name'); await s.flush(); let tree = f.renderRead(); assert.match(text(tree), /Original resolved name/); assert.equal(f.calls.filter(value => value[0] === 'combo').length, 1); assert.equal(f.calls.filter(value => value[0] === 'product').length, 1);
  click(byID(tree, 'admin-combo-item-actions')); assert.equal(f.calls.some(value => value[0] === 'actions'), false); f.interactive(true); tree = f.renderRead(); click(byID(tree, 'admin-combo-item-actions')); assert.equal(f.calls.find(value => value[0] === 'actions')[3], 'combo'); f.cleanup(); await s.flush();
});
test('acknowledged deletion retains the real presenter/header/dock until genuine parent navigation; leaf fabricates no return', async () => {
  const f = v.fixture('android'); f.renderRead(); await s.flush(); let tree = f.renderRead(); click(byID(tree, 'admin-item-detail-delete')); const context = f.model(), dialog = context.controller.getSnapshot().dialogs[0], ticket = context.controller.prepareClose(dialog.id, true);
  const result = await context.controller.completeClose(ticket); assert.equal(result.removed, true); tree = f.renderRead(); assert.equal(nodes(tree, node => node.type === 'ActualPresenterFixture').length, 1); assert.equal(nodes(tree, node => node.type === 'RealDock').length, 1); assert.ok(nodes(tree, node => node.type === 'TopAppBar').length); assert.equal(f.calls.some(value => value[0] === 'back'), false); assert.equal(context.isCurrent(), true); f.cleanup(); await s.flush();
});
for (const [platform, facts, reserve] of [
  ['android', { metrics: { platform: 'android', width: 390, height: 844, viewPaddingBottom: 24, systemGestureInsetsBottom: 32, viewInsetsBottom: 0 }, thinGestureBottom: false }, 92],
  ['android', { metrics: { platform: 'android', width: 390, height: 844, viewPaddingBottom: 24, systemGestureInsetsBottom: 32, viewInsetsBottom: 0 }, thinGestureBottom: true }, 75],
  ['ios', { metrics: { platform: 'ios', width: 390, height: 844, viewPaddingBottom: 34, systemGestureInsetsBottom: 34, viewInsetsBottom: 0 }, thinGestureBottom: false }, 75],
  ['android', { metrics: { platform: 'android', width: 390, height: 844, viewPaddingBottom: 24, systemGestureInsetsBottom: 32, viewInsetsBottom: 300 }, thinGestureBottom: false }, 0],
]) test(`${platform} real footer frame reserve${reserve} never adds raw body bottom SafeArea a second time`, async () => {
  const f = v.fixture(platform, { frameFacts: () => facts }); f.renderRead(); await s.flush(); const tree = f.renderRead(), flatten = require('./adminShellFrameViewSupport.cjs').flattenStyle;
  const outer = byID(tree, 'admin-item-detail-body-frame-reserve'), frame = byID(tree, 'admin-item-detail-body-frame'); assert.equal(flatten(outer.props.style).marginBottom, reserve); assert.equal(flatten(outer.props.style).marginHorizontal, 6); assert.equal(flatten(frame.props.style).borderBottomLeftRadius, 18);
  assert.equal(nodes(frame.props.children, node => node.type === 'SafeAreaView' && (!node.props.edges || node.props.edges.includes('bottom'))).length, 0);
  const list = nodes(frame, node => node.type === 'ScrollView')[0]; assert.equal(list.props.contentContainerStyle.paddingBottom, 120); f.cleanup(); await s.flush();
});
test('actual unknown native frame metrics keep original readers mounted hidden without inventing a zero or successful geometry', async () => {
  const f = v.fixture('android', { frameFacts: () => ({ metrics: null, thinGestureBottom: false }) }); f.renderRead(); await s.flush(); const tree = f.renderRead(), flatten = require('./adminShellFrameViewSupport.cjs').flattenStyle;
  const outer = byID(tree, 'admin-item-detail-body-frame-reserve'), frame = byID(tree, 'admin-item-detail-body-frame'); assert.equal(flatten(outer.props.style).marginBottom, undefined); assert.equal(frame.props.pointerEvents, 'none'); assert.equal(flatten(frame.props.style).opacity, 0); assert.equal(f.calls.filter(value => value[0] === 'read').length, 1); assert.ok(byID(tree, 'admin-item-detail-edit')); f.cleanup(); await s.flush();
});
test('Android Source logical end alignment follows actual RTL BaseHost for values and customer name/subtitle', async () => {
  const f = v.fixture('android', { actualBaseHost: true, direction: 'rtl', detail: s.detail({ is_finished_goods: true, customers: [{ ref: 'C', name: 'Customer', phone: '+123' }] }) }); f.renderRead(); await s.flush(); const tree = f.renderRead();
  assert.ok(nodes(tree, node => node.type === 'Host').every(node => node.props.layoutDirection === 'rtl')); assert.equal(nodes(tree, node => node.type === 'Text' && node.props.style?.textAlign === 'right').length, 0);
  for (const value of ['Customer', 'C • +123', 'detail.date_missing', 'detail.not_changed']) { const native = nodes(tree, node => node.type === 'Text' && text(node) === value)[0]; assert.equal(native.props.style.textAlign, 'end'); }
  f.cleanup(); await s.flush();
});

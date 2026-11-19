const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateNativeSupport.cjs');
const androidTailPadding = tree => s.nativeId(tree, 'admin-items-list-tail').props.style.at(-1).paddingBottom;
for (const platform of ['android', 'ios']) {
  test(`${platform} catalog retains duplicate raw items/selection, source first-page retry word and original callbacks`, () => {
    const row = s.item(' RAW ', { name: ' Raw Name ', uom: ' kg ', item_group: ' G ' }), fixture = s.catalogModel({ items: [row, row], selectedCodes: [' RAW '], group: ' G ', error: Error('next page'), groupExpanded: true }), f = s.leaf('List', platform, fixture), tree = f.render();
    assert.equal(s.nodes(tree, node => node.type === 'Text' && node.props.children === ' Raw Name ').length, 2); assert.equal(s.nodes(tree, node => node.type === 'Text' && node.props.children === 'RAW • kg • G').length, 2);
    const retry = s.nativeId(tree, 'admin-item-list-load-more'); retry.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.equal(f.calls.at(-1), 'reload');
    const clear = s.nativeId(tree, 'admin-items-clear-selection'); clear.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.equal(f.calls.at(-1), 'clear');
    const toggle = s.nativeId(tree, 'admin-item-select- RAW '); toggle.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls.at(-1), ['toggle', row]);
  });
  test(`${platform} missing actual Scaffold metrics holds retained catalog body and never substitutes a zero tail`, () => {
    const f = s.leaf('List', platform, s.catalogModel({ items: [s.item('A')] }), { bottomPadding: null }), tree = f.render(), body = s.nativeId(tree, 'admin-item-create-list-layout');
    assert.equal(body.props.pointerEvents, 'none'); assert.equal(body.props.accessibilityState.busy, true); assert.ok(s.text(tree).includes('Name A'));
    if (platform === 'android') assert.equal(androidTailPadding(tree), undefined);
  });
  test(`${platform} genuine customer picker keeps .66 native sheet/search58, visible plus on blank query, and Source no scan/AI controls`, () => {
    const f = s.leaf('Picker', platform, s.pickerModel()), tree = f.render(); assert.ok(s.nativeId(tree, 'admin-item-create-picker-add')); assert.equal(s.nativeId(tree, 'admin-item-create-picker-empty-add'), undefined);
    assert.ok(s.nativeId(tree, 'admin-item-create-picker-search')); assert.equal(s.nativeId(tree, 'admin-item-create-picker-scan'), undefined);
    assert.ok(s.nodes(tree, node => node.type === 'View' && node.props.style?.maxHeight === 594).length);
    s.nativeId(tree, 'admin-item-create-picker-add').props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls, [['createCustomer', true]]);
  });
  test(`${platform} picker no-record/customer-add/error states preserve exact Source branches without busy field locks`, () => {
    const empty = s.leaf('Picker', platform, s.pickerModel('customer', { query: ' Query ', searchDraft: ' Query ' })), tree = empty.render(); assert.ok(s.nativeId(tree, 'admin-item-create-picker-empty-add')); assert.equal(s.text(tree).includes(empty.model.t('noRecordsYet')), false);
    const error = s.leaf('Picker', platform, s.pickerModel('group', { error: Error('network') })), errorTree = error.render(); assert.ok(s.text(errorTree).includes(error.model.t('serverDisconnectedRetry'))); assert.ok(s.nativeId(errorTree, 'admin-item-create-picker-retry')); assert.equal(s.nativeId(errorTree, 'admin-item-create-picker-add'), undefined);
    const blank = s.leaf('Picker', platform, s.pickerModel('customer', { query: '\u0085' })), blankTree = blank.render(); assert.equal(s.nativeId(blankTree, 'admin-item-create-picker-empty-add'), undefined); assert.ok(s.text(blankTree).includes(blank.model.t('noRecordsYet')));
  });
  test(`${platform} picker trims only subtitle layout, preserving raw name and canonical returned DTO identity`, () => {
    const customer = { ref: ' Ref ', name: ' Raw Name ', phone: ' Phone ' }, f = s.leaf('Picker', platform, s.pickerModel('customer', {}, [customer, customer])), tree = f.render();
    assert.equal(s.text(tree).filter(value => value === ' Raw Name ').length, 2); assert.ok(s.text(tree).includes('Ref  •  Phone'));
    s.nativeId(tree, 'admin-item-create-picker-option-1').props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls, [['customer', customer]]);
  });
}
test('Android catalog source exact420 extent dispatch and scroll reset do not jump on ordinary selection renders', () => {
  const f = s.leaf('List', 'android', s.catalogModel({ items: [s.item('A')] })), tree = f.render(), flat = s.nodes(tree, node => node.type === 'FlatList')[0];
  assert.equal(androidTailPadding(tree), 439); assert.equal(flat.props.scrollEventThrottle, 16);
  assert.deepEqual(flat.props.refreshControl.props.colors, ['transparent']); assert.equal(flat.props.refreshControl.props.refreshing, false);
  assert.equal(flat.props.keyExtractor(f.model.state.list.items[0], 0), 'row:0:A');
  assert.ok(s.nodes(tree, node => node.type === 'WorkerQueueCard').length === 1);
  flat.props.onScroll.onScroll({ contentSize: { height: 1000 }, contentOffset: { y: 80 }, layoutMeasurement: { height: 500 } }, {}); assert.deepEqual(f.calls, [['scroll', 420]]);
  assert.equal(f.scrolls.length, 1); f.model.state.list = { ...f.model.state.list, selectedCodes: ['A'] }; f.render(); assert.equal(f.scrolls.length, 1);
  f.model.state.list = { ...f.model.state.list, scrollReset: 1 }; f.render(); assert.equal(f.scrolls.length, 2);
});
test('Android hide/cancellation resolution alone cannot acknowledge; armACK, Reactremoval and genuine original rootdetach are all required', async () => {
  const hide = s.deferred(), arm = s.deferred(), detached = s.deferred(), native = []; let receipt;
  const observer = { arm: (viewTag, ticket) => { receipt = { protocol: 1, guarantee: 'window-tree-detach', viewTag, ticket, handle: 'original-window', state: 'armed' }; native.push('arm'); return arm.promise; }, waitForDetach: value => { assert.equal(value, receipt); native.push('wait'); return detached.promise; }, cancelPending: async () => true, cancel: async () => true };
  const fixture = s.pickerModel('group', { closing: true }), f = s.leaf('Picker', 'android', fixture, { hide, observer }); let tree = f.render(); assert.deepEqual(f.calls, ['hide']);
  const marker = s.nodes(tree, node => node.type === 'View' && node.props.nativeID)[0]; assert.equal(marker.props.collapsable, false); marker.props.onLayout(); assert.deepEqual(native, ['arm']);
  hide.resolve(); await s.flush(); tree = f.render(); assert.deepEqual(f.calls, ['hide']); assert.equal(s.nodes(tree, node => node.type === 'ModalBottomSheet').length, 1);
  arm.resolve(receipt); await s.flush(); tree = f.render(); assert.deepEqual(native, ['arm', 'wait']); assert.equal(s.nodes(tree, node => node.type === 'ModalBottomSheet').length, 0); assert.deepEqual(f.calls, ['hide']);
  detached.resolve({ ...receipt, state: 'detached' }); await s.flush(); assert.deepEqual(f.calls, ['hide', 'complete']);
  const unavailable = s.leaf('Picker', 'android', s.pickerModel('group', { closing: true }), { noSheetRef: true }); unavailable.render(); await s.flush(); assert.deepEqual(unavailable.calls, []);
});
test('Android picker requires its actual observer before presenting any controls, with no unavailable-module completion fallback', () => {
  const f = s.leaf('Picker', 'android', s.pickerModel(), { observer: null }); assert.throws(() => f.render(), /original observer/); assert.deepEqual(f.calls, []);
});
test('iOS original native sheet onDismiss supplies completion; isPresented false request alone never acknowledges', () => {
  const f = s.leaf('Picker', 'ios', s.pickerModel()), tree = f.render(), sheet = s.nodes(tree, node => node.type === 'BottomSheet')[0]; sheet.props.onIsPresentedChange(false); assert.deepEqual(f.calls, ['dismiss']); sheet.props.onDismiss(); assert.deepEqual(f.calls, ['dismiss', 'complete']);
});
test('actual shared Scaffold inherited-bottom proof reaches native list tail for raw IME boundary and unknown genuine host', () => {
  const policy = s.load('admin/adminSupplierScaffoldLayout'), layout = s.load('admin/adminItemCreateNativeLayout', { './adminSupplierScaffoldLayout': policy });
  for (const [metrics, hostHeight, expected] of [[{ viewInsetsBottom: 0 }, 199, 439], [{ viewInsetsBottom: 199 }, 199, 439], [{ viewInsetsBottom: 200 }, 199, 240], [null, 199, null], [{ viewInsetsBottom: 0 }, null, null]]) {
    const bottomPadding = layout.adminItemCreateListBottom({ metrics, hostHeight }); assert.equal(bottomPadding, expected);
    const f = s.leaf('List', 'android', s.catalogModel({ items: [s.item('A')] }), { bottomPadding }), tree = f.render();
    assert.equal(s.nativeId(tree, 'admin-item-create-list-layout').props.accessibilityState.busy, expected === null);
    assert.equal(androidTailPadding(tree), expected ?? undefined);
  }
});
test('iOS native row selection and row-open are genuine sibling hit areas; no Button contains another Button', () => {
  const item = s.item('A'), f = s.leaf('List', 'ios', s.catalogModel({ items: [item] })), tree = f.render(), row = s.nativeId(tree, 'admin-item-row-0');
  const buttons = s.nodes(row, node => node.type === 'Button'); assert.equal(buttons.length, 2);
  for (const button of buttons) assert.equal(s.nodes(button.props.children, node => node.type === 'Button').length, 0);
  s.nativeId(row, 'admin-item-select-A').props.onPress(); s.nativeId(row, 'admin-item-open-0').props.onPress(); assert.deepEqual(f.calls, [['toggle', item], ['open', item]]);
  assert.ok(buttons.every(button => button.props.modifiers.some(value => value.name === 'onLongPressGesture')));
});
test('iOS passive rows have no noop Buttons; selection-only rows keep passive text and genuine selection/longpress', () => {
  for (const [canSelect, canOpen, count] of [[false, false, 0], [false, true, 1], [true, false, 1]]) {
    const fixture = s.catalogModel({ items: [s.item('A')] }); fixture.model.owner.canSelect = canSelect; fixture.model.owner.needsItemDetail = canOpen;
    const f = s.leaf('List', 'ios', fixture), row = s.nativeId(f.render(), 'admin-item-row-0'), buttons = s.nodes(row, node => node.type === 'Button');
    assert.equal(buttons.length, count); assert.ok(buttons.every(button => typeof button.props.onPress === 'function')); assert.ok(s.text(row).includes('Name A'));
    for (const button of buttons) assert.equal(s.nodes(button.props.children, node => node.type === 'Button').length, 0);
    if (canSelect) assert.ok(s.nodes(row, node => node.props.modifiers?.some(value => value.name === 'onLongPressGesture')).length >= 2);
  }
});
test('iOS17 UIKit exact scroll extent fallback retains genuine SwiftUI row controls, never auto-loads on appearance, and preserves tail/reset', () => {
  const row = s.item('A'), f = s.leaf('List', 'ios', s.catalogModel({ items: [row], hasMore: true }), { version: '17.5', bottomPadding: 439 }); let tree = f.render();
  const flat = s.nodes(tree, node => node.type === 'FlatList')[0]; assert.ok(flat); assert.equal(s.nodes(tree, node => node.type === 'List').length, 0); assert.deepEqual(f.calls, []);
  assert.equal(s.nodes(tree, node => node.props.modifiers?.some(value => value.name === 'onAppear')).length, 0); assert.equal(flat.props.contentContainerStyle.paddingBottom, 439); assert.equal(f.scrolls.length, 1);
  const send = extent => flat.props.onScroll({ nativeEvent: { contentSize: { height: 1000 }, contentOffset: { y: 500 - extent }, layoutMeasurement: { height: 500 } } }); send(421); send(420); assert.deepEqual(f.calls, [['scroll', 421], ['scroll', 420]]);
  s.nativeId(tree, 'admin-item-select-A').props.onPress(); assert.deepEqual(f.calls.at(-1), ['toggle', row]);
  f.model.state.list = { ...f.model.state.list, selectedCodes: ['A'] }; tree = f.render(); assert.equal(f.scrolls.length, 1); f.model.state.list = { ...f.model.state.list, scrollReset: 1 }; f.render(); assert.equal(f.scrolls.length, 2);
});
test('iOS18+ native List uses actual geometry420; neither modern nor legacy route installs appearance pagination', () => {
  const f = s.leaf('List', 'ios', s.catalogModel({ items: [s.item('A')], hasMore: true }), { version: '18.0' }), tree = f.render(), list = s.nodes(tree, node => node.type === 'List')[0];
  assert.ok(list); assert.equal(s.nodes(tree, node => node.type === 'FlatList').length, 0); assert.deepEqual(f.calls, []);
  const geometry = list.props.modifiers.find(value => value.name === 'scrollGeometry'); geometry.args[0]({ contentHeight: 1000, contentOffsetY: 80, containerHeight: 500 }); assert.deepEqual(f.calls, [['scroll', 420]]);
  assert.equal(s.nodes(tree, node => node.props.modifiers?.some(value => value.name === 'onAppear')).length, 0);
});

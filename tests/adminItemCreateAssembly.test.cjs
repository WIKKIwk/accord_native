/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const s = require('./adminItemCreateAssemblySupport.cjs');
for (const platform of ['android', 'ios']) {
  test(`${platform} primary registers exactly Sourcecustomadd, stable during ordinary renders, accepted root action survives page blur`, async () => {
    const f = s.view('PrimaryAction', platform); f.render(); const first = f.root.at(-1); assert.equal(first.actions.length, 1); assert.equal(first.actions[0].label, f.model.a('item.add_title')); assert.equal(first.replacement, undefined);
    f.model.state.list = { ...f.model.state.list, searchDraft: 'typed' }; f.render(); const next = f.root.at(-1); assert.equal(next.actions, first.actions); assert.equal(next.canInteract, first.canInteract);
    f.focus(false); assert.equal(first.canInteract(), false); await first.actions[0].onPress(); assert.deepEqual(f.calls, ['dialog']); f.valid(false); await first.actions[0].onPress(); assert.deepEqual(f.calls, ['dialog']);
  });
  test(`${platform} selected move replacement is genuine native80 button, exact count words, submission spinner and moving disable`, () => {
    const f = s.view('PrimaryAction', platform); f.model.state.list = { ...f.model.state.list, selectedCodes: ['A', 'B'], moving: true, submittingMove: true }; const tree = f.render(), primary = f.root.at(-1), replacement = s.expand(primary.replacement);
    assert.ok(primary.replacement); const button = s.nativeId(replacement, 'admin-items-move-fab'); assert.ok(button);
    assert.ok(s.text(replacement).includes(`${f.model.a('bulk_move.action')} (2)`));
    assert.equal(platform === 'android' ? button.props.enabled === false : button.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true), true);
    assert.ok(s.nodes(replacement, node => node.props.modifiers?.some(value => value.name === (platform === 'android' ? 'height' : 'frame') && (platform === 'android' ? value.args[0] === 80 : value.args[0].height === 80))).length);
    assert.equal(s.nodes(replacement, node => node.type === (platform === 'android' ? 'CircularProgressIndicator' : 'ProgressView')).length, 1); assert.ok(tree);
  });
}
test('Android shared search header keeps its hint and closes focus without clearing the query', () => {
  const f = s.view('Header', 'android'), tree = f.render(), field = s.nativeId(tree, 'admin-item-create-search');
  assert.equal(tree.type, 'RoleHeaderRow');
  assert.equal(field.props.textStyle.fontSize, 15);
  assert.equal(s.nodes(tree, node => node.type === 'BackButton').length, 1);
  assert.equal(s.nativeId(tree, 'admin-item-search-close'), undefined);
  assert.ok(s.text(tree).includes(f.model.a('item.search'))); f.model.searchFocused = true; f.model.profileVisible = false; const focused = f.render(); s.nativeId(focused, 'admin-item-search-close').props.onClick(); assert.ok(f.commands.includes('blur')); assert.deepEqual(f.calls.at(-1), ['focus', false]); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'search'), false);
  assert.equal(s.nodes(focused, node => node.type === 'BackButton').length, 0);
  assert.ok(f.motions.some(value => value.duration === 150 && Array.isArray(value.easing) && value.easing[2] === .58)); assert.ok(s.nodes(focused, node => node.type === 'Animated.View' && node.props.pointerEvents === 'none' && node.props.accessibilityElementsHidden === true).length);
});
test('Android unfocused query clear uses actual native clear and dispatches empty source search once', () => {
  const f = s.view('Header', 'android'); f.model.state.list = { ...f.model.state.list, searchDraft: ' query ' }; const tree = f.render(); s.nativeId(tree, 'admin-item-search-close').props.onClick(); assert.ok(f.commands.includes('clear')); assert.deepEqual(f.calls, [['search', '']]);
});
test('Android published user drafts never echo over a newer native buffer, caret or composing range', () => {
  const f = s.view('Header', 'android'); f.model.state.list = { ...f.model.state.list, searchDraft: 'seed' }; f.render(); f.commands.length = 0;
  f.input('a'); f.model.state.list = { ...f.model.state.list, searchDraft: 'a' };
  f.render(tree => f.input('ab', { selection: 1, composing: { start: 0, end: 2 } }, tree));
  assert.equal(f.buffer.text, 'ab'); assert.equal(f.buffer.selection, 1); assert.deepEqual(f.buffer.composing, { start: 0, end: 2 }); assert.deepEqual(f.commands, []);
  f.model.state.list = { ...f.model.state.list, searchDraft: 'ab' }; f.render();
  assert.equal(f.buffer.text, 'ab'); assert.equal(f.buffer.selection, 1); assert.deepEqual(f.buffer.composing, { start: 0, end: 2 }); assert.deepEqual(f.commands, []);
});
test('Android actual cache restore and a replacement owner or replay generation still fill the same native State object', () => {
  const f = s.view('Header', 'android'); f.model.state.list = { ...f.model.state.list, searchDraft: 'cached' }; let tree = f.render();
  const state = s.nativeId(tree, 'admin-item-create-search').props.value; assert.equal(f.buffer.text, 'cached'); assert.deepEqual(f.commands, [['set', 'cached']]);
  f.input('native'); f.model.state.generation++; f.model.state.list = { ...f.model.state.list, searchDraft: 'replay cache' }; tree = f.render();
  assert.equal(s.nativeId(tree, 'admin-item-create-search').props.value, state); assert.equal(f.buffer.text, 'replay cache');
  f.input('another native'); f.model.owner = { ...f.model.owner }; f.model.state.list = { ...f.model.state.list, searchDraft: 'new owner cache' }; tree = f.render();
  assert.equal(s.nativeId(tree, 'admin-item-create-search').props.value, state); assert.equal(f.buffer.text, 'new owner cache'); assert.deepEqual(f.commands, [['set', 'cached'], ['set', 'replay cache'], ['set', 'new owner cache']]);
});
test('Android Source hint uses Dart trimmed emptiness rather than native literal-empty placeholder, including U+0085', () => {
  const f = s.view('Header', 'android'); f.model.state.list = { ...f.model.state.list, searchDraft: '\u0085 \u0085' }; const tree = f.render(); assert.ok(s.text(tree).includes(f.model.a('item.search'))); assert.equal(s.nativeId(tree, 'admin-item-search-close'), undefined);
});
test('iOS actual native search Cancel preserves typed query and ignores UIKit following empty-change echo', () => {
  const f = s.view('Header', 'ios'), tree = f.render(), options = s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions;
  options.onChangeText({ nativeEvent: { text: 'kept query' } }); options.onCancelButtonPress(); options.onChangeText({ nativeEvent: { text: '' } }); assert.deepEqual(f.calls, [['search', 'kept query'], ['focus', false]]); assert.ok(f.commands.some(value => Array.isArray(value) && value[1] === 'kept query'));
  f.focus(false); options.onBlur(); assert.deepEqual(f.calls.at(-1), ['focus', false]);
});
test('iOS equal published native edits never issue a setText command; owner/generation cache restore and Cancel remain explicit writes', () => {
  const f = s.view('Header', 'ios'); f.model.state.list = { ...f.model.state.list, searchDraft: 'cached' }; f.render(); assert.deepEqual(f.commands, [['set', 'cached']]); f.commands.length = 0;
  f.input('native', { selection: 1, composing: { start: 0, end: 6 } }); f.model.state.list = { ...f.model.state.list, searchDraft: 'native' }; f.render();
  assert.deepEqual(f.commands, []); assert.equal(f.buffer.selection, 1); assert.deepEqual(f.buffer.composing, { start: 0, end: 6 });
  f.model.state.generation++; f.model.state.list = { ...f.model.state.list, searchDraft: 'replay cache' }; f.render(); assert.equal(f.buffer.text, 'replay cache');
  f.input('new native'); f.model.owner = { ...f.model.owner }; f.model.state.list = { ...f.model.state.list, searchDraft: 'new owner cache' }; let tree = f.render(); assert.equal(f.buffer.text, 'new owner cache');
  f.input('kept'); tree = f.render(); const options = s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions; options.onCancelButtonPress();
  assert.deepEqual(f.commands, [['set', 'replay cache'], ['set', 'new owner cache'], ['set', 'kept']]);
});
test('actual root Scaffold snapshot supplies retained body Source240 tail; missing provider is never replaced by fake metrics', () => {
  const policy = s.load('admin/adminItemCreateNativeLayout', { './adminSupplierScaffoldLayout': s.load('admin/adminSupplierScaffoldLayout') }); let layout = { metrics: { viewInsetsBottom: 0 }, hostHeight: 199 }, reads = 0;
  const module = s.compile(path.resolve(__dirname, '../src/admin/AdminItemCreateScaffold.tsx'), { './AdminCreateHubProvider': { useAdminCreateHubScaffoldLayout: () => { reads++; if (!layout) throw Error('AdminCreateHubProvider is required'); return layout; } }, './AdminShellBodyFrame': { AdminShellBodyFrame: 'Frame' }, './adminItemCreateNativeLayout': policy });
  let received; const render = () => module.AdminItemCreateScaffold({ children: value => { received = value; return { type: 'RetainedList', props: { value } }; } });
  const first = render(); assert.equal(first.props.hasFooter, true); assert.equal(first.props.contentPadding, 'none'); assert.equal(received, 439); layout = { metrics: null, hostHeight: null }; const pending = render(); assert.equal(received, null); assert.equal(pending.props.children.type, 'RetainedList'); assert.equal(reads, 2);
  layout = null; assert.throws(render, /Provider is required/);
});

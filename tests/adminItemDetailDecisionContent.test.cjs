const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, s, byID, nodes, text, modifier, press, submit } = require('./adminItemDetailDecisionContentSupport.cjs');

for (const platform of ['android', 'ios']) {
  test(`${platform}: edit native buffers flush before opaque close; no rename until actual host ACK`, async () => {
    const f = fixture(platform); await f.open('edit'); let tree = f.renderContent();
    const code = byID(tree, 'admin-item-detail-code-field'), name = byID(tree, 'admin-item-detail-name-field');
    const codeState = code.props.value ?? code.props.text, nameState = name.props.value ?? name.props.text;
    codeState.set(' Native code '); nameState.set(' Native name '); // Intentionally no delayed JS onChange delivery.
    press(byID(tree, 'admin-item-detail-save'));
    assert.equal(f.closes.length, 1); assert.equal(f.dialog().closing, true); assert.deepEqual(f.f.calls, []);
    assert.equal(codeState.reads, 1); assert.equal(nameState.reads, 1);
    tree = f.renderContent(); assert.equal(platform === 'android' ? byID(tree, 'admin-item-detail-save').props.enabled : modifier(byID(tree, 'admin-item-detail-save'), 'disabled')[0], platform === 'android' ? false : true);
    await f.ack(); assert.equal(f.f.calls[0][0], 'rename'); assert.deepEqual(f.f.calls[0][2], { code: 'Native code', name: 'Native name' });
    assert.equal(f.f.owner.getSnapshot().dialogs.length, 0); f.cleanup();
  });
  test(`${platform}: Source code-first inline validation, retained native drafts and name submit Save`, async () => {
    const f = fixture(platform); await f.open('edit'); let tree = f.renderContent();
    const code = byID(tree, 'admin-item-detail-code-field'), name = byID(tree, 'admin-item-detail-name-field'), c = code.props.value ?? code.props.text, n = name.props.value ?? name.props.text;
    c.set(' \uFEFF '); n.set(' '); press(byID(tree, 'admin-item-detail-save')); tree = f.renderContent();
    assert.equal(text(byID(tree, 'admin-item-detail-validation')), 'detail.code_required'); assert.equal(f.closes.length, 0);
    c.set('next'); press(byID(tree, 'admin-item-detail-save')); tree = f.renderContent(); assert.equal(text(byID(tree, 'admin-item-detail-validation')), 'detail.name_required');
    assert.equal((byID(tree, 'admin-item-detail-code-field').props.value ?? byID(tree, 'admin-item-detail-code-field').props.text), c);
    n.set('latest native text'); if (platform === 'android') byID(tree, 'admin-item-detail-name-field').props.keyboardActions.onDone('older callback text'); else submit(byID(tree, 'admin-item-detail-name-field'));
    assert.equal(f.closes.length, 1); assert.equal(f.f.calls.length, 0); await f.ack(); assert.equal(f.f.calls[0][2].name, 'latest native text'); f.cleanup();
  });
  test(`${platform}: Source input order/copy/keyboard options and 56dp filled Save`, async () => {
    const f = fixture(platform); await f.open('edit'); const tree = f.renderContent(), all = text(tree);
    assert.ok(all.indexOf('detail.item_edit') < all.indexOf('action.cancel')); assert.ok(all.indexOf('action.cancel') < all.indexOf('action.save'));
    const c = byID(tree, 'admin-item-detail-code-field'), n = byID(tree, 'admin-item-detail-name-field');
    if (platform === 'android') { assert.equal(c.props.keyboardOptions.autoCorrectEnabled, false); assert.equal(c.props.keyboardOptions.imeAction, 'next'); assert.equal(n.props.keyboardOptions.capitalization, 'sentences'); assert.equal(n.props.keyboardOptions.imeAction, 'done'); assert.equal(modifier(byID(tree, 'admin-item-detail-save'), 'defaultMinSize')[0].minHeight, 56); }
    else { assert.deepEqual(modifier(c, 'autocorrectionDisabled'), [true]); assert.deepEqual(modifier(c, 'textInputAutocapitalization'), ['never']); assert.deepEqual(modifier(c, 'submitLabel'), ['next']); assert.deepEqual(modifier(n, 'textInputAutocapitalization'), ['sentences']); assert.equal(modifier(byID(tree, 'admin-item-detail-save'), 'frame')[0].minHeight, 56); }
    assert.equal(nodes(tree, node => ['Modal', 'BottomSheet', 'AlertDialog', 'Alert'].includes(node.type)).length, 0); f.cleanup();
  });
  test(`${platform}: covered/stale/released native edit callbacks cannot read a buffer or close`, async () => {
    const f = fixture(platform); await f.open('edit'); const tree = f.renderContent(), save = byID(tree, 'admin-item-detail-save');
    f.top(false); press(save); assert.ok(f.buffers.every(value => value.reads === 0)); assert.equal(f.closes.length, 0);
    f.top(true); f.buffers[0].released = true; press(save); assert.equal(f.closes.length, 0); assert.equal(f.f.calls.length, 0);
    f.buffers[0].released = false; f.current(false); press(save); assert.equal(f.closes.length, 0); f.current(true); press(save); assert.equal(f.closes.length, 0); f.cleanup();
  });
  test(`${platform}: delete exact raw code message, fallback trimmed name, action order, close-before-command`, async () => {
    const f = fixture(platform, { detail: s.detail({ code: '  Raw code  ', name: ' \uFEFF ' }) }); await f.open('delete'); const tree = f.renderContent(), all = text(tree);
    assert.ok(all.includes('detail.item_delete_message{"name":"Raw code","code":"  Raw code  "}')); assert.ok(all.indexOf('action.cancel') < all.indexOf('action.delete'));
    press(byID(tree, 'admin-item-delete-confirm')); assert.equal(f.closes.length, 1); assert.equal(f.f.calls.length, 0);
    await f.ack(); assert.equal(f.f.calls[0][0], 'remove'); assert.equal(f.f.owner.getSnapshot().phase, 'removed'); f.cleanup();
  });
  test(`${platform}: delete Cancel remains cancellation and never writes`, async () => {
    const f = fixture(platform); await f.open('delete'); press(byID(f.renderContent(), 'admin-item-delete-cancel')); await f.ack(); assert.equal(f.f.calls.length, 0); assert.equal(f.f.owner.getSnapshot().dialogs.length, 0); f.cleanup();
  });
  test(`${platform}: group Source .74 viewport/raw own bottom padding, filter/current row and apply`, async () => {
    const f = fixture(platform, { detail: s.detail({ item_group: 'A' }) }); await f.open('group'); let tree = f.renderContent();
    assert.equal(byID(tree, 'admin-item-group-content').props.style[1].height, 592);
    assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.paddingBottom === 40).length);
    const oldB = byID(tree, 'admin-item-group-option-B'); assert.ok(oldB);
    const input = byID(tree, 'admin-item-group-search'); (input.props.onValueChange ?? input.props.onTextChange)(' KrAsKa '); tree = f.renderContent();
    assert.equal(byID(tree, 'admin-item-group-option-B'), undefined); press(oldB); assert.notEqual(f.dialog().selected, 'B');
    press(byID(tree, 'admin-item-group-option-Kraska')); tree = f.renderContent(); press(byID(tree, 'admin-item-group-apply')); assert.equal(f.f.calls.filter(value => value[0] === 'group').length, 0);
    await f.ack(); assert.equal(f.f.calls.find(value => value[0] === 'group')[2], 'Kraska'); f.cleanup();
  });
  test(`${platform}: no groups result preserves Apply when original selection exists`, async () => {
    const f = fixture(platform); await f.open('group'); let tree = f.renderContent(); const input = byID(tree, 'admin-item-group-search');
    (input.props.onValueChange ?? input.props.onTextChange)('unmatched'); tree = f.renderContent(); assert.ok(text(tree).includes('detail.item_group_not_found'));
    const apply = byID(tree, 'admin-item-group-apply'); assert.equal(platform === 'android' ? apply.props.enabled : !modifier(apply, 'disabled')[0], true); f.cleanup();
  });
  test(`${platform}: unknown viewport holds native sheet/events; real facts resume without guessing`, async () => {
    const f = fixture(platform); await f.open('group'); const old = byID(f.renderContent(), 'admin-item-group-apply');
    f.props({ viewport: null }); assert.equal(f.renderContent(), null); press(old); assert.equal(f.closes.length, 0);
    f.props({ viewport: { width: 640, height: 960, paddingBottom: 0 } }); const tree = f.renderContent(); assert.equal(byID(tree, 'admin-item-group-content').props.style[1].height, 710.4); f.cleanup();
  });
  test(`${platform}: Source blank current group keeps Apply disabled until actual choice`, async () => {
    const f = fixture(platform, { detail: s.detail({ item_group: '' }) }); await f.open('group'); let tree = f.renderContent(), apply = byID(tree, 'admin-item-group-apply');
    assert.equal(platform === 'android' ? apply.props.enabled : !modifier(apply, 'disabled')[0], false); press(apply); assert.equal(f.closes.length, 0);
    press(byID(tree, 'admin-item-group-option-A')); tree = f.renderContent(); apply = byID(tree, 'admin-item-group-apply'); assert.equal(platform === 'android' ? apply.props.enabled : !modifier(apply, 'disabled')[0], true); f.cleanup();
  });
  test(`${platform}: actual native draft survives locale redraw and StrictMode without parent echo`, async () => {
    const f = fixture(platform); await f.open('edit'); let tree = f.renderContent(), code = byID(tree, 'admin-item-detail-code-field'), value = code.props.value ?? code.props.text; value.set('native unsent'); f.replay();
    f.props({ a: key => `next-locale:${key}` }); tree = f.renderContent(); code = byID(tree, 'admin-item-detail-code-field'); assert.equal(code.props.value ?? code.props.text, value); assert.equal(value.get(), 'native unsent'); assert.equal(f.closes.length, 0); assert.equal(f.f.calls.length, 0); f.cleanup();
  });
}

test('Source surface metadata keeps Dialog vs Sheet, safe area, drag/back and real viewport facts', () => {
  const f = fixture(), p = f.moduleFor('AdminItemDetailDecisionPresentation.ts');
  for (const kind of ['edit', 'delete']) { const surface = p.adminItemDetailDecisionSurface(kind); assert.equal(surface.kind, 'dialog'); assert.equal(surface.barrierDismissible, true); assert.equal(surface.dialogHorizontalInset, 40); assert.equal(surface.dialogVerticalInset, 24); assert.equal(surface.dialogMinimumWidth, 280); assert.equal(surface.enableDrag, false); }
  assert.equal(p.adminItemDetailDecisionSurface('group').useSafeArea, false); assert.equal(p.adminItemDetailDecisionSurface('customers').useSafeArea, true); assert.equal(p.adminItemDetailDecisionSurface('customers').heightFraction, .84);
  assert.equal(p.adminItemDetailDecisionViewport(null), null); for (const value of [undefined, {}, { width: 1, height: 0, paddingBottom: 0 }, { width: 1, height: 3, paddingBottom: -1 }, { width: 1, height: 3, paddingBottom: NaN }]) assert.throws(() => p.adminItemDetailDecisionViewport(value), TypeError); f.cleanup();
});
test('same original native surface cannot adopt a new controller/current/close provider', async () => {
  const f = fixture(); await f.open('edit'); const model = f.read(), other = s.fixture(); await other.start(); other.owner.requestEdit(other.owner.getSnapshot().detail);
  f.props({ controller: other.owner }); assert.equal(f.read().visible, false); model.save('code', 'name'); assert.equal(f.closes.length, 0); assert.equal(other.calls.length, 0); assert.equal(f.f.calls.length, 0); f.cleanup();
});
test('same surface identity with replacement authority is permanently retired, including queued callbacks', async () => {
  const f = fixture(); await f.open('delete'); const initial = f.propsValue(), old = f.read(); f.props({ isCurrent: () => true }); assert.equal(f.read().visible, false); f.props(initial); assert.equal(f.read().visible, false); old.close(true); assert.equal(f.closes.length, 0); f.cleanup();
});
test('StrictMode detach/reconnect is reversible, actual unmount immediately retires native dispatch', async () => {
  const f = fixture(); await f.open('edit'); const m = f.read(); f.replay(); assert.equal(m.lifetime.canInteract(), true); f.cleanup(); m.save('c', 'n'); assert.equal(f.closes.length, 0);
});
test('accepted close hands original ticket to host after synchronous content unmount, without ACK', async () => {
  const f = fixture(); await f.open('delete'); const m = f.read(); const unsubscribe = f.f.owner.subscribe(() => { if (f.dialog()?.closing) f.cleanup(); });
  m.close(true); assert.equal(f.closes.length, 1); assert.equal(f.f.calls.length, 0); unsubscribe(); await f.ack(); assert.equal(f.f.calls[0][0], 'remove');
});
test('account retirement during prepareClose publication suppresses host callback and all writes', async () => {
  const f = fixture(); await f.open('delete'); const m = f.read(), unsubscribe = f.f.owner.subscribe(() => { if (f.dialog()?.closing) { f.current(false); f.f.retire(); } });
  m.close(true); assert.equal(f.closes.length, 0); assert.equal(f.f.calls.length, 0); unsubscribe(); f.cleanup();
});
test('strict async/reentrant native authority never accepts or leaks rejected callback promises', async () => {
  const f = fixture(); await f.open('delete'); f.props({ canInteract: () => Promise.reject(Error('async native authority')) }); const m = f.read(); m.close(true); await s.flush(); assert.equal(f.closes.length, 0); f.cleanup();
  const g = fixture(); await g.open('delete'); let owner; g.props({ canInteract: () => owner.lifetime.canInteract() }); owner = g.read(); owner.close(true); assert.equal(g.closes.length, 0); g.cleanup();
});
test('a new genuine surface remounts original native buffers rather than adopting old draft', async () => {
  const f = fixture(); await f.open('edit'); let tree = f.renderContent(); const first = byID(tree, 'admin-item-detail-code-field').props.value; first.set('old draft');
  f.props({ surfaceIdentity: {} }); tree = f.renderContent(); const next = byID(tree, 'admin-item-detail-code-field').props.value; assert.notEqual(first, next); assert.equal(next.get(), f.f.initial.code); f.cleanup();
});
test('final original-current reentrancy cannot admit a covered decision using an earlier top snapshot', async () => {
  const f = fixture(); await f.open('delete'); let armed = false, checks = 0;
  f.props({ isCurrent: () => { if (armed && ++checks === 2) f.f.owner.requestEdit(f.f.owner.getSnapshot().detail); return true; } }); const m = f.read(); armed = true;
  assert.equal(m.lifetime.canInteract(), false); assert.equal(f.f.owner.getSnapshot().dialogs.at(-1).kind, 'edit'); assert.equal(f.closes.length, 0); f.cleanup();
});
test('Android Source input fill/ink/label/border colors follow actual light/dark theme', async () => {
  for (const mode of ['light', 'dark']) {
    const f = fixture('android', { mode }); await f.open('edit'); const field = byID(f.renderContent(), 'admin-item-detail-code-field');
    assert.equal(field.props.colors.focusedContainerColor, mode === 'dark' ? f.colors.surfaceContainerHigh : f.colors.surfaceContainerHighest); assert.equal(field.props.colors.unfocusedIndicatorColor, f.colors.outlineVariant); assert.equal(field.props.colors.focusedLabelColor, f.colors.onSurfaceVariant); assert.equal(field.props.textStyle.fontSize, 16); assert.equal(field.props.textStyle.fontWeight, '400'); f.cleanup();
  }
});
test('Android AlertDialog uses Source M3 headlineSmall default, while explicit sheet headers use titleLarge800', async () => {
  for (const kind of ['edit', 'delete', 'group']) { const f = fixture(); await f.open(kind); const tree = f.renderContent(), titleKey = kind === 'edit' ? 'detail.item_edit' : kind === 'delete' ? 'detail.item_delete_title' : 'detail.item_group_select';
    const title = nodes(tree, node => node.type === 'Text' && node.props.children === titleKey)[0]; assert.equal(title.props.style.typography, kind === 'group' ? 'titleLarge' : 'headlineSmall'); assert.equal(title.props.style.fontWeight, kind === 'group' ? '800' : '400'); if (kind !== 'group') assert.equal(title.props.style.fontSize, 24); f.cleanup(); }
});

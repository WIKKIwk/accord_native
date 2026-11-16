const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, nodes, byID, text, click } = require('./adminUserCreateNativeSupport.cjs');
const { deferred, tick } = require('./adminUserCreateSupport.cjs');
for (const platform of ['android', 'ios']) {
  test(`${platform} real UserCreate native form keeps source words, field order, genuine header/footer and enable flags`, () => {
    const f = fixture(platform), tree = f.render(); assert.ok(text(tree).includes(f.model.a('user.role_select'))); assert.ok(text(tree).includes(f.model.a('user.phone_optional')));
    click(byID(tree, 'admin-user-create-role'), platform); click(byID(tree, 'admin-user-create-save'), platform); assert.deepEqual(f.calls, ['role-picker', 'save']);
    const fields = nodes(tree, node => node.type === (platform === 'android' ? 'OutlinedTextField' : 'TextField')); assert.equal(fields.length, 2);
    fields[0].props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Name'); fields[1].props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Phone'); assert.deepEqual(f.calls.slice(-2), [['name', 'Name'], ['phone', 'Phone']]);
    f.model.saveEnabled = false; const disabled = byID(f.render(), 'admin-user-create-save'); assert.equal(platform === 'android' ? disabled.props.enabled : disabled.props.modifiers.find(value => value.name === 'disabled').args[0], platform !== 'android');
    const profile = platform === 'android' ? nodes(tree, node => node.type === 'AdminProfileAction')[0] : nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight(); assert.equal(profile.props.onProfile, f.props.onProfile); assert.equal(profile.props.canInteract, f.model.interactive);
    assert.ok(nodes(tree, node => node.type === 'RealFooter').length); assert.equal(nodes(tree, node => node.props?.testID === 'admin-user-create-body-frame')[0].props.pointerEvents, 'auto');
  });
  test(`${platform} customer-only role selector is non-actionable and does not invent a footer or tabs`, () => {
    const f = fixture(platform); f.model.customerOnly = true; f.model.footer = null; const tree = f.render(), selector = byID(tree, 'admin-user-create-role'); assert.equal(selector.props[platform === 'android' ? 'onClick' : 'onPress'], undefined);
    assert.equal(nodes(tree, node => node.type === 'RealFooter').length, 0); assert.equal(nodes(tree, node => node.type === 'TabView' || node.type === 'PagerView').length, 0);
  });
  test(`${platform} source Aparatchi inline selection and material group selector use actual IDs and text`, () => {
    const apparatus = fixture(platform, 'aparatchi'), tree = apparatus.render(), checkboxes = nodes(tree, node => node.type === (platform === 'android' ? 'Checkbox' : 'Toggle')); assert.equal(checkboxes.length, 2);
    checkboxes[0].props[platform === 'android' ? 'onCheckedChange' : 'onIsOnChange'](true); assert.deepEqual(apparatus.calls, [['apparatus', 'apparatus:default:A', true]]);
    if (platform === 'android') { click(byID(tree, 'admin-user-create-apparatus-0'), platform); assert.deepEqual(apparatus.calls.at(-1), ['apparatus', 'apparatus:default:A', true]); assert.equal(byID(tree, 'admin-user-create-apparatus-1').props.onClick, undefined); }
    const material = fixture(platform, 'material'), first = material.render(); assert.ok(text(first).includes(material.model.a('user.group_choose'))); click(byID(first, 'admin-user-create-groups'), platform); assert.deepEqual(material.calls, ['group-picker']);
    material.state.selectedGroups = ['Kley', 'Kraska']; assert.ok(text(material.render()).includes('Kley, Kraska'));
  });
  test(`${platform} Werka read/loading/error/code controls retain source independent saving/countdown enables`, () => {
    const f = fixture(platform, 'werka'); f.state.saving = true; f.model.saveEnabled = false; const tree = f.render(); click(byID(tree, 'admin-user-create-code-copy'), platform); click(byID(tree, 'admin-user-create-code-regenerate'), platform); assert.deepEqual(f.calls, ['copy', 'regenerate']);
    f.state.phase = 'error'; click(byID(f.render(), 'admin-user-create-retry'), platform); assert.equal(f.calls.at(-1), 'reload'); f.state.phase = 'loading'; assert.ok(nodes(f.render(), node => node.type === (platform === 'android' ? 'AdminLoadingIndicator' : 'ProgressView')).length);
  });
  test(`${platform} real native role picker searches and preserves invalid-source fallback metadata with no action`, () => {
    const f = fixture(platform); f.roles(''); const tree = f.render(true), search = byID(tree, 'admin-user-create-role-search'); search.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Material');
    assert.deepEqual(f.calls, [['picker-search', 21, 'Material']]); const disabled = byID(tree, `admin-user-create-role-option-${f.state.choices.length - 1}`); assert.equal(disabled.props[platform === 'android' ? 'onClick' : 'onPress'], undefined);
    click(byID(tree, 'admin-user-create-role-option-0'), platform); assert.equal(f.calls.at(-1)[0], 'role'); assert.equal(f.calls.at(-1)[2], f.state.choices[0]);
    if (platform === 'android') nodes(tree, node => node.type === 'ModalBottomSheet')[0].props.onDismissRequest(); else nodes(tree, node => node.type === 'BottomSheet')[0].props.onDismiss(); assert.deepEqual(f.calls.at(-1), [platform === 'android' ? 'picker-dismiss' : 'picker-complete', 21]);
  });
  test(`${platform} group selection is a bottom-anchored dialog with no sheet/search/swipe and keeps temporary selection`, () => {
    const f = fixture(platform, 'material'); f.state.picker = { id: 31, kind: 'groups', selected: [], closing: false, query: '' }; let tree = f.render(true); assert.equal(byID(tree, 'admin-user-create-role-search'), undefined);
    const option = nodes(tree, node => node.type === (platform === 'android' ? 'Checkbox' : 'Toggle'))[0]; option.props[platform === 'android' ? 'onCheckedChange' : 'onIsOnChange'](true); assert.deepEqual(f.calls, [['group', 31, 'Kley', true]]);
    const confirm = byID(tree, 'admin-user-create-groups-confirm'); assert.equal(platform === 'android' ? confirm.props.enabled : confirm.props.modifiers.find(value => value.name === 'disabled').args[0], platform !== 'android');
    f.state.picker = { ...f.state.picker, selected: ['Kley'] }; tree = f.render(true); click(byID(tree, 'admin-user-create-groups-confirm'), platform); assert.deepEqual(f.calls.at(-1), ['groups-confirm', 31]);
    assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet' || node.type === 'BottomSheet').length, 0);
    const dialog = nodes(tree, node => node.type === 'Modal')[0]; assert.equal(dialog.props.transparent, true); assert.equal(dialog.props.animationType, 'fade'); assert.equal(dialog.props.presentationStyle, 'overFullScreen'); if (platform === 'ios') assert.equal(dialog.props.allowSwipeDismissal, false);
    assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.justifyContent === 'flex-end' && node.props.style.backgroundColor === 'rgba(0,0,0,.32)').length);
    assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.maxHeight === 528 && node.props.style.paddingHorizontal === 12 && node.props.style.paddingTop === 12 && node.props.style.paddingBottom === 16).length);
  });
  test(`${platform} group dialog outside/back/close cancel without accepting selection and await actual native dismissal`, async () => {
    const f = fixture(platform, 'material'); f.state.picker = { id: 32, kind: 'groups', selected: ['Kley'], closing: false, query: '' }; let tree = f.render(true); const dialog = nodes(tree, node => node.type === 'Modal')[0];
    nodes(tree, node => node.type === 'Pressable')[0].props.onPress(); dialog.props.onRequestClose(); click(byID(tree, 'admin-user-create-picker-close'), platform); assert.deepEqual(f.calls, [['picker-dismiss', 32], ['picker-dismiss', 32], ['picker-dismiss', 32]]);
    assert.deepEqual(f.state.selectedGroups, []); assert.equal(f.calls.some(value => value[0] === 'groups-confirm' || value[0] === 'picker-complete'), false);
    if (platform === 'android') { f.nativeLayout(); f.acknowledge(); await tick(); }
    f.state.picker = { ...f.state.picker, closing: true }; tree = f.render(true);
    if (platform === 'ios') { const modal = nodes(tree, node => node.type === 'Modal')[0]; assert.equal(modal.props.visible, false); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); modal.props.onDismiss(); }
    else { assert.equal(nodes(tree, node => node.type === 'Modal').length, 0); await tick(); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); f.detached(); await tick(); }
    assert.deepEqual(f.calls.at(-1), ['picker-complete', 32]); f.cleanup();
  });
  test(`${platform} issued code keeps Copy open and completes only after its actual native dismissal boundary`, async () => {
    const f = fixture(platform); f.state.issuedCode = { id: 41, value: ' ISSUED ', closing: false }; let tree = f.render(true); assert.ok(text(tree).includes(' ISSUED ')); click(byID(tree, 'admin-user-create-issued-copy'), platform); assert.deepEqual(f.calls, [['code-copy', 41]]);
    click(byID(tree, 'admin-user-create-issued-close'), platform); assert.deepEqual(f.calls.at(-1), ['code-dismiss', 41]); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false);
    if (platform === 'android') { f.nativeLayout(); f.acknowledge(); await tick(); }
    f.state.issuedCode = { ...f.state.issuedCode, closing: true }; tree = f.render(true);
    if (platform === 'ios') { const modal = nodes(tree, node => node.type === 'Modal')[0]; assert.equal(modal.props.visible, false); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false); modal.props.onDismiss(); }
    else { assert.equal(nodes(tree, node => node.type === 'AlertDialog').length, 0); await tick(); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false); f.detached(); await tick(); }
    assert.deepEqual(f.calls.at(-1), ['code-complete', 41]); f.cleanup();
  });
  test(`${platform} accepted overlays render immediately through source-page blur and disappear on original owner retirement`, () => {
    const f = fixture(platform); f.model.focused = false; f.model.nativeCurrent = () => false; f.roles('');
    let tree = f.render(true); assert.equal(nodes(tree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet')).length, 1);
    f.state.picker = null; f.state.issuedCode = { id: 44, value: 'ACK DURING BLUR', closing: false }; tree = f.render(true);
    const modal = nodes(tree, node => node.type === (platform === 'android' ? 'AlertDialog' : 'Modal'))[0]; assert.ok(modal); if (platform === 'ios') assert.equal(modal.props.visible, true);
    f.model.current = () => false; assert.equal(f.render(true), null);
  });
}
test('Android accepted role requires actual hide Promise AND original native root detach before committing', async () => {
  const hidden = deferred(), f = fixture('android', 'customer', 'uz', { hide: () => hidden.promise }); f.roles(''); f.render(true); f.nativeLayout(); f.acknowledge(); await tick();
  f.state.picker = { ...f.state.picker, closing: true }; f.render(true); await tick(); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); hidden.resolve(); await tick(); const tree = f.render(true); assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet').length, 0);
  assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); f.detached(); await tick(); assert.deepEqual(f.calls.at(-1), ['picker-complete', 21]); f.cleanup();
});
test('Android group confirmation uses direct dialog arm/removal/detach without invoking any sheet hide', async () => {
  let hides = 0; const f = fixture('android', 'material', 'uz', { hide: () => { hides++; throw Error('Group is not a sheet'); } }); f.state.picker = { id: 33, kind: 'groups', selected: ['Kley'], closing: false, query: '' };
  let tree = f.render(true); f.nativeLayout(); click(byID(tree, 'admin-user-create-groups-confirm'), 'android'); f.state.picker = { ...f.state.picker, closing: true }; tree = f.render(true); assert.equal(nodes(tree, node => node.type === 'Modal').length, 1); assert.equal(hides, 0);
  f.acknowledge(); await tick(); tree = f.render(true); assert.equal(nodes(tree, node => node.type === 'Modal').length, 0); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); f.detached(); await tick(); assert.deepEqual(f.calls.at(-1), ['picker-complete', 33]); f.cleanup();
});
test('iOS issued-code React component/key stays independent of role/group picker closure (root UIKit presentation remains external)', () => {
  const f = fixture('ios'); f.state.picker = { id: 34, kind: 'roles', selected: [], closing: false, query: '' }; f.state.issuedCode = { id: 35, value: 'Code', closing: false };
  const initial = f.rawOverlays().props.children[1]; assert.equal(initial.type.name, 'IssuedCode'); assert.equal(initial.key, 35);
  f.state.picker = { ...f.state.picker, closing: true }; assert.equal(f.rawOverlays().props.children[1].type, initial.type);
  f.state.picker = null; const after = f.rawOverlays().props.children[1]; assert.equal(after.type, initial.type); assert.equal(after.key, initial.key);
});
test('Android issued dialog remains visible through accepted close until actual marker arm ACK, then still waits native detach', async () => {
  const f = fixture('android'); f.state.issuedCode = { id: 51, value: 'Original', closing: false }; f.render(true); f.nativeLayout(); f.state.issuedCode = { ...f.state.issuedCode, closing: true };
  assert.equal(nodes(f.render(true), node => node.type === 'AlertDialog').length, 1); await tick(); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false);
  f.acknowledge(); await tick(); assert.equal(nodes(f.render(true), node => node.type === 'AlertDialog').length, 0); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false); f.detached(); await tick(); assert.deepEqual(f.calls.at(-1), ['code-complete', 51]); f.cleanup();
});
test('Android missing sheet ref stays open; real ref attachment can finish accepted hide followed by real window detach', async () => {
  let hides = 0; const hidden = deferred(), f = fixture('android', 'customer', 'uz', { missingSheet: true, hide: () => { hides++; return hidden.promise; } }); f.roles(''); f.render(true); f.nativeLayout(); f.acknowledge(); await tick(); f.state.picker = { ...f.state.picker, closing: true };
  let tree = f.render(true); await tick(); assert.equal(hides, 0); assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet').length, 1); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false);
  f.sheetAvailable(true); f.render(true); assert.equal(hides, 1); hidden.resolve(); await tick(); tree = f.render(true); assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet').length, 0); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); f.detached(); await tick(); assert.deepEqual(f.calls.at(-1), ['picker-complete', 21]); f.cleanup();
});
test('Android rejected or missing hide Promise never removes the native sheet or acknowledges source selection', async () => {
  for (const hide of [() => Promise.reject(Error('native hide failed')), () => undefined, () => ({ then(resolve) { resolve(); } })]) {
    const f = fixture('android', 'customer', 'uz', { hide }); f.roles(''); f.render(true); f.nativeLayout(); f.acknowledge(); await tick(); f.state.picker = { ...f.state.picker, closing: true }; f.render(true); await tick(); const tree = f.render(true);
    assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet').length, 1); assert.equal(f.calls.some(value => value[0] === 'picker-complete'), false); f.cleanup();
  }
});
test('Android retired original account/window callbacks cannot acknowledge a successor issued code', async () => {
  const f = fixture('android'); f.state.issuedCode = { id: 61, value: 'Old', closing: false }; f.render(true); f.nativeLayout(); f.acknowledge(); await tick(); f.state.issuedCode = { ...f.state.issuedCode, closing: true }; f.render(true);
  f.state.issuedCode = { id: 62, value: 'New', closing: false }; let tree = f.render(true); f.detached(); await tick(); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false); assert.ok(text(tree).includes('New'));
  f.nativeLayout(); f.acknowledge(); await tick(); f.state.issuedCode = { ...f.state.issuedCode, closing: true }; f.render(true); f.retire(); f.cleanup(); f.detached(); await tick(); assert.equal(f.calls.some(value => value[0] === 'code-complete'), false); assert.ok(f.windowCalls.some(value => value[0] === 'cancel'));
});
test('Android requires the genuine observer dependency before mounting any UserCreate read/command owner', () => {
  for (const value of [undefined, null, {}]) { const f = fixture('android'); f.props.windowObserver = value; assert.throws(() => f.render(), /genuine native window observer/); assert.equal(f.hookReads(), 0); assert.deepEqual(f.calls, []); }
});
test('Android source dimensions and native buffer fill semantics retain63/66/58/56/r18 and never echo reported keystrokes', () => {
  const f = fixture('android'), tree = f.render(), selector = byID(tree, 'admin-user-create-role'), save = byID(tree, 'admin-user-create-save');
  assert.ok(selector.props.modifiers.some(value => value.name === 'defaultMinSize' && value.args[0].minHeight === 66)); assert.ok(save.props.modifiers.some(value => value.name === 'defaultMinSize' && value.args[0].minHeight === 56));
  assert.equal(selector.props.shape.cornerRadii.topStart, 18); assert.ok(nodes(tree, node => node.type === 'TopAppBar' && node.props.modifiers.some(value => value.name === 'height' && value.args[0] === 60)).length); assert.ok(nodes(tree, node => node.type === 'Surface' && node.props.modifiers?.some(value => value.name === 'height' && value.args[0] === 3)).length); assert.ok(nodes(tree, node => node.type === 'Text' && node.props.style?.fontSize === 24).length);
  const fields = nodes(tree, node => node.type === 'OutlinedTextField'), native = fields[0].props.value; fields[0].props.onValueChange('newer native'); f.model.fields.name = 'stale render'; f.render(); assert.deepEqual(native.writes, []);
  f.state.fillVersion++; f.model.fields.name = ''; f.render(); assert.deepEqual(native.writes, ['']);
});
test('source role/issued-code words stay exact across every supported locale without extra validation fields', () => {
  for (const platform of ['android', 'ios']) for (const locale of ['uz', 'en', 'ru', 'ur']) { const f = fixture(platform, 'supplier', locale), tree = f.render(); assert.ok(text(tree).includes(f.model.a('user.role_select'))); assert.ok(text(tree).includes(f.model.a('user.phone'))); }
});

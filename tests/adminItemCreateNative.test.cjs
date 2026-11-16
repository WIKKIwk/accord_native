const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateNativeSupport.cjs');
for (const platform of ['android', 'ios']) {
  test(`${platform} source dialog is72%/440/r18 with12,48,12,24 scroll padding and source group,name,UOM,code order`, () => {
    const f = s.card(platform), tree = f.render(), card = s.nativeId(tree, 'admin-item-create-dialog-card'); assert.equal(card.props.style[0].maxWidth, 440); assert.equal(card.props.style[0].borderRadius, 18); assert.equal(card.props.style[1].maxHeight, 648);
    const scroll = s.nodes(tree, node => node.type === 'ScrollView')[0]; assert.deepEqual(scroll.props.contentContainerStyle, { paddingLeft: 12, paddingTop: 48, paddingRight: 12, paddingBottom: 24 });
    const ids = s.nodes(tree, node => node.props.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.name))).map(node => node.props.modifiers.find(value => ['testID', 'accessibilityIdentifier'].includes(value.name)).args[0]);
    assert.ok(ids.indexOf('admin-item-create-group-picker') < ids.indexOf('admin-item-create-name')); assert.ok(ids.indexOf('admin-item-create-name') < ids.indexOf('admin-item-create-uom-picker')); assert.ok(ids.indexOf('admin-item-create-uom-picker') < ids.indexOf('admin-item-create-code'));
    assert.equal(s.text(tree).includes(f.model.a('item.add_title')) || s.nativeId(tree, 'admin-item-create-submit').props.label === f.model.a('item.add_title'), true);
  });
  test(`${platform} native text fields remain editable while live saving differs from captured visual saving, and submit stays source56`, () => {
    const f = s.card(platform, s.model({ saving: true })), tree = f.render(), submit = s.nativeId(tree, 'admin-item-create-submit');
    if (platform === 'android') { assert.equal(submit.props.enabled, true); assert.equal(submit.props.shape.radius, 20); assert.ok(submit.props.modifiers.some(value => value.name === 'defaultMinSize' && value.args[0].minHeight === 56)); }
    else { assert.ok(submit.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === false)); assert.ok(submit.props.modifiers.some(value => value.name === 'frame' && value.args[0].minHeight === 56)); }
    for (const name of ['code', 'name']) { const field = s.nativeId(tree, `admin-item-create-${name}`); assert.notEqual(field.props.enabled, false); assert.equal(field.props.modifiers.some(value => value.name === 'disabled' && value.args[0]), false); }
  });
  test(`${platform} captured busy visual disables group/UOM/submit/close and keeps source creating words`, () => {
    const fixture = s.model(); fixture.dialog = { ...fixture.dialog, savingView: true }; const f = s.card(platform, fixture), tree = f.render();
    for (const id of ['group-picker', 'uom-picker', 'submit', 'close']) { const control = s.nativeId(tree, `admin-item-create-${id}`);
      assert.equal(platform === 'android' ? control.props.enabled === false : control.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true), true); }
    const submit = s.nativeId(tree, 'admin-item-create-submit'); assert.equal(platform === 'android' ? s.text(submit).includes(f.model.a('item.creating')) : submit.props.label === f.model.a('item.creating'), true);
  });
  test(`${platform} finished branch uses captured selected customer raw name and clear action, omitting raw code`, () => {
    const fixture = s.model({ draft: { code: 'old', name: 'name', group: 'Tayyor mahsulot', uom: 'PCS', customer: { ref: 'new', name: 'New live', phone: '' } } }); fixture.dialog = { ...fixture.dialog, finishedView: true, customerView: { ref: 'old', name: ' Raw Captured ', phone: '' } };
    const f = s.card(platform, fixture), tree = f.render(); assert.equal(s.nativeId(tree, 'admin-item-create-code'), undefined); assert.ok(s.text(tree).includes(' Raw Captured ')); assert.equal(s.text(tree).includes('New live'), false);
    const clear = s.nativeId(tree, 'admin-item-create-customer-clear'); clear.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls, ['clearCustomer']);
  });
  test(`${platform} source empty/loading catalogs disable selectors and empty UOM error uses actualsource label`, () => {
    const fixture = s.model({ groups: { loading: true, error: null, value: [] }, uoms: { loading: false, error: Error('empty'), value: [] } }), f = s.card(platform, fixture), tree = f.render();
    for (const kind of ['group', 'uom']) { const control = s.nativeId(tree, `admin-item-create-${kind}-picker`); assert.equal(platform === 'android' ? control.props.enabled === false : control.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true), true); }
    assert.ok(s.text(tree).includes(f.model.a('item.uom_load_failed')));
  });
  test(`${platform} shared acknowledgement fillVersion clears actual native buffers without replacing their state objects`, () => {
    const f = s.card(platform), tree = f.render(), name = s.nativeId(tree, 'admin-item-create-name'), code = s.nativeId(tree, 'admin-item-create-code'), nameState = platform === 'android' ? name.props.value : name.props.text, codeState = platform === 'android' ? code.props.value : code.props.text;
    f.model.state.form = { ...f.model.state.form, draft: { ...f.model.state.form.draft, name: '', code: '' }, fillVersion: 1 }; const next = f.render(), nextName = s.nativeId(next, 'admin-item-create-name');
    assert.equal(platform === 'android' ? nextName.props.value : nextName.props.text, nameState); assert.equal(nameState.get(), ''); assert.equal(codeState.get(), '');
  });
  test(`${platform} source logical end4 close position follows actual theme direction in both render directions`, () => {
    for (const [direction, yoga] of [['leftToRight', 'ltr'], ['rightToLeft', 'rtl']]) {
      const f = s.card(platform, s.model(), undefined, direction), tree = f.render(), card = s.nativeId(tree, 'admin-item-create-dialog-card'); assert.equal(card.props.style[1].direction, yoga);
      const close = s.nodes(tree, node => node.type === 'View' && node.props.style?.position === 'absolute' && node.props.style.top === 4)[0];
      assert.equal(close.props.style.end, 4); assert.equal('right' in close.props.style, false); assert.equal('left' in close.props.style, false); assert.equal(card.props.style[0].maxWidth, 440); assert.equal(card.props.style[1].maxHeight, 648);
    }
  });
}

/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { load } = require('./adminUsersSupport.cjs');
const { compile } = require('./adminSupplierDetailViewSupport.cjs');
const names = ['Regular', 'Medium', 'Bold', 'Italic', 'MediumItalic', 'BoldItalic'];
const fonts = load('admin/adminFontFamily.android', Object.fromEntries(names.map(name => [`../../assets/fonts/GoogleSans-${name}.ttf`, name])));
const input = load('admin/adminInputFont.android', { './adminFontFamily.android': fonts });

test('editable input style adds only its loaded source face; explicit metrics/color/family and unavailable defaults are retained', () => {
  const original = { fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#112233', letterSpacing: -.3, textAlign: 'right' };
  assert.deepEqual(input.adminInputTextStyle(original, true), { ...original, fontFamily: fonts.adminFontNames.medium }); assert.equal(original.fontFamily, undefined);
  assert.equal(input.adminInputTextStyle(original, false), original); assert.equal(input.adminInputTextStyle(undefined, false), undefined);
  const custom = { ...original, fontFamily: 'InheritedCustomFace' }; assert.equal(input.adminInputTextStyle(custom, true), custom);
  assert.deepEqual(input.adminInputTextStyle(undefined, true), { fontFamily: fonts.adminFontNames.regular });
  for (const [weight, face] of [['400', 'regular'], ['500', 'medium'], ['600', 'bold'], ['800', 'bold'], ['normal', 'regular'], ['bold', 'bold']]) {
    const source = { fontWeight: weight }; assert.deepEqual(input.adminInputTextStyle(source, true), { ...source, fontFamily: fonts.adminFontNames[face] });
  }
});

function installed() {
  const calls = [], states = [], stateIds = new Map(); let ready = true;
  const shared = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/jetpack-compose/TextField/shared.ts'), {
    '../../State': { getStateId: state => { states.push(state); return state == null ? null : stateIds.get(state); },
      worklets: { isWorkletFunction: callback => callback.worklet === true },
      useWorkletProp: (callback, name) => { calls.push(['worklet', callback, name]); return callback ? syncState : undefined; } },
    '../../keyboard': { useHostedTextInput: (ref, onFocus) => { calls.push(['hosted', ref, onFocus]); return { ref, onFocusChange: value => onFocus?.(value) }; } },
    '../modifiers/utils': { createViewModifierEventListener: modifiers => ({ nativeModifierEvents: modifiers }) },
  });
  const common = { expo: { requireNativeView: (_module, name) => `RealNative.${name}` }, './shared': shared, '../SlotView': { Slot: 'RealNative.Slot' } };
  const basic = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/jetpack-compose/TextField/BasicTextField.tsx'), common).BasicTextField;
  const outlined = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/jetpack-compose/TextField/TextField.tsx'), { ...common,
    '../Shape': { parseJSXShape: shape => { calls.push(['shape', shape]); return shape == null ? shape : { parsed: shape }; } } }).OutlinedTextField;
  const wrapper = compile(path.resolve(__dirname, '../src/admin/AdminTextFields.android.tsx'), {
    '@expo/ui/jetpack-compose': { BasicTextField: basic, OutlinedTextField: outlined }, './AdminTypography.android': { useAdminFontsReady: () => ready }, './adminInputFont.android': input,
  });
  const value = { original: 'native observable buffer' }, selection = { original: 'native selection buffer' }, syncState = { original: 'UI worklet state' };
  stateIds.set(value, 401); stateIds.set(selection, 402); stateIds.set(syncState, 403);
  return { calls, states, wrapper, basic, outlined, value, selection, setReady: value => { ready = value; } };
}

for (const [name, wrapperName, componentName, nativeName] of [
  ['basic', 'AdminBasicTextField', 'basic', 'RealNative.BasicTextFieldView'], ['outlined', 'AdminOutlinedTextField', 'outlined', 'RealNative.TextFieldView'],
]) {
  test(`${name} wrapper keeps the original SDK component/state/ref/children/events and serialized native buffer ids`, () => {
    const f = installed(), ref = { current: null }, events = [], keyboard = Object.fromEntries(['done', 'go', 'next', 'previous', 'search', 'send'].map(action => [`on${action[0].toUpperCase()}${action.slice(1)}`, value => events.push([action, value])]));
    const props = { ref, value: f.value, selection: f.selection, onValueChange: value => events.push(['value', value]), onFocusChanged: value => events.push(['focus', value]),
      onSelectionChange: value => events.push(['selection', value]), keyboardActions: keyboard, keyboardOptions: { keyboardType: 'phone', imeAction: 'done' },
      textStyle: { fontSize: 16, fontWeight: '500', lineHeight: 24, color: '#123456' }, modifiers: [{ original: 'semantics/events' }], children: { original: 'exact native slots' },
      autoFocus: true, enabled: false, readOnly: true, singleLine: true, maxLength: 31, minLines: 1, maxLines: 1, visualTransformation: 'password',
      textSelectionColors: { handleColor: '#123456', backgroundColor: '#654321' }, cursorColor: '#abcdef', colors: { focusedTextColor: '#111111' }, shape: { original: 'shape' } };
    const outer = f.wrapper[wrapperName](props); assert.equal(outer.type, f[componentName]);
    for (const key of Object.keys(props).filter(key => key !== 'textStyle')) assert.equal(outer.props[key], props[key], key);
    const native = f[componentName](outer.props); assert.equal(native.type, nativeName);
    assert.equal(native.props.value, 401); assert.equal(native.props.selection, 402); assert.equal(native.props.ref, ref); assert.equal(native.props.children, props.children);
    assert.equal(native.props.modifiers, props.modifiers); assert.equal(native.props.nativeModifierEvents, props.modifiers); assert.equal(native.props.keyboardOptions, props.keyboardOptions);
    assert.deepEqual(native.props.textStyle, { ...props.textStyle, fontFamily: fonts.adminFontNames.medium });
    assert.deepEqual(f.states.slice(0, 2), [f.value, f.selection]); assert.deepEqual(f.calls.find(call => call[0] === 'hosted'), ['hosted', ref, props.onFocusChanged]);
    native.props.onValueChange({ nativeEvent: { text: ' original value ', selection: { start: 1, end: 2 } } }); native.props.onFocusChanged({ nativeEvent: { value: true } });
    native.props.onSelectionChange({ nativeEvent: { start: 1, end: 2 } }); for (const action of ['done', 'go', 'next', 'previous', 'search', 'send']) native.props.onKeyboardAction({ nativeEvent: { action, value: action } });
    assert.deepEqual(events, [['value', ' original value '], ['focus', true], ['selection', { start: 1, end: 2 }], ...['done', 'go', 'next', 'previous', 'search', 'send'].map(action => [action, action])]);
    if (name === 'outlined') { assert.equal(native.props.variant, 'outlined'); assert.deepEqual(native.props.shape, { parsed: props.shape }); assert.equal(native.props.colors, props.colors); }
  });
  test(`${name} wrapper preserves UI-thread worklet callback identity and readiness updates never copy or write native state`, () => {
    const f = installed(), onValueChange = Object.assign(() => { throw Error('must remain on UI thread'); }, { worklet: true }), style = { fontSize: 16 }, props = { value: f.value, selection: f.selection, onValueChange, textStyle: style };
    f.setReady(false); let outer = f.wrapper[wrapperName](props); assert.equal(outer.props.textStyle, style); assert.equal(outer.props.value, f.value);
    let native = f[componentName](outer.props); assert.equal(native.props.onValueChange, undefined); assert.equal(native.props.onValueChangeSync, 403); assert.equal(f.calls.find(call => call[0] === 'worklet')[1], onValueChange);
    f.setReady(true); outer = f.wrapper[wrapperName](props); native = f[componentName](outer.props); assert.equal(outer.props.value, f.value); assert.equal(outer.props.selection, f.selection); assert.equal(outer.props.onValueChange, onValueChange);
    assert.equal(native.props.value, 401); assert.equal(native.props.selection, 402); assert.equal(native.props.textStyle.fontFamily, fonts.adminFontNames.regular);
    const explicit = { fontFamily: 'InheritedCustomFace', color: '#123456', fontWeight: '700' }; outer = f.wrapper[wrapperName]({ ...props, textStyle: explicit }); assert.equal(outer.props.textStyle, explicit);
  });
}

test('every wrapper slot is the exact installed Expo slot component, retaining native decoration/placeholder/icon contracts', () => {
  const f = installed();
  for (const name of ['DecorationBox', 'InnerTextField', 'Placeholder']) assert.equal(f.wrapper.AdminBasicTextField[name], f.basic[name]);
  for (const name of ['Label', 'Placeholder', 'LeadingIcon', 'TrailingIcon', 'Prefix', 'Suffix', 'SupportingText']) assert.equal(f.wrapper.AdminOutlinedTextField[name], f.outlined[name]);
  const child = { original: 'placeholder glyphs' }, decoration = f.wrapper.AdminBasicTextField.DecorationBox({ children: child });
  assert.equal(decoration.type, 'RealNative.Slot'); assert.equal(decoration.props.slotName, 'decorationBox'); assert.equal(decoration.props.children, child);
  assert.equal(f.wrapper.AdminBasicTextField.InnerTextField().type, 'RealNative.InnerTextFieldView'); assert.equal(f.wrapper.AdminBasicTextField.Placeholder({ children: child }).type, 'RealNative.PlaceholderView');
  for (const [name, slot] of [['Label', 'label'], ['Placeholder', 'placeholder'], ['LeadingIcon', 'leadingIcon'], ['TrailingIcon', 'trailingIcon'], ['Prefix', 'prefix'], ['Suffix', 'suffix'], ['SupportingText', 'supportingText']]) {
    const view = f.wrapper.AdminOutlinedTextField[name]({ children: child }); assert.equal(view.type, 'RealNative.Slot'); assert.equal(view.props.slotName, slot); assert.equal(view.props.children, child);
  }
});

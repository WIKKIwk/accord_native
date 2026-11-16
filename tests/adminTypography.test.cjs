/* global __dirname */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { load } = require('./adminUsersSupport.cjs');
const { compile } = require('./adminSupplierDetailViewSupport.cjs');
const names = ['Regular', 'Medium', 'Bold', 'Italic', 'MediumItalic', 'BoldItalic'];
const mocks = Object.fromEntries(names.map(name => [`../../assets/fonts/GoogleSans-${name}.ttf`, name]));
const typography = load('admin/adminFontFamily.android', mocks);
test('Admin registers all six exact V2 static faces in an isolated font namespace; retained OFL is the source license', () => {
  const hashes = { Regular: 'dd5ac86cf90395d0003b83075b4e92fbca7c7157869db743670e39bc4d30f05b', Medium: '654567c75cc0eac0567ed0e5e6f8c1ea88f2ffd397a10889e88857bd9c2e0e23', Bold: '39a9f6c8803ec29585d4d0fe07a16927bcf0056c9a9cb4702dc6eef6e76b7c02', Italic: '72bdc3aded3f3905a857ec59997cfcd9aa52d463363888827f6c824bedec2a8e', MediumItalic: '37009c98e65d2408947f8dd51ee7fcdc2a406be773c6a04508a0e27f8585aea0', BoldItalic: 'c09f5411aacd5129b1e13a931c4015a8d895a2522c5885b3ec20134c8f2f2502' };
  assert.equal(Object.keys(typography.adminFontAssets).length, 6);
  for (const name of names) {
    assert.equal(typography.adminFontAssets[`AccordAdminGoogleSans-${name}`], name);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, `../assets/fonts/GoogleSans-${name}.ttf`))).digest('hex'), hashes[name]);
  }
  const license = fs.readFileSync(path.resolve(__dirname, '../assets/fonts/OFL.txt'), 'utf8'); assert.ok(license.includes('SIL OPEN FONT LICENSE Version 1.1')); assert.ok(license.includes('Google Sans Flex Project Authors'));
});
test('Admin native text reproduces V2 theme overrides while explicit source metrics/decoration remain authoritative', () => {
  const a = typography.adminTextStyle, n = typography.adminFontNames;
  assert.deepEqual(a({ typography: 'titleLarge' }, true), { typography: 'titleLarge', fontSize: 20, fontWeight: '700', fontFamily: n.bold });
  assert.deepEqual(a({ typography: 'labelLarge' }, true), { typography: 'labelLarge', fontSize: 16, fontWeight: '500', fontFamily: n.medium });
  assert.deepEqual(a({ typography: 'bodyMedium' }, true), { typography: 'bodyMedium', fontSize: 14, fontWeight: '400', fontFamily: n.regular });
  assert.deepEqual(a({ typography: 'titleLarge', fontSize: 24, fontWeight: '800', lineHeight: 27, textDecoration: 'underline' }, true), { typography: 'titleLarge', fontSize: 24, fontWeight: '800', lineHeight: 27, textDecoration: 'underline', fontFamily: n.bold });
  assert.deepEqual(a({ typography: 'headlineMedium' }, true), { typography: 'headlineMedium', fontSize: 28, fontWeight: '700', letterSpacing: -.6, fontFamily: n.bold });
});
test('source static-weight matching covers every declared weight and italic variant without replacing an explicit custom family', () => {
  const a = typography.adminTextStyle, n = typography.adminFontNames;
  for (const weight of ['100', '200', '300', '400', '500', '600', '700', '800', '900']) {
    const face = Number(weight) > 500 ? n.bold : weight === '500' ? n.medium : n.regular;
    assert.equal(a({ fontWeight: weight }, true).fontFamily, face);
    assert.equal(a({ fontWeight: weight, fontStyle: 'italic' }, true).fontFamily, `${face === n.regular ? 'AccordAdminGoogleSans-' : face}Italic`);
  }
  const custom = { fontFamily: 'source-special', fontSize: 12, fontWeight: '900' }; assert.deepEqual(a(custom, true), custom); assert.deepEqual(a({ fontSize: 12 }, false), { fontSize: 12 });
});
function native(ready, error = null) {
  let contextValue = ready; const calls = [];
  const react = { ...require('react'), createContext: () => ({ Provider: 'FontContext.Provider' }), useContext: () => contextValue };
  const module = compile(path.resolve(__dirname, '../src/admin/AdminTypography.android.tsx'), { react, '@expo/ui/jetpack-compose': { Text: 'NativeComposeText' },
    'expo-font': { useFonts: assets => { calls.push(assets); return [ready, error]; } }, 'react-native': { View: 'View' }, './adminFontFamily.android': typography });
  return { module, calls, setContext: value => { contextValue = value; } };
}
test('Admin font provider loads exact local aliases and retains mounted children hidden/inert until native fonts settle; failure keeps native fallback', () => {
  for (const [ready, error] of [[false, null], [true, null], [false, Error('asset failed')]]) {
    const f = native(ready, error), child = { actual: 'children' }, tree = f.module.AdminTypographyProvider({ children: child }), visible = ready || error != null;
    assert.equal(f.calls[0], typography.adminFontAssets); assert.equal(tree.props.value, ready); const view = tree.props.children;
    assert.equal(view.props.children, child); assert.equal(view.props.style.opacity, visible ? 1 : 0); assert.equal(view.props.pointerEvents, visible ? 'auto' : 'none'); assert.equal(view.props.accessibilityElementsHidden, !visible);
  }
});
test('Admin Text forwards native layout/modifier events/accessibility unchanged and selects the committed font from its real provider context', () => {
  const f = native(true), click = () => {}, props = { style: { typography: 'bodySmall' }, maxLines: 1, minLines: 1, softWrap: false, overflow: 'ellipsis', modifiers: [{ original: true, onClick: click }], color: '#FFFFFF', children: 'Exact source' };
  const tree = f.module.AdminText(props); assert.equal(tree.type, 'NativeComposeText'); for (const key of ['maxLines', 'minLines', 'softWrap', 'overflow', 'modifiers', 'color', 'children']) assert.equal(tree.props[key], props[key]);
  assert.equal(tree.props.style.fontFamily, typography.adminFontNames.regular); f.setContext(false); assert.equal(f.module.AdminText(props).props.style.fontFamily, undefined);
});

test('Admin nested Text aliases survive the installed Expo serializer as real styled spans, including fragments and inherited faces', () => {
  const React = require('react');
  const utils = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/utils/index.ts'), {});
  const fragments = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/utils/flattenFragments.ts'), { react: React });
  const sdk = compile(path.resolve(__dirname, '../node_modules/@expo/ui/src/jetpack-compose/Text/index.tsx'), {
    react: React, expo: { requireNativeView: () => 'RealNativeComposeText' }, '../../utils': utils,
    '../../utils/flattenFragments': fragments, '../modifiers/utils': { createViewModifierEventListener: () => ({}) },
  });
  let ready = true;
  const wrapper = compile(path.resolve(__dirname, '../src/admin/AdminTypography.android.tsx'), {
    react: { ...React, createContext: () => ({ Provider: 'Context' }), useContext: () => ready }, '@expo/ui/jetpack-compose': sdk,
    'expo-font': {}, 'react-native': {}, './adminFontFamily.android': typography,
  });
  const props = { style: { fontWeight: '800', fontSize: 22 }, children: [
    'Before ', React.createElement(React.Fragment, { key: 'fragment' },
      React.createElement(wrapper.AdminText, { key: 'medium', style: { fontWeight: '500', textDecoration: 'underline' }, color: '#112233' }, 'Medium ',
        React.createElement(wrapper.AdminText, { style: { fontStyle: 'italic' } }, 'italic'))),
    React.createElement(wrapper.AdminText, { key: 'inherited' }, 'Inherited'),
    React.createElement(sdk.Text, { key: 'custom', style: { fontFamily: 'source-special', fontWeight: '400' } }, 'Custom'), 7,
  ] };
  const serialize = () => { const native = wrapper.AdminText(props); assert.equal(native.type, sdk.Text); return sdk.Text(native.props).props; };
  const output = serialize(); assert.equal(output.fontFamily, typography.adminFontNames.bold); assert.equal(output.fontWeight, '800');
  assert.equal(output.spans[0].text, 'Before '); assert.equal(output.spans[1].color, '#112233'); assert.equal(output.spans[1].textDecoration, 'underline');
  assert.equal(output.spans[1].fontFamily, typography.adminFontNames.medium); assert.equal(output.spans[1].fontWeight, '500');
  assert.equal(output.spans[1].children[0].text, 'Medium '); assert.equal(output.spans[1].children[1].fontFamily, typography.adminFontNames.mediumItalic);
  assert.equal(output.spans[1].children[1].fontWeight, '500'); assert.equal(output.spans[1].children[1].fontSize, 22);
  assert.equal(output.spans[2].fontFamily, typography.adminFontNames.bold); assert.equal(output.spans[2].fontWeight, '800');
  assert.equal(output.spans[3].fontFamily, 'source-special'); assert.equal(output.spans[4].text, '7');
  ready = false; const fallback = serialize(); assert.equal(fallback.fontFamily, undefined); assert.equal(fallback.spans[1].fontFamily, undefined); assert.equal(fallback.spans[3].fontFamily, 'source-special');
});

/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const s = require('./adminItemCreateNativeSupport.cjs');
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
async function fixture(platform, options = {}) {
  const one = s.owner(options); one.controller.start(); await s.flush(); const generation = one.controller.getSnapshot().generation, r = s.runtime(); let focused = true, available = true;
  const owner = { controller: one.controller }, current = () => one.controller.isCurrent(generation), nativeCurrent = () => focused && current();
  const model = { owner, current, nativeCurrent, state: one.controller.getSnapshot(), a: (key, values) => s.l10n.adminText(key, 'uz', values), closeDialog: outside => { const dialog = one.controller.form.getSnapshot().dialog; if (dialog && nativeCurrent()) one.controller.closeDialog(dialog, outside); } };
  const domain = s.load('admin/AdminItemCreateOverlayController', { '../shared/camera/synchronousGuard': s.strict }), hook = s.load('admin/useAdminItemCreateOverlays', { react: r.react, './AdminItemCreateOverlayController': domain });
  const native = new Proxy({}, { get: (_target, name) => Object.assign(props => ({ type: String(name), props }), { Label: 'Label' }) });
  const observer = {}, portal = { isAvailable: () => available, render: props => ({ type: 'ActualRootPortal', props }) };
  const module = s.compile(path.resolve(__dirname, `../src/admin/AdminItemCreateOverlays.${platform}.tsx`), { react: r.react, '@expo/ui/jetpack-compose': native, '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Modal: 'Modal', View: 'View', Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: s.colors }) }, '../shared/camera/synchronousGuard': s.strict,
    './AdminTypography.android': { AdminText: 'Text' }, './AdminItemCreateDialogCard.android': { AdminItemCreateDialogCard: 'ActualNativeCard' }, './AdminItemCreateDialogCard.ios': { AdminItemCreateDialogCard: 'ActualNativeCard' },
    './AdminItemCreatePicker.android': { AdminItemCreatePicker: 'ActualNativePicker' }, './AdminItemCreatePicker.ios': { AdminItemCreatePicker: 'ActualNativePicker' }, './AdminItemCreateNative.android': { itemCreateRounded: radius => ({ radius }) }, './useAdminItemCreateOverlays': hook });
  return { ...one, model, r, observer, focus: value => { focused = value; }, available: value => { available = value; }, render: () => r.render(() => { model.state = one.controller.getSnapshot(); return s.expand(module.AdminItemCreateOverlays({ model, portal, observer })); }) };
}
test('Android actual portal metadata carries live original create closing/account identity, and forwards original observer to nested picker', async () => {
  const f = await fixture('android'); f.controller.openDialog(); f.render(); let tree = f.render(), portal = s.nodes(tree, node => node.type === 'ActualRootPortal')[0]; const original = portal.props;
  assert.equal(original.kind, 'create'); assert.equal(original.scrimOpacity, .32); assert.equal(original.maxWidth, 440); assert.equal(original.isCurrent(), true); assert.equal(original.isClosing(), false);
  f.controller.openPicker('group', f.controller.form.getSnapshot().dialog); await s.flush(); tree = f.render(); assert.equal(s.nodes(tree, node => node.type === 'ActualNativePicker')[0].props.observer, f.observer);
  const picker = f.controller.getSnapshot().picker; picker.controller.dismiss(); picker.controller.completeClose(); f.render(); original.onDismissRequest(); tree = f.render();
  portal = s.nodes(tree, node => node.type === 'ActualRootPortal')[0]; assert.equal(portal.props.visible, false); assert.equal(original.visible, true); assert.equal(original.isClosing(), true);
  portal.props.onDismissed(); assert.equal(f.controller.getSnapshot().closingDialog, null); f.r.unmount();
});
test('Android missing real portal availability holds presentation rather than inventing a window or completing its domain', async () => {
  const f = await fixture('android'); f.controller.openDialog(); f.render(); f.available(false); assert.equal(f.render(), null);
  assert.ok(f.controller.getSnapshot().form.dialog); f.r.unmount();
});
for (const platform of ['android', 'ios']) test(`${platform} Source confirmation is yesfullwidth then8gap/no, and native completion alone releases accepted move while blurred`, async () => {
  let sends = 0; const f = await fixture(platform, { list: s.listOwner({ move: async () => { sends++; return { updated_count: 1, failed_count: 0, updated_item_codes: ['A'] }; } }).deps });
  f.controller.list.toggleItem(s.item('A')); f.controller.list.changeGroup('G'); await s.flush(); f.controller.list.requestMove(); f.render(); let tree = f.render();
  const yes = s.nativeId(tree, 'admin-items-move-confirm'), no = s.nativeId(tree, 'admin-items-move-cancel'); assert.ok(yes); assert.ok(no);
  const buttons = s.nodes(tree, node => node === yes || node === no); assert.deepEqual(buttons, [yes, no]);
  assert.ok(yes.props.modifiers.some(value => platform === 'android' ? value.name === 'fillMaxWidth' : value.name === 'frame' && value.args[0].maxWidth === Infinity && value.args[0].minHeight === 56));
  assert.ok(s.nodes(tree, node => node.type === 'Spacer' && node.props.modifiers?.some(value => platform === 'android' ? value.name === 'height' && value.args[0] === 8 : value.name === 'frame' && value.args[0].height === 8)).length);
  yes.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.equal(sends, 0); tree = f.render(); const nativeWindow = s.nodes(tree, node => node.type === (platform === 'android' ? 'ActualRootPortal' : 'Modal'))[0];
  assert.equal(nativeWindow.props[platform === 'android' ? 'visible' : 'visible'], false); f.focus(false);
  if (platform === 'android') { assert.equal(nativeWindow.props.isClosing(), true); nativeWindow.props.onDismissed(); } else nativeWindow.props.onDismiss();
  await s.flush(); assert.equal(sends, 1); f.r.unmount();
});

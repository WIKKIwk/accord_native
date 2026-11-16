/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const s = require('./adminItemCreateSupport.cjs');
const view = require('./adminSupplierDetailViewSupport.cjs');
function fixture() {
  const r = view.runtime(), arm = s.deferred(), detached = s.deferred(), native = []; let receipt, valid = true, closing = false, interact = true, completed = 0, requested = 0;
  const observer = { arm: (viewTag, ticket) => { receipt = { protocol: 1, guarantee: 'window-tree-detach', handle: 'original-dialog', viewTag, ticket, state: 'armed' }; native.push('arm'); return arm.promise; }, waitForDetach: value => { assert.equal(value, receipt); native.push('wait'); return detached.promise; }, cancelPending: async () => { native.push('cancelPending'); return true; }, cancel: async () => { native.push('cancel'); return true; } };
  const domain = s.load('admin/adminPresentationWindowOwner', { '../shared/camera/synchronousGuard': s.strict }), hook = s.load('admin/useAdminPresentationWindow', { react: r.react, './adminPresentationWindowOwner': domain });
  const props = { presentation: { identity: {}, kind: 'create', visible: true, isCurrent: () => valid, isClosing: () => closing, canInteract: () => interact, scrimOpacity: .32, horizontalInset: 20, maxWidth: 440,
    onDismissRequest: () => { requested++; }, onDismissed: () => { completed++; }, children: { type: 'ActualNativeComposeCard', props: {} } }, observer };
  const module = view.compile(path.resolve(__dirname, '../src/admin/AdminItemCreateDialogWindow.android.tsx'), { react: r.react,
    'react-native': { View: value => { if (value.ref) value.ref.current = { tag: 123 }; return { type: 'View', props: value }; }, findNodeHandle: value => value?.tag ?? null, Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../shared/camera/synchronousGuard': s.strict, './adminPresentationWindowTicket': { createAdminPresentationWindowTicket: () => 'item-create-original-window' }, './useAdminPresentationWindow': hook });
  return { r, props, native, arm, detached, receipt: () => receipt, render: () => r.render(() => view.expand(module.AdminItemCreateDialogWindow(props))), valid: value => { valid = value; }, closing: value => { closing = value; }, interact: value => { interact = value; }, completed: () => completed, requested: () => requested };
}
test('Android RN carrier is one genuine transparent nativeDialog with Source explicit .32/.54 scrim; no stacked Compose Dialog', () => {
  const installed = fs.readFileSync(path.resolve(__dirname, '../node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/modal/ReactModalHostView.kt'), 'utf8');
  assert.match(installed, /if \(transparent\)\s*\{\s*dialogWindow\.clearFlags\(WindowManager\.LayoutParams\.FLAG_DIM_BEHIND\)/);
  for (const opacity of [.32, .54]) { const f = fixture(); f.props.presentation = { ...f.props.presentation, scrimOpacity: opacity }; const tree = f.render(), modal = view.nodes(tree, node => node.type === 'Modal')[0];
    assert.equal(modal.props.transparent, true); assert.equal(view.nodes(tree, node => node.type === 'Modal').length, 1); assert.equal(view.nodes(tree, node => node.type === 'BasicAlertDialog' || node.type === 'AlertDialog').length, 0);
    assert.ok(view.nodes(tree, node => node.type === 'View' && Array.isArray(node.props.style) && node.props.style[1]?.backgroundColor === `rgba(0,0,0,${opacity})`).length); f.r.unmount();
  }
});
test('native onShow + actual markerTag precede arming; accepted closing retains original untilarmACK thenRootdetach alone completes', async () => {
  const f = fixture(); let tree = f.render(), modal = view.nodes(tree, node => node.type === 'Modal')[0], marker = view.nodes(tree, node => node.props.nativeID)[0];
  assert.equal(marker.props.collapsable, false); marker.props.onLayout(); assert.deepEqual(f.native, []); modal.props.onShow(); tree = f.render(); assert.deepEqual(f.native, ['arm']);
  f.closing(true); f.props.presentation = { ...f.props.presentation, visible: false }; tree = f.render(); assert.equal(view.nodes(tree, node => node.type === 'Modal').length, 1); assert.equal(f.completed(), 0);
  f.arm.resolve(f.receipt()); await s.flush(); assert.equal(f.render(), null); assert.deepEqual(f.native, ['arm', 'wait']); assert.equal(f.completed(), 0);
  f.detached.resolve({ ...f.receipt(), state: 'detached' }); await s.flush(); assert.equal(f.completed(), 1); f.r.unmount();
});
test('original native completion never retargets a later body callback and account retirement blocks all pending completion', async () => {
  const f = fixture(); let next = 0; let tree = f.render(); view.nodes(tree, node => node.type === 'Modal')[0].props.onShow(); f.render(); f.arm.resolve(f.receipt()); await s.flush();
  f.closing(true); f.props.presentation = { ...f.props.presentation, visible: false, onDismissed: () => { next++; } }; f.render(); f.detached.resolve({ ...f.receipt(), state: 'detached' }); await s.flush(); assert.equal(f.completed(), 1); assert.equal(next, 0); f.r.unmount();
  const other = fixture(); tree = other.render(); view.nodes(tree, node => node.type === 'Modal')[0].props.onShow(); other.render(); other.arm.resolve(other.receipt()); await s.flush(); other.closing(true); other.props.presentation = { ...other.props.presentation, visible: false }; other.render(); other.valid(false); other.detached.resolve({ ...other.receipt(), state: 'detached' }); await s.flush(); assert.equal(other.completed(), 0); other.r.unmount();
});
test('native Back/outside use original account and top-interaction guard; neither is a completion event', () => {
  const f = fixture(), tree = f.render(), modal = view.nodes(tree, node => node.type === 'Modal')[0], backdrop = view.nodes(tree, node => node.type === 'Pressable')[0];
  modal.props.onRequestClose(); backdrop.props.onPress(); assert.equal(f.requested(), 2); assert.equal(f.completed(), 0); f.interact(false); modal.props.onRequestClose(); assert.equal(f.requested(), 2); f.interact(true); f.valid(false); backdrop.props.onPress(); assert.equal(f.requested(), 2); f.r.unmount();
});

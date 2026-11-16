const test = require('node:test'), assert = require('node:assert/strict'), s = require('./adminFixedSnackBarNativeSupport.cjs');
const find = (tree, id) => s.nodes(tree, node => node.props?.testID === id)[0];
test('real driver connects before the first Source page/geometry, and pending ordinary FIFO never fabricates a rendered position', () => {
  const f = s.fixture(); assert.equal(f.render().type, 'ActualNativeStack'); const target = f.target(); assert.equal(target.isAvailable(), true);
  target.enqueue({ identity: {}, message: 'queued before native pair' }); f.render(); assert.equal(f.queue.getSnapshot().phase, 'entering'); assert.equal(f.animations.length, 0); assert.equal(f.clock.size(), 0);
  const h = f.makeHost(); h.render(); let tree = h.render(); assert.equal(s.nodes(tree, node => node.type === 'FixedMotion').length, 0); assert.equal(f.observations.length, 0);
  const marker = find(tree, 'admin-fixed-snackbar-window-marker'); assert.equal(marker.props.collapsable, false); marker.props.ref.current = { actualNativeTag: 91 }; marker.props.onLayout(); h.render();
  assert.equal(f.observations.length, 1); const observation = f.observations[0]; assert.equal(observation.request.nativeTag, 91); assert.equal(observation.request.scaffold, f.scaffold); assert.equal(observation.request.sourceLayout, h.props.sourceLayout);
  observation.receive(null); tree = h.render(); assert.equal(s.nodes(tree, node => node.type === 'FixedMotion').length, 0);
  observation.receive(f.facts); tree = h.render(); const body = s.nodes(tree, node => node.type === 'FixedMotion')[0]; assert.ok(body); f.render(); assert.equal(f.animations.length, 0);
  const motion = measuredMotion(f, body.props); f.render(); assert.equal(f.animations.length, 1); assert.equal(f.animations[0].config.duration, 250);
  f.finish(); f.ack(); assert.equal(f.queue.getSnapshot().phase, 'visible'); assert.equal(f.clock.size(), 0); f.render(); assert.equal(f.clock.size(), 1); f.clock.advance(3999); assert.equal(f.queue.getSnapshot().phase, 'visible'); f.clock.advance(1); assert.equal(f.queue.getSnapshot().phase, 'exiting');
  motion.runtime.unmount(); h.runtime.unmount(); f.cleanup();
});
test('unknown window/dock facts, strict unavailable reader and duplicate actual Provider cannot produce fake availability or motion', () => {
  const f = s.fixture(); f.render(); f.readerAvailable(false); assert.equal(f.target().isAvailable(), false); f.target().enqueue({ identity: {}, message: 'not accepted' }); assert.equal(f.queue.getSnapshot().head, null);
  f.readerAvailable(true); const duplicate = s.runtime(); assert.equal(f.renderWith(duplicate), null); assert.equal(f.renderWith(duplicate), null); duplicate.unmount();
  f.target().enqueue({ identity: {}, message: 'actual owner' }); const h = f.makeHost(); h.render(); let tree = h.render(), marker = find(tree, 'admin-fixed-snackbar-window-marker'); marker.props.ref.current = { actualNativeTag: 92 }; marker.props.onLayout(); h.render();
  const observation = f.observations.at(-1); observation.receive(s.pair({}, { dock: { windowIdentity: {}, height: 199 } })); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 0);
  observation.receive(s.pair(f.window, { dock: { windowIdentity: f.window, height: 201 } })); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 0);
  observation.receive(f.facts); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 1); h.runtime.unmount(); f.cleanup();
});
test('actual host cleanup/replay retires old marker/reader callbacks without losing the ordinary global FIFO', () => {
  const f = s.fixture(); f.render(); f.target().enqueue({ identity: {}, message: 'owned by global Messenger' }); const h = f.makeHost(); h.render(); let tree = h.render(); const oldMarker = find(tree, 'admin-fixed-snackbar-window-marker');
  oldMarker.props.ref.current = { actualNativeTag: 93 }; oldMarker.props.onLayout(); h.render(); const oldRead = f.observations.at(-1); oldRead.receive(f.facts); h.render(); const accepted = f.queue.getSnapshot().head;
  h.runtime.replay(); tree = h.render(); h.render(); assert.equal(oldRead.stopped, true); assert.equal(oldRead.request.isCurrent(), false); const count = f.observations.length;
  oldRead.receive(f.facts); oldMarker.props.onLayout(); h.render(); assert.equal(f.observations.length, count); assert.equal(f.queue.getSnapshot().head, accepted); assert.equal(f.queue.getSnapshot().retired, false);
  const freshRead = f.observations.at(-1); assert.notEqual(freshRead, oldRead); freshRead.receive(f.facts); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 1);
  h.runtime.unmount(); f.cleanup();
});
test('real native completion, cancellation, remaining reverse distance and actual reduced-animation facts govern global transitions', () => {
  const f = s.fixture(); f.render(); f.queue.setGeometry(f.host, f.facts); f.target().enqueue({ identity: {}, message: 'first' }); const firstMotion = measuredMotion(f); f.render(); const entry = f.queue.getSnapshot().head, enter = f.animations.at(-1);
  f.finish(enter, false); f.ack(); assert.equal(f.queue.getSnapshot().phase, 'entering'); assert.equal(f.clock.size(), 0);
  enter.state.value = .4; f.queue.hide(entry); f.render(); const exit = f.animations.at(-1); assert.equal(exit.target, 0); assert.equal(exit.config.duration, 100);
  f.finish(enter, true); f.ack(); assert.equal(f.queue.getSnapshot().head, entry); f.finish(exit); f.ack(); assert.equal(f.queue.getSnapshot().head, null);
  firstMotion.runtime.unmount(); f.props.disableAnimations = true; f.target().enqueue({ identity: {}, message: 'second' }); const secondMotion = measuredMotion(f); f.render(); assert.equal(f.animations.at(-1).config.duration, 12.5); assert.equal(f.animations.at(-1).config.reduceMotion, 'never'); secondMotion.runtime.unmount(); f.cleanup();
});
for (const platform of ['android', 'ios']) test(`${platform} fixed Material/native content uses real resolved inverse roles,24/14+remaining L/R safe padding and frozen message without a banner font cap`, () => {
  const f = s.fixture(platform), entry = { identity: {}, sourceIdentity: {}, message: 'Frozen ordinary message' }, tree = f.contentTree(entry);
  if (platform === 'android') {
    const material = s.nodes(tree, node => node.type === 'Surface')[0], text = s.nodes(tree, node => node.type === 'RNText')[0], host = s.nodes(tree, node => node.type === 'RNHostView')[0];
    assert.equal(material.props.color, f.props.palette.inverseSurface); assert.equal(material.props.shadowElevation, 6); assert.equal(material.props.tonalElevation, 0);
    assert.deepEqual(host.props.modifiers.find(mod => mod.name === 'padding').args, [35, 14, 47, 14]); assert.equal(text.props.children, entry.message); assert.equal(text.props.maxFontSizeMultiplier, undefined);
    assert.deepEqual(s.flattenStyle(text.props.style), { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: .25, includeFontPadding: false, color: '#FAFAFA', fontFamily: 'ActualAdminRegular', textAlign: 'left', writingDirection: 'ltr' });
  } else {
    const text = s.nodes(tree, node => node.type === 'Text')[0]; assert.equal(text.props.children, entry.message); assert.deepEqual(text.props.modifiers.find(mod => mod.name === 'padding').args, [{ leading: 35, top: 14, trailing: 47, bottom: 14 }]);
    assert.deepEqual(text.props.modifiers.find(mod => mod.name === 'foregroundStyle').args, ['#FAFAFA']);
  }
  f.theme.direction = 'rightToLeft'; const rtl = f.contentTree(entry);
  if (platform === 'android') assert.deepEqual(s.nodes(rtl, node => node.type === 'RNHostView')[0].props.modifiers.find(mod => mod.name === 'padding').args, [47, 14, 35, 14]);
  else assert.deepEqual(s.nodes(rtl, node => node.type === 'Text')[0].props.modifiers.find(mod => mod.name === 'padding').args, [{ leading: 47, top: 14, trailing: 35, bottom: 14 }]);
  f.cleanup();
});
function measuredMotion(f, patch = {}, height = 48) {
  const motion = f.makeMotion(undefined, patch); motion.render(); const tree = motion.render(); s.nodes(tree, node => node.type === 'View')[0].props.onLayout({ nativeEvent: { layout: { height } } }); motion.render(); return motion;
}
function visibleMotion(height = 48) {
  const f = s.fixture(); f.render(); f.queue.setGeometry(f.host, f.facts); f.target().enqueue({ identity: {}, message: 'native swipe' }); const motion = measuredMotion(f, {}, height); f.render(); f.finish(); f.ack(); f.render(); const tree = motion.render();
  return { f, motion, tree };
}
test('actual native fixed host clips from Source topStart at measured height, uses exact contentBottom and has immediate semantic dismissal', () => {
  const { f, motion, tree } = visibleMotion(), bar = find(tree, 'admin-fixed-snackbar'); assert.deepEqual(s.flattenStyle(bar.props.style), { position: 'absolute', overflow: 'hidden', left: 0, width: 400, bottom: 199, height: 48, opacity: 1 });
  assert.equal(bar.props.accessibilityLiveRegion, 'polite'); assert.equal(bar.props.accessibilityLabel, 'native swipe'); assert.deepEqual(bar.props.accessibilityActions, [{ name: 'dismiss', label: 'Dismiss real message' }]);
  const top = s.nodes(tree, node => node.type === 'GestureHandlerRootView')[0]; assert.equal(s.flattenStyle(top.props.style).top, 0); assert.equal(s.flattenStyle(top.props.style).bottom, undefined); assert.equal(s.nodes(top, node => node.type === 'GestureDetector').length, 1);
  f.visibilityChange({ top: false }); bar.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }); assert.ok(f.queue.getSnapshot().head);
  f.visibilityChange({ top: true }); bar.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }); assert.equal(f.queue.getSnapshot().head, null); assert.equal(f.clock.size(), 0); motion.runtime.unmount(); f.cleanup();
});
test('actual native down-drag uses strict Source.4 and200ms remaining distance; only real last movement frame dismisses', () => {
  const { f, motion } = visibleMotion(50); let gesture = f.gestures.at(-1); gesture.onActivate(); gesture.onUpdate({ changeY: 20 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 0 });
  f.frame(0); f.frame(80); assert.ok(f.queue.getSnapshot().head); assert.equal(f.tasks.length, 0); let tree = motion.render(); assert.equal(s.flattenStyle(s.nodes(tree, node => node.type === 'Animated.View')[1].props.style).transform[0].translateY, 0);
  gesture = f.gestures.at(-1); gesture.onActivate(); gesture.onUpdate({ changeY: 25 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 0 });
  f.frame(0); f.frame(99); f.ack(); assert.ok(f.queue.getSnapshot().head); f.frame(1); assert.ok(f.queue.getSnapshot().head); f.ack(); assert.equal(f.queue.getSnapshot().head, null); motion.runtime.unmount(); f.cleanup();
});
test('real Source ticker visibility mutes local frames then catches up elapsed time; global4s display deadline keeps running independently', () => {
  const { f, motion } = visibleMotion(), gesture = f.gestures.at(-1); gesture.onActivate(); gesture.onUpdate({ changeY: 24 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 0 });
  f.frame(0); f.visibilityChange({ ticker: false, top: false }); motion.render(); f.frame(2000); f.ack(); assert.ok(f.queue.getSnapshot().head); assert.equal(f.queue.getSnapshot().phase, 'visible');
  f.visibilityChange({ ticker: true }); motion.render(); f.frame(1); assert.ok(f.queue.getSnapshot().head); f.ack(); assert.equal(f.queue.getSnapshot().head, null); motion.runtime.unmount(); f.cleanup();
  const background = visibleMotion(); background.f.visibilityChange({ ticker: false, top: false }); background.motion.render(); background.f.clock.advance(4000); assert.equal(background.f.queue.getSnapshot().phase, 'exiting'); assert.equal(background.f.tasks.length, 0); background.motion.runtime.unmount(); background.f.cleanup();
});
test('actual native fling requires Source700/400 velocities and springs on frames rather than using a completion timer', () => {
  const { f, motion } = visibleMotion(); let gesture = f.gestures.at(-1); gesture.onActivate(); gesture.onUpdate({ changeY: 5 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 700 });
  f.frame(16); f.ack(); assert.ok(f.queue.getSnapshot().head); assert.equal(f.clock.size(), 1); for (let frame = 0; frame < 90 && f.queue.getSnapshot().head; frame++) { f.frame(16); f.ack(); }
  assert.equal(f.queue.getSnapshot().head, null); motion.runtime.unmount(); f.cleanup();
  const reverse = visibleMotion(); gesture = reverse.f.gestures.at(-1); gesture.onActivate(); gesture.onUpdate({ changeY: 30 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: -700 });
  for (let frame = 0; frame < 90; frame++) { reverse.f.frame(16); reverse.f.ack(); } assert.ok(reverse.f.queue.getSnapshot().head); reverse.motion.runtime.unmount(); reverse.f.cleanup();
});
test('retained original native gesture/semantic callbacks cannot adopt StrictMode replay or remove a later FIFO entry', () => {
  const { f, motion, tree } = visibleMotion(), oldGesture = f.gestures.at(-1), oldBar = find(tree, 'admin-fixed-snackbar'); motion.runtime.replay(); motion.render(); motion.render();
  oldGesture.onActivate(); oldGesture.onUpdate({ changeY: 100 }); oldGesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 900 }); f.frame(1000); f.ack(); oldBar.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }); assert.ok(f.queue.getSnapshot().head);
  const first = f.queue.getSnapshot().head; f.queue.remove(first); f.target().enqueue({ identity: {}, message: 'new FIFO message' }); oldBar.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }); assert.equal(f.queue.getSnapshot().head.message, 'new FIFO message'); motion.runtime.unmount(); f.cleanup();
});
test('native layout receipt loss rejects an already-scheduled entry completion; a fresh real layout resumes the same global controller without restarting it at zero', () => {
  const f = s.fixture(); f.render(); f.queue.setGeometry(f.host, f.facts); f.target().enqueue({ identity: {}, message: 'must actually lay out' });
  const old = measuredMotion(f); f.render(); const entering = f.animations.at(-1); old.runtime.unmount(); f.finish(entering); f.ack(); assert.equal(f.queue.getSnapshot().phase, 'entering'); assert.equal(f.clock.size(), 0);
  const fresh = measuredMotion(f); f.render(); const continuation = f.animations.at(-1); assert.notEqual(continuation, entering); assert.equal(continuation.config.duration, 0);
  f.finish(continuation); f.ack(); assert.equal(f.queue.getSnapshot().phase, 'visible'); assert.equal(f.clock.size(), 0); f.render(); assert.equal(f.clock.size(), 1); fresh.runtime.unmount(); f.cleanup();
});
test('a genuine accepted swipe completion survives Source top loss while newly retained native drag callbacks cannot accept a background interaction', () => {
  const accepted = visibleMotion(), gesture = accepted.f.gestures.at(-1); assert.equal(gesture.runOnJS, true); gesture.onActivate(); gesture.onUpdate({ changeY: 24 }); gesture.onDeactivate({ canceled: false, velocityX: 0, velocityY: 0 });
  accepted.f.frame(0); accepted.f.visibilityChange({ top: false }); accepted.motion.render(); accepted.f.frame(100); accepted.f.ack(); assert.equal(accepted.f.queue.getSnapshot().head, null); accepted.motion.runtime.unmount(); accepted.f.cleanup();
  const background = visibleMotion(), retained = background.f.gestures.at(-1); background.f.visibilityChange({ top: false }); retained.onActivate(); retained.onUpdate({ changeY: 100 }); retained.onDeactivate({ canceled: false, velocityX: 0, velocityY: 900 }); background.f.frame(1000); background.f.ack();
  assert.ok(background.f.queue.getSnapshot().head); background.motion.runtime.unmount(); background.f.cleanup();
});
test('unknown dock layout invalidates current paired geometry and late reader callbacks cannot restore the old Source snapshot', () => {
  const f = s.fixture(); f.render(); f.target().enqueue({ identity: {}, message: 'current paired geometry only' }); const h = f.makeHost(); h.render(); let tree = h.render(); const marker = find(tree, 'admin-fixed-snackbar-window-marker');
  marker.props.ref.current = { actualNativeTag: 94 }; marker.props.onLayout(); h.render(); const old = f.observations.at(-1); old.receive(f.facts); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 1);
  h.props.sourceLayout = { metrics: null, hostHeight: null }; h.render(); assert.equal(old.stopped, true); old.receive(f.facts); assert.equal(s.nodes(h.render(), node => node.type === 'FixedMotion').length, 0); assert.ok(f.queue.getSnapshot().head); assert.equal(f.queue.getSnapshot().retired, false); h.runtime.unmount(); f.cleanup();
});
test('native host replacement captures a fresh original owner; no old marker/read can adopt the replacement even when its callback later says true', () => {
  const f = s.fixture(); f.render(); f.target().enqueue({ identity: {}, message: 'original owner' }); const h = f.makeHost(); h.render(); let tree = h.render(), marker = find(tree, 'admin-fixed-snackbar-window-marker');
  marker.props.ref.current = { actualNativeTag: 95 }; marker.props.onLayout(); h.render(); const old = f.observations.at(-1); old.receive(f.facts); const oldMotion = s.nodes(h.render(), node => node.type === 'FixedMotion')[0];
  h.props.isCurrent = () => true; h.render(); h.render(); assert.equal(old.request.isCurrent(), false); old.receive(f.facts); marker.props.onLayout(); tree = h.render(); assert.equal(s.nodes(tree, node => node.type === 'FixedMotion').length, 0);
  const fresh = f.observations.at(-1); assert.notEqual(fresh, old); assert.notEqual(fresh.request.identity, old.request.identity); fresh.receive(f.facts); const freshMotion = s.nodes(h.render(), node => node.type === 'FixedMotion')[0]; assert.ok(freshMotion); assert.equal(typeof freshMotion.key, 'string'); assert.notEqual(freshMotion.key, oldMotion.key); assert.notEqual(freshMotion.props.host, oldMotion.props.host); h.runtime.unmount(); f.cleanup();
});
test('plain accessible Source SnackBar retains its4s timer and removes immediately at deadline rather than inheriting action persistence', () => {
  const f = s.fixture('android', { accessible: true }); f.render(); f.queue.setGeometry(f.host, f.facts); f.target().enqueue({ identity: {}, message: 'accessible no action' }); const motion = measuredMotion(f); f.render(); f.finish(); f.ack(); f.render();
  f.clock.advance(3999); assert.ok(f.queue.getSnapshot().head); f.clock.advance(1); assert.equal(f.queue.getSnapshot().head, null); assert.equal(f.queue.getSnapshot().phase, 'idle'); motion.runtime.unmount(); f.cleanup();
});

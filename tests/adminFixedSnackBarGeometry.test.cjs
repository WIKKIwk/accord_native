const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminFixedSnackBarSupport.cjs');

test('actual contentBottom uses max(rawIME,source dock), with Source equality and clamp boundaries', () => {
  for (const [ime, dock, expected] of [[0, 199, 199], [199, 199, 199], [300, 199, 300], [801, 199, 800], [0, 0, 0]]) {
    const pair = s.pair(); pair.window.rawImeBottom = ime; pair.dock.height = dock; const value = s.geometry.adminFixedSnackBarGeometry(pair); assert.equal(value.bottom, expected); assert.equal(value.width, 400); assert.equal(value.safeLeft, 11); assert.equal(value.safeRight, 23);
  }
});
test('already resized native host subtracts no second IME and partial resizing maps the same real window anchor exactly', () => {
  const pair = s.pair(); pair.window.rawImeBottom = 300; pair.host.frame.height = 500; assert.equal(s.geometry.adminFixedSnackBarGeometry(pair).bottom, 0);
  pair.host.frame.height = 700; assert.equal(s.geometry.adminFixedSnackBarGeometry(pair).bottom, 200);
  pair.window.viewport = { x: 20, y: 10, width: 360, height: 790 }; pair.host.frame = { x: 30, y: 100, width: 340, height: 400 }; const result = s.geometry.adminFixedSnackBarGeometry(pair); assert.equal(result.bottom, 0); assert.equal(result.left, -10); assert.equal(result.width, 360);
});
test('missing, malformed, cross-window Activity/dialog facts and forbidden raw bottom SafeArea remain unavailable', () => {
  assert.equal(s.geometry.adminFixedSnackBarGeometry(null), null);
  for (const change of [p => { p.host.windowIdentity = {}; }, p => { p.dock.windowIdentity = {}; }, p => { p.window.rawImeBottom = NaN; }, p => { p.host.frame.height = 0; }, p => { p.remainingSafeArea.bottom = 20; }, p => { p.dock.height = null; }, p => { p.window.viewport.width = 0; }]) {
    const pair = s.pair(); change(pair); assert.equal(s.geometry.adminFixedSnackBarGeometry(pair), null);
  }
});
test('Source down-only drag does not cross zero; strict40percent and700/400 fling boundaries use actual logical native facts', () => {
  const m = s.fixedModel; assert.equal(m.adminFixedSnackBarDragExtent(10, -10), 10); assert.equal(m.adminFixedSnackBarDragExtent(10, -11), 10); assert.equal(m.adminFixedSnackBarDragExtent(10, -9), 1);
  assert.equal(m.adminFixedSnackBarSwipeMotion(40, 100, 0, 0).target, 0); assert.equal(m.adminFixedSnackBarSwipeMotion(40.001, 100, 0, 0).target, 1);
  assert.equal(m.adminFixedSnackBarSwipeMotion(1, 100, 300, 700).kind, 'fling'); assert.equal(m.adminFixedSnackBarSwipeMotion(1, 100, 301, 700).kind, 'timing'); assert.equal(m.adminFixedSnackBarSwipeMotion(1, 100, 0, 699).kind, 'timing');
  assert.equal(m.adminFixedSnackBarSwipeMotion(70, 100, 0, -700).target, 0); assert.equal(m.adminFixedSnackBarSwipeMotion(100, 100, 0, 0).kind, 'immediate'); assert.equal(m.adminFixedSnackBarSwipeMotion(0, 0, 0, 0), null);
});
test('native frame-driven default spring is critically damped, approaches beyond bound and completes distance-only at.01 without a duration timer', () => {
  const m = s.fixedModel, start = m.adminFixedSnackBarFlingFrame(.2, 1, 700 / 300, 0); assert.ok(Math.abs(start.value - .2) < 1e-12); assert.equal(start.done, false);
  const forward = m.adminFixedSnackBarFlingFrame(.2, 1, 700 / 300, 1); assert.equal(forward.done, true); assert.equal(forward.value, 1);
  const reverse = m.adminFixedSnackBarFlingFrame(.7, 0, -700 / 300, 1); assert.equal(reverse.done, true); assert.equal(reverse.value, 0);
});

/* global __dirname */
const assert = require('node:assert/strict'), path = require('node:path'), test = require('node:test');
const s = require('./adminSourceDockScaffoldSupport.cjs');
const compile = require('./adminShellFrameViewSupport.cjs').compile;
function fixture() {
  let scope = null; const legacy = { current: { top: 999, left: 888, right: 777, bottom: 666 } };
  const exports = s.views.compile(path.resolve(__dirname, '../src/admin/AdminShellInlineSafeArea.tsx'), { react: { useContext: value => value.current },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: legacy },
    './AdminShellSourceWindowLayoutContext': { useAdminShellSourceWindowLayout: () => scope } });
  return { ...exports, legacy, scope: value => { scope = value; } };
}
test('legacy inline header preserves genuine native SafeArea placement and inherited values only when no original-window scope exists', () => {
  const f = fixture(), header = { type: 'GenuineNativeHeaderFixture', props: {} }, facts = f.useAdminShellInlineSafeArea();
  assert.equal(facts.sourceWindow, false); assert.equal(facts.top, 999); assert.deepEqual(facts.inlineInsets, { left: 888, right: 777 });
  const tree = f.AdminShellInlineSafeArea({ children: header, testID: 'header' }); assert.equal(tree.type, 'SafeAreaView'); assert.deepEqual(tree.props.edges, ['left', 'right']); assert.equal(tree.props.children, header);
  f.legacy.current = null; assert.throws(() => f.useAdminShellInlineSafeArea(), /genuine legacy SafeArea/);
});
test('actual Reader viewport supplies header top/LR and banner width before dock ACK, never borrowing Activity values', async t => {
  const f = fixture(), source = s.fixture(), projection = compile('AdminShellSourceWindowLayoutContext.tsx', { react: { createContext: value => ({ value }) } }); t.after(source.cleanup);
  source.viewport(); await s.flush(); const snapshot = source.scaffoldOwner.getSnapshot(), actual = projection.adminShellSourceWindowLayout(snapshot, true, false, source.scaffoldOwner.current());
  assert.equal(actual.metrics, null); f.scope(actual); const facts = f.useAdminShellInlineSafeArea(); assert.equal(facts.top, 30); assert.deepEqual(facts.inlineInsets, { left: 11, right: 23, width: 400 });
  const header = { type: 'GenuineNativeBackHeaderFixture', props: {} }, tree = f.AdminShellInlineSafeArea({ children: header }); assert.equal(tree.type, 'View'); assert.deepEqual(tree.props.style, { paddingLeft: 11, paddingRight: 23 }); assert.equal(tree.props.children, header);
});
test('explicit unknown original-window geometry keeps header/back mounted with undefined padding and held banner even without legacy provider', () => {
  const f = fixture(), header = { type: 'GenuineNativeBackHeaderFixture', props: {} }; f.legacy.current = null; f.scope({ safeInsets: null, viewportWidth: null, metrics: null, thinGestureBottom: null });
  const facts = f.useAdminShellInlineSafeArea(); assert.equal(facts.sourceWindow, true); assert.equal(facts.top, null); assert.equal(facts.left, null); assert.equal(facts.inlineInsets, null);
  const tree = f.AdminShellInlineSafeArea({ children: header }); assert.equal(tree.type, 'View'); assert.equal(tree.props.children, header); assert.equal(tree.props.style.paddingLeft, undefined); assert.equal(tree.props.style.paddingRight, undefined); assert.equal(tree.props.pointerEvents, undefined);
});
test('unknown or malformed actual viewport width never substitutes Activity width; genuine top/LR may still position header', () => {
  const f = fixture();
  for (const width of [null, NaN, 0, -10, 10]) {
    f.scope({ safeInsets: { top: 31, left: 11, right: 23 }, viewportWidth: width, metrics: null, thinGestureBottom: true });
    const facts = f.useAdminShellInlineSafeArea(); assert.equal(facts.top, 31); assert.equal(facts.left, 11); assert.equal(facts.inlineInsets, null);
  }
});

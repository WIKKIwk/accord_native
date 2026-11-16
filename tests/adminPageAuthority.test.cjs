/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
function fixture() {
  const runtime = s.runtime(); let valid = false, focused = true;
  const source = { isCurrent: () => valid, canInteract: () => focused }, hook = s.load('admin/useAdminPageAuthority', { react: runtime.react, '../shared/camera/synchronousGuard': s.strict });
  return { runtime, source, render: () => runtime.render(() => hook.useAdminPageAuthority(source.isCurrent, source.canInteract)), valid: value => { valid = value; }, focus: value => { focused = value; } };
}
test('descendants are held until original layout admission; parent blur blocks interaction without retiring reads', () => {
  const f = fixture(), before = f.render(); assert.equal(before.current(), false); assert.equal(before.interactive(), false);
  f.valid(true); const admitted = f.render(); assert.equal(admitted.current(), true); assert.equal(admitted.interactive(), true); assert.equal(before.current(), false);
  f.focus(false); assert.equal(admitted.current(), true); assert.equal(admitted.interactive(), false); f.focus(true); assert.equal(admitted.interactive(), true); f.runtime.unmount();
});
test('StrictMode replay and actual native unmount invalidate every callback from the prior layout lifetime', () => {
  const f = fixture(); f.valid(true); f.render(); const old = f.render(); assert.equal(old.current(), true);
  f.runtime.replayCleanup(); assert.equal(old.current(), false); f.runtime.replaySetup(); const fresh = f.render();
  assert.equal(old.current(), false); assert.equal(old.interactive(), false); assert.equal(fresh.current(), true);
  f.runtime.unmount(); assert.equal(fresh.current(), false); assert.equal(fresh.interactive(), false);
});
test('async host predicates fail closed and a guard that retires the page cannot authorize queued interaction', () => {
  const f = fixture(); f.valid(true); f.source.canInteract = async () => true; f.render(); assert.equal(f.render().interactive(), false);
  f.source.canInteract = () => { f.runtime.unmount(); return true; }; assert.equal(f.render().interactive(), false);
  const g = fixture(); g.source.isCurrent = async () => true; g.render(); assert.equal(g.render().current(), false); g.runtime.unmount();
});
test('actual optional back context registers the real handler, releases its original lease, and preserves absent-context defaults', () => {
  const runtime = s.runtime(); let register = null, active = null, cleanups = 0, calls = 0;
  const react = { ...runtime.react, createContext: fallback => ({ fallback, Provider: 'Provider' }), useContext: () => register };
  const { useAdminOwnedBack, AdminOwnedBackProvider } = s.compile(path.resolve(__dirname, '../src/admin/AdminOwnedBackContext.tsx'), { react });
  const handler = () => { calls++; return true; };
  runtime.render(() => useAdminOwnedBack(handler)); assert.equal(active, null);
  register = fn => { active = fn; return () => { cleanups++; if (active === fn) active = null; }; };
  runtime.render(() => useAdminOwnedBack(handler)); assert.equal(active, handler); assert.equal(active(), true); assert.equal(calls, 1);
  runtime.replay(); assert.equal(cleanups, 1); assert.equal(active, handler); runtime.unmount(); assert.equal(cleanups, 2); assert.equal(active, null);
  const child = {}; const provider = AdminOwnedBackProvider({ register, children: child }); assert.equal(provider.props.value, register); assert.equal(provider.props.children, child);
});

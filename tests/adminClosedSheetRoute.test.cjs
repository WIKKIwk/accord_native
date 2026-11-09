const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
function hooks() {
  const instances = new Map(); let active, cursor = 0;
  const slot = () => active[cursor++] ??= {};
  const react = { useContext: () => ({}), useRef: initial => { const s = slot(); return s.ref ??= { current: initial }; },
    useMemo: factory => { const s = slot(); return s.value ??= factory(); }, useEffect: effect => { const s = slot(); s.cleanup ??= effect(); },
    useLayoutEffect: effect => { const s = slot(); s.cleanup ??= effect(); } };
  return { react, render(id, component) { active = instances.get(id) ?? []; instances.set(id, active); cursor = 0; return component(); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const guard = load('shared/profileSessionGuard.ts');
function setup() {
  const h = hooks(), pending = [], stack = [], unmount = new Map(), popped = [];
  const native = load('nativeSheet.tsx', { react: h.react, 'expo-router': { router: { push: route => pending.push(route.params.id) } },
    './components/WorkerSecurity': { SecurityContext: {} } });
  const sheet = h.render('screen', native.useNativeSheet);
  const owner = load('admin/AdminClosedLogSheetOwner.tsx', { react: h.react, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/profileSessionGuard': guard, './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' } }).createAdminClosedLogSheetOwner(sheet);
  function mountNext() {
    const id = pending.shift(); assert.ok(id); stack.push(id);
    unmount.set(id, native.mountNativeSheet(id, () => {
      const top = stack.pop(); popped.push({ intended: id, actual: top }); unmount.get(top)?.(); unmount.delete(top);
    }));
    return id;
  }
  const selection = label => ({ detail: { order_id: label }, log: { event_id: label }, isCurrent: () => true });
  const open = label => owner.open({ selection: selection(label), history: {}, window: {}, catalog: [] });
  return { native, pending, stack, popped, owner, selection, open, mountNext, other: () => h.render('other', native.useNativeSheet) };
}
test('screen-scoped Closed sheet rejects queued double taps across rows and pops the intended route', async () => {
  const f = setup(); f.open('A'); f.open('A'); f.open('B'); assert.equal(f.pending.length, 1);
  const a = f.mountNext(), entry = f.native.getNativeSheet(a); assert.equal(entry.content.props.selection.detail.order_id, 'A');
  assert.equal(entry.options.dismissible, true); f.open('B'); assert.equal(f.pending.length, 0);
  entry.content.props.close(); assert.deepEqual(f.popped, [{ intended: a, actual: a }]); await tick();
  assert.equal(f.native.getNativeSheet(a), null); assert.deepEqual(f.stack, []);
  f.open('B'); assert.equal(f.pending.length, 1); const b = f.mountNext();
  assert.equal(f.native.getNativeSheet(b).content.props.selection.detail.order_id, 'B');
  f.native.closeNativeSheet(b); assert.deepEqual(f.popped, [{ intended: a, actual: a }, { intended: b, actual: b }]); await tick();
  assert.equal(f.native.getNativeSheet(b), null); assert.deepEqual(f.stack, []);
});
test('dismissing A then retiring its old row cannot dismiss newer B', async () => {
  const f = setup(); f.open('A'); const a = f.mountNext(), oldClose = f.native.getNativeSheet(a).content.props.close;
  f.native.closeNativeSheet(a); await tick(); f.open('B'); const b = f.mountNext();
  oldClose(); assert.deepEqual(f.stack, [b]); assert.equal(f.native.getNativeSheet(b).closing, false);
  assert.deepEqual(f.popped, [{ intended: a, actual: a }]);
  f.native.closeNativeSheet(b); await tick(); assert.deepEqual(f.popped, [{ intended: a, actual: a }, { intended: b, actual: b }]);
});
test('invalid selections cannot open, and a rejected native open does not reserve the coordinator', () => {
  const f = setup(), invalid = f.selection('A'); invalid.isCurrent = () => false;
  f.owner.open({ selection: invalid, history: {}, window: {}, catalog: [] }); assert.deepEqual(f.pending, []);
  let accepts = false, calls = 0;
  const owner = load('admin/AdminClosedLogSheetOwner.tsx', { react: {}, '../nativeSheet': {}, '../shared/profileSessionGuard': guard,
    './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' } }).createAdminClosedLogSheetOwner({
    isOpen: () => accepts, open() { calls++; }, close() {}, update() {} });
  const input = { selection: f.selection('B'), history: {}, window: {}, catalog: [] };
  owner.open(input); owner.open(input); assert.equal(calls, 2, 'a no-op native open must not leave an active token');
});
test('hold: a newer independently owned route is popped by a lower sheet close', async () => {
  const f = setup(); f.open('A'); const a = f.mountNext(), oldClose = f.native.getNativeSheet(a).content.props.close;
  f.other().open('unrelated'); const unrelated = f.mountNext(); assert.deepEqual(f.stack, [a, unrelated]);
  oldClose();
  // Existing navigation.goBack is not target-specific. This negative regression keeps the feature held, not approved for routing.
  assert.deepEqual(f.popped, [{ intended: a, actual: unrelated }]); assert.deepEqual(f.stack, [a]);
  await tick(); assert.equal(f.native.getNativeSheet(unrelated), null); assert.equal(f.native.getNativeSheet(a).closing, true);
});
test('a reentrant selection witness cannot reserve a competing row sheet', () => {
  const f = setup(), a = f.selection('A'), b = f.selection('B');
  a.isCurrent = () => { f.owner.open({ selection: b, history: {}, window: {}, catalog: [] }); return true; };
  f.owner.open({ selection: a, history: {}, window: {}, catalog: [] });
  assert.equal(f.pending.length, 1); const id = f.mountNext();
  assert.equal(f.native.getNativeSheet(id).content.props.selection.detail.order_id, 'A');
});
test('a finish notification cannot reserve a successor until the dismissed token clears', async () => {
  const f = setup(); f.open('A'); const a = f.mountNext(); let attempted = false;
  f.native.subscribeNativeSheet(a, () => { if (!f.native.getNativeSheet(a)) { attempted = true; f.open('B'); } });
  f.native.closeNativeSheet(a); await tick(); assert.equal(attempted, true); assert.equal(f.pending.length, 0);
  f.open('B'); assert.equal(f.pending.length, 1); const b = f.mountNext(); f.native.closeNativeSheet(b); await tick();
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const sync = load('shared/camera/synchronousGuard.ts');
const { FactoryLocationPresentation } = load('admin/factoryLocationPresentation.ts', { '../shared/camera/synchronousGuard': sync });
function fixture() {
  let current = true; const events = [], ticket = { location: { id: 'state', name: 'Factory' } };
  const controller = { isTicketCurrent: value => value === ticket && current, saveEditor: (...args) => events.push(['save', ...args]),
    rename: (...args) => events.push(['rename', ...args]) };
  const owner = new FactoryLocationPresentation(controller, () => current);
  return { owner, ticket, events, expire: () => { current = false; } };
}
test('original dialog closes before one guarded create/edit and old callbacks cannot submit again', () => {
  const { owner, ticket, events } = fixture(); owner.open('editor', ticket);
  const dialog = owner.getSnapshot().dialog, selected = new Set(['a']);
  owner.submit(dialog, ' Name ', selected); selected.add('late'); assert.deepEqual(events, []);
  assert.equal(owner.getSnapshot().dialog.closing, true);
  owner.dismissed(dialog); owner.dismissed(dialog); owner.submit(dialog, 'other', new Set());
  assert.equal(events.length, 1); assert.equal(events[0][1], ticket); assert.deepEqual([...events[0][3]], ['a']);
});
test('back/outside cancellation makes no mutation, including a late native dismissal', () => {
  const { owner, ticket, events } = fixture(); owner.open('rename', ticket); const dialog = owner.getSnapshot().dialog;
  owner.cancel(dialog); owner.dismissed(dialog); assert.equal(owner.getSnapshot().dialog, null); assert.deepEqual(events, []);
  owner.open('editor', ticket); const next = owner.getSnapshot().dialog; owner.dismissed(dialog);
  assert.equal(owner.getSnapshot().dialog, next);
});
test('picker cancellation retains editor, confirms with a copied selection and stale completions cannot affect a later picker', async () => {
  const { owner, ticket, events } = fixture(); owner.open('editor', ticket); const dialog = owner.getSnapshot().dialog;
  const first = owner.picker(dialog, new Set(['hidden'])), picker = owner.getSnapshot().picker;
  owner.cancel(dialog); assert.equal(owner.getSnapshot().dialog, dialog); owner.submit(dialog, 'Name', new Set()); assert.deepEqual(events, []);
  owner.finishPicker(picker, null); assert.equal(await first, null);
  const second = owner.picker(dialog, new Set(['hidden'])), next = owner.getSnapshot().picker;
  owner.finishPicker(picker, new Set(['wrong'])); assert.equal(owner.getSnapshot().picker, next);
  const selected = new Set(['b', 'hidden']); owner.finishPicker(next, selected); const result = await second; selected.clear();
  assert.deepEqual([...result], ['b', 'hidden']);
});
test('account invalidation resolves the picker and retires an already queued post-dismiss mutation', async () => {
  const f = fixture(); f.owner.open('editor', f.ticket); const dialog = f.owner.getSnapshot().dialog;
  const result = f.owner.picker(dialog, new Set()); f.owner.invalidate(); assert.equal(await result, null);
  f.owner.activate(); f.owner.open('editor', f.ticket); assert.equal(f.owner.getSnapshot().dialog, null);
  const g = fixture(); g.owner.open('rename', g.ticket); const queued = g.owner.getSnapshot().dialog;
  g.owner.submit(queued, 'New'); g.expire(); g.owner.dismissed(queued); assert.deepEqual(g.events, []);
});
test('StrictMode setup-cleanup-setup reattaches presentation while old dialog callbacks remain retired', () => {
  const f = fixture(); let changes = 0; const unsubscribe = f.owner.subscribe(() => changes++);
  f.owner.activate(); f.owner.open('editor', f.ticket); const old = f.owner.getSnapshot().dialog;
  f.owner.detach(); f.owner.activate(); f.owner.open('rename', f.ticket); const next = f.owner.getSnapshot().dialog;
  assert.ok(next); assert.notEqual(old.id, next.id);
  f.owner.submit(old, 'wrong', new Set()); assert.deepEqual(f.events, []);
  f.owner.submit(next, 'right'); f.owner.dismissed(next); assert.equal(f.events[0][0], 'rename'); assert.ok(changes >= 5); unsubscribe();
});
test('an accidentally async owner callback is rejected without an unhandled rejection', async () => {
  const owner = new FactoryLocationPresentation({ isTicketCurrent: () => true }, () => Promise.reject(new Error('expired')));
  owner.open('editor', { location: null }); assert.equal(owner.getSnapshot().dialog, null); await new Promise(resolve => setImmediate(resolve));
});
test('the actual route hook supports retained StrictMode owner attachment and fences session invalidation', () => {
  let memos = [], cursor = 0, effects = [], current = true, observe;
  const react = { useMemo: (create, next) => { const index = cursor++; if (!memos[index]) memos[index] = create(); return memos[index]; },
    useSyncExternalStore: (_subscribe, get) => get(), useEffect: callback => effects.push(callback) };
  const ticket = { location: null }, calls = [];
  const controller = { getSnapshot: () => ({ apparatus: [] }), subscribe() {}, invalidate: () => calls.push('invalidated'),
    isTicketCurrent: value => value === ticket, saveEditor: () => calls.push('saved') };
  const hook = load('admin/useFactoryLocationsRoute.ts', { react, '../shared/camera/synchronousGuard': sync,
    '../auth': { isSessionWitnessCurrent: () => current, subscribeSessionWitness: listener => { observe = listener; return () => {}; } },
    './factoryLocationSession': { createFactoryLocationSession: () => controller }, './factoryLocationPresentation': { FactoryLocationPresentation } });
  const session = {}, witness = { session }, props = { session, witness, isCurrent: () => current, navigation: null };
  function render() { cursor = 0; effects = []; return hook.useFactoryLocationsRoute(props); }
  const first = render(), cleanup = effects[0](); cleanup(); const second = render(); effects[0]();
  assert.equal(first.owner, second.owner);
  second.owner.presentation.open('editor', ticket); assert.ok(second.owner.presentation.getSnapshot().dialog);
  current = false; observe(); assert.equal(second.owner.presentation.getSnapshot().dialog, null); assert.deepEqual(calls, ['invalidated']);
  current = true; second.owner.presentation.activate(); second.owner.presentation.open('editor', ticket); assert.equal(second.owner.presentation.getSnapshot().dialog, null);
});
test('controller rejects copied and foreign editor tickets instead of granting current-screen authority', async () => {
  const exception = load('shared/mobileApiException.ts'), dart = load('admin/dartJsonString.ts');
  const editor = load('admin/factoryLocationEditorModel.ts', { './dartJsonString': dart });
  const { FactoryLocationController } = load('admin/factoryLocationController.ts', { '../shared/mobileApiException': exception,
    './dartJsonString': dart, './factoryLocationEditorModel': editor });
  let writes = 0; const controller = new FactoryLocationController({ isCurrent: () => true, scope: () => 'scope', generation: () => 1, canManage: () => true,
    readLocations: async () => [], readApparatus: async () => [], create: async () => { writes++; return { id: 'new', name: 'New', apparatus: [] }; } });
  controller.start(); await new Promise(resolve => setImmediate(resolve)); const ticket = controller.beginEditor(null);
  assert.ok(Object.isFrozen(ticket)); assert.equal(controller.isTicketCurrent({ ...ticket }), false);
  assert.equal(await controller.saveEditor({ ...ticket }, 'New', new Set()), 'cancelled'); assert.equal(writes, 0);
});
test('a synchronous close subscriber cannot open another dialog before the original mutation enters saving', () => {
  const f = fixture(); f.owner.open('editor', f.ticket); const original = f.owner.getSnapshot().dialog;
  f.owner.subscribe(() => { if (!f.owner.getSnapshot().dialog) f.owner.open('rename', f.ticket); });
  f.owner.submit(original, 'New', new Set()); f.owner.dismissed(original);
  assert.equal(f.owner.getSnapshot().dialog, null); assert.equal(f.events.length, 1); assert.equal(f.events[0][0], 'save');
});

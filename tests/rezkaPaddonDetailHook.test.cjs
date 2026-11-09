const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const calls = [], effects = [], layouts = [], controllers = [], refs = []; let refIndex = 0, current = true, route = true;
  const snapshot = { session: {} }, owner = { close() {} }, binding = {};
  class Controller {
    constructor(deps) { this.deps = deps; controllers.push(this); }
    subscribe = () => () => {}; getSnapshot = () => ({ phase: 'loading', binding: null, refreshing: false });
    resume() { calls.push(['resume', this]); } suspend() { calls.push(['suspend', this]); }
    dispose() { calls.push(['dispose', this]); } invalidate() { calls.push(['invalidate', this]); } start() { calls.push(['start', this]); }
  }
  const load = async (...args) => { calls.push(['load', ...args]); return binding; };
  const subscribeOwner = () => () => {};
  const mocks = { react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => {
    const index = refIndex++; return refs[index] ?? (refs[index] = { current: value }); },
    useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn), useLayoutEffect: fn => layouts.push(fn) },
  '../shared/appRoutes': { appRoutes: { apparatusPaddonDetail: '/detail' }, canOpenRoute: () => route },
  './rezkaPaddonDetailController': { RezkaPaddonDetailController: Controller },
  './rezkaPaddonDetailLifetime': { createRezkaPaddonDetailOwner: (...args) => { calls.push(['owner', ...args]); return owner; },
    rezkaPaddonDetailOwnerInput: value => value === owner ? {} : null, subscribeRezkaPaddonDetailOwner: subscribeOwner },
  './rezkaPaddonDetailRead': { readRezkaPaddonDetail: load, isRezkaPaddonDetailBinding: (value, witness) => value === binding && witness === snapshot },
  './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current } };
  const filename = path.resolve(__dirname, '../src/rezka/useRezkaPaddonDetail.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const render = (apparatus = 'apparatus:a', code = 'P1') => { refIndex = 0; return mod.exports.useRezkaPaddonDetail(snapshot, apparatus, code); };
  return { render, calls, effects, layouts, controllers, snapshot, owner, binding, load, subscribeOwner,
    loseSession: () => { current = false; }, loseRoute: () => { route = false; } };
}
test('hook supplies the original witness to the real owner/reader interface', async () => {
  const h = setup(), view = h.render(), c = h.controllers[0], layoutCleanup = h.layouts[0](), cleanup = h.effects[0]();
  assert.equal(view.controller, c); assert.equal(view.isCurrent(), true); assert.equal(c.deps.createOwner(), h.owner);
  assert.deepEqual(h.calls.find(value => value[0] === 'owner').slice(1), [h.snapshot, 'apparatus:a', 'P1']);
  assert.equal(c.deps.ownerCurrent(h.owner), true); assert.equal(c.deps.subscribeOwner, h.subscribeOwner); assert.equal(c.deps.load, h.load);
  assert.equal(c.deps.accept(h.binding), true); assert.equal(c.deps.accept({}), false);
  assert.ok(h.calls.some(value => value[0] === 'start' && value[1] === c)); layoutCleanup(); cleanup(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.calls.some(value => value[0] === 'dispose' && value[1] === c));
});
test('changed detail props invalidate the old lifetime at layout cleanup before its passive effect cleanup', async () => {
  const h = setup(); h.render(); const old = h.controllers[0], oldLayoutCleanup = h.layouts[0](), oldCleanup = h.effects[0]();
  h.render('apparatus:b', 'P2'); const fresh = h.controllers[1]; oldLayoutCleanup(); const freshLayoutCleanup = h.layouts[1]();
  assert.equal(old.deps.isCurrent(), false); assert.equal(fresh.deps.isCurrent(), true);
  oldCleanup(); const freshCleanup = h.effects[1](); await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.calls.some(value => value[0] === 'dispose' && value[1] === old));
  assert.ok(!h.calls.some(value => value[0] === 'dispose' && value[1] === fresh)); freshLayoutCleanup(); freshCleanup();
});
test('effect replay preserves one controller until the final cleanup', async () => {
  const h = setup(); h.render(); const c = h.controllers[0], mount = h.effects[0], layout = h.layouts[0];
  const firstLayoutCleanup = layout(), firstCleanup = mount(); firstLayoutCleanup(); firstCleanup();
  const secondLayoutCleanup = layout(), secondCleanup = mount(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(!h.calls.some(value => value[0] === 'dispose' && value[1] === c)); secondLayoutCleanup(); secondCleanup(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.filter(value => value[0] === 'dispose' && value[1] === c).length, 1);
});
test('a lost session or route prevents an old controller from being current', () => {
  for (const loss of ['session', 'route']) { const h = setup(), view = h.render();
    if (loss === 'session') h.loseSession(); else h.loseRoute(); assert.equal(view.isCurrent(), false); }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/admin/adminHomeController.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { AdminHomeController } = mod.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  let current = true, scope = 'A', canRead = true, canOpen = true; const calls = [], frames = [], listeners = new Set();
  const hub = { topic: '', version: 0, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    emit(topic, version) { this.topic = topic; this.version = version; for (const listener of listeners) listener(); } };
  let open = async route => { calls.push(['open', route]); };
  const deps = { hub, store: { bootstrapSummary: async () => { calls.push('bootstrap'); }, refreshSummary: async () => { calls.push('refresh'); } },
    isCurrent: () => current, scope: () => scope, canLoadSummary: () => canRead, canOpen: () => canOpen,
    afterFrame: () => { const frame = deferred(); frames.push(frame); return frame.promise; }, openRoute: route => open(route) };
  return { deps, hub, calls, frames, listeners, setCurrent: value => { current = value; }, setScope: value => { scope = value; },
    setCanRead: value => { canRead = value; }, setCanOpen: value => { canOpen = value; }, setOpen: value => { open = value; } };
}
test('home bootstraps only after its first frame and only with summary permission', async () => {
  const f = fixture(), controller = new AdminHomeController(f.deps); controller.start(); assert.deepEqual(f.calls, []);
  f.frames.shift().resolve(); await tick(); assert.deepEqual(f.calls, ['bootstrap']);
  const g = fixture(); g.setCanRead(false); const denied = new AdminHomeController(g.deps); denied.start(); g.frames.shift().resolve(); await tick();
  g.hub.emit('admin', 1); await denied.reload(); assert.deepEqual(g.calls, []);
});
test('refresh hub reloads only new admin versions and unsubscribes on dispose', async () => {
  const f = fixture(), controller = new AdminHomeController(f.deps); controller.start(); f.frames.shift().resolve(); await tick();
  f.hub.emit('other', 1); f.hub.emit('admin', 2); f.hub.emit('admin', 2); f.hub.emit('admin', 3); await tick();
  assert.deepEqual(f.calls, ['bootstrap', 'refresh', 'refresh']); controller.dispose(); assert.equal(f.listeners.size, 0);
  f.hub.emit('admin', 4); await tick(); assert.equal(f.calls.length, 3);
});
test('opening waits for a frame, blocks duplicate taps, then refreshes after the destination closes', async () => {
  const f = fixture(), child = deferred(); f.setOpen(async route => { f.calls.push(['open', route]); await child.promise; });
  const controller = new AdminHomeController(f.deps); controller.start(); f.frames.shift().resolve(); await tick();
  const first = controller.openAndReload('/target'), second = controller.openAndReload('/other'); assert.equal(f.frames.length, 1);
  f.frames.shift().resolve(); await tick(); assert.deepEqual(f.calls, ['bootstrap', ['open', '/target']]);
  child.resolve(); await Promise.all([first, second]); assert.deepEqual(f.calls, ['bootstrap', ['open', '/target'], 'refresh']);
});
test('session, scope and route access are rechecked after the frame and after a child returns', async () => {
  for (const mutate of [f => f.setCurrent(false), f => f.setScope('B'), f => f.setCanOpen(false)]) {
    const f = fixture(), controller = new AdminHomeController(f.deps); controller.start(); f.frames.shift().resolve(); await tick();
    const pending = controller.openAndReload('/target'); mutate(f); f.frames.shift().resolve(); await pending;
    assert.deepEqual(f.calls, ['bootstrap']);
  }
  const f = fixture(), child = deferred(); f.setOpen(async route => { f.calls.push(['open', route]); await child.promise; });
  const controller = new AdminHomeController(f.deps); controller.start(); f.frames.shift().resolve(); await tick();
  const pending = controller.openAndReload('/target'); f.frames.shift().resolve(); await tick(); f.setScope('B'); child.resolve(); await pending;
  assert.deepEqual(f.calls, ['bootstrap', ['open', '/target']]);
});
test('disposed and restarted controllers ignore earlier frame and child work', async () => {
  const f = fixture(), controller = new AdminHomeController(f.deps); controller.start(); const first = f.frames.shift();
  controller.dispose(); controller.start(); const second = f.frames.shift(); first.resolve(); second.resolve(); await tick();
  assert.deepEqual(f.calls, ['bootstrap']);
  const pending = controller.openAndReload('/target'); controller.dispose(); f.frames.shift().resolve(); await pending;
  assert.deepEqual(f.calls, ['bootstrap']);
});

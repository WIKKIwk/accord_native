const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString');
const editor = load('admin/factoryLocationEditorModel', { './dartJsonString': dart });
const { FactoryLocationController } = load('admin/factoryLocationController', { '../shared/mobileApiException': exception,
  './dartJsonString': dart, './factoryLocationEditorModel': editor });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const a = { id: 'apparatus:default:a', name: 'Print 7', sort_order: 7 }, b = { id: 'apparatus:default:b', name: 'Print 2', sort_order: 2 };
const location = { id: 'state-1', name: 'State', active: true, apparatus: [a], created_at_unix: 0, updated_at_unix: 0 };
function fixture() {
  let current = true, scope = 'A', generation = 1, allowed = true, locations = [location], apparatus = [a, b]; const calls = [];
  const deps = { isCurrent: () => current, scope: () => scope, generation: () => generation, canManage: () => allowed,
    readLocations: async guard => { guard(); calls.push('locations'); return locations; },
    readApparatus: async guard => { guard(); calls.push('apparatus'); return apparatus; },
    create: async (name, ids, guard) => { guard(); calls.push(['create', name, ids]); return { ...location, id: 'new', name, apparatus: [] }; },
    replaceApparatus: async (id, ids, guard) => { guard(); calls.push(['replace', id, ids]); return { ...location, apparatus: ids.map(id => ({ id })) }; },
    update: async (id, changes, guard) => { guard(); calls.push(['update', id, changes]); return { ...location, ...changes }; } };
  return { deps, calls, setCurrent: value => { current = value; }, setScope: value => { scope = value; },
    setGeneration: value => { generation = value; }, setAllowed: value => { allowed = value; }, setLocations: value => { locations = value; } };
}
test('loads locations and apparatus concurrently, orders apparatus and exposes failures', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  assert.deepEqual(f.calls, ['locations', 'apparatus']); assert.equal(controller.getSnapshot().status, 'ready');
  assert.deepEqual(controller.getSnapshot().apparatus.map(item => item.id), [b.id, a.id]);
  const g = fixture(); g.deps.readApparatus = async () => { throw new Error('offline'); };
  const failed = new FactoryLocationController(g.deps); failed.start(); await tick(); assert.equal(failed.getSnapshot().status, 'error');
});
test('editor requires a name, creates, skips unchanged sets, and replaces changed memberships', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  assert.equal(await controller.saveEditor(controller.beginEditor(null), ' ', new Set()), 'nameRequired');
  assert.equal(await controller.saveEditor(controller.beginEditor(null), ' New ', new Set([a.id])), 'saved');
  assert.deepEqual(f.calls.at(-1), ['create', 'New', [a.id]]);
  const before = f.calls.length;
  assert.equal(await controller.saveEditor(controller.beginEditor(location.id), 'State', new Set([a.id])), 'saved');
  assert.equal(f.calls.length, before);
  assert.equal(await controller.saveEditor(controller.beginEditor(location.id), 'State', new Set([b.id, a.id])), 'saved');
  assert.deepEqual(f.calls.at(-1), ['replace', location.id, [b.id, a.id]]);
});
test('rename sorts, active update keeps list order and errors use V2 message class', async () => {
  const f = fixture(), other = { ...location, id: 'state-2', name: 'Alpha' }; f.setLocations([location, other]);
  const controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  const ticket = controller.beginEditor(location.id); assert.equal(await controller.rename(ticket, ''), 'nameRequired');
  assert.equal(await controller.rename(ticket, 'State'), 'cancelled'); assert.equal(await controller.rename(ticket, ' Zeta '), 'saved');
  assert.deepEqual(controller.getSnapshot().locations.map(item => item.name), ['Alpha', 'Zeta']);
  assert.equal(await controller.setActive(location.id, false), 'saved');
  assert.deepEqual(controller.getSnapshot().locations.map(item => item.id), ['state-2', 'state-1']);
  f.deps.update = async () => { throw new exception.MobileApiException({ code: 'conflict', message: 'server message' }); };
  assert.equal(await controller.setActive(location.id, true), 'failed');
  assert.deepEqual(controller.getSnapshot().notice, { source: 'server', message: 'server message', serial: 1 });
  f.deps.update = async () => { throw new Error('offline'); };
  assert.equal(await controller.setActive(location.id, true), 'failed');
  assert.deepEqual(controller.getSnapshot().notice, { source: 'localization', key: 'factory.state_status_failed', serial: 2 });
});
test('a session, scope, permission or generation change while a dialog is open blocks mutation', async () => {
  for (const mutate of [f => f.setCurrent(false), f => f.setScope('B'), f => f.setGeneration(2), f => f.setAllowed(false)]) {
    const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
    const ticket = controller.beginEditor(null); mutate(f);
    assert.equal(await controller.saveEditor(ticket, 'New', new Set()), 'cancelled'); assert.equal(f.calls.filter(Array.isArray).length, 0);
    assert.equal(controller.getSnapshot().status, 'forbidden'); assert.deepEqual(controller.getSnapshot().locations, []);
  }
});
test('no generation means no read and stale async result after reset is discarded', async () => {
  const f = fixture(); f.setGeneration(null); const unavailable = new FactoryLocationController(f.deps); unavailable.start();
  assert.equal(unavailable.getSnapshot().status, 'forbidden'); assert.deepEqual(f.calls, []);
  const g = fixture(), pending = deferred(); g.deps.readLocations = () => pending.promise;
  const controller = new FactoryLocationController(g.deps); controller.start(); g.setGeneration(2); pending.resolve([location]); await tick();
  assert.equal(controller.getSnapshot().status, 'forbidden'); assert.deepEqual(controller.getSnapshot().locations, []);
});
test('a load finishing after a write is reread instead of restoring stale server data', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  const old = deferred(); let next = true; f.deps.readLocations = async guard => { guard(); if (next) { next = false; return old.promise; } return [{ ...location, active: false }]; };
  const write = deferred(); f.deps.update = async (_id, _change, guard) => { guard(); await write.promise; return { ...location, active: false }; };
  const saving = controller.setActive(location.id, false); const loading = controller.load(); write.resolve(); await saving;
  old.resolve([location]); await loading; await tick();
  assert.equal(controller.getSnapshot().status, 'ready'); assert.equal(controller.getSnapshot().locations[0].active, false);
});

test('a synchronous scope change on saving prevents the send and clears stale state', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  const ticket = controller.beginEditor(null);
  controller.subscribe(() => { if (controller.getSnapshot().saving) f.setScope('B'); });
  assert.equal(await controller.saveEditor(ticket, 'New', new Set()), 'cancelled');
  assert.equal(f.calls.filter(Array.isArray).length, 0); assert.equal(controller.getSnapshot().status, 'forbidden');
});
test('a generation change while the success result is emitted clears the old state', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  const ticket = controller.beginEditor(null); let sent = false;
  controller.subscribe(() => { if (controller.getSnapshot().saving) sent = true;
    else if (sent && controller.getSnapshot().locations.some(item => item.id === 'new')) f.setGeneration(2); });
  assert.equal(await controller.saveEditor(ticket, 'New', new Set()), 'cancelled');
  assert.equal(f.calls.filter(Array.isArray).length, 1); assert.equal(controller.getSnapshot().status, 'forbidden');
});
test('a save in progress prevents another factory mutation', async () => {
  const f = fixture(), pending = deferred(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  f.deps.update = async (id, change, guard) => { guard(); f.calls.push(['pending', id, change]); await pending.promise; return { ...location, active: false }; };
  const first = controller.setActive(location.id, false); assert.equal(await controller.setActive(location.id, false), 'cancelled');
  pending.resolve(); assert.equal(await first, 'saved'); assert.equal(f.calls.filter(Array.isArray).length, 1);
});

test('disposing and restarting cannot apply a read from the earlier lifecycle', async () => {
  const f = fixture(), pending = deferred(); let first = true;
  f.deps.readLocations = async guard => { guard(); if (first) { first = false; return pending.promise; } return [location]; };
  const controller = new FactoryLocationController(f.deps); controller.start(); controller.dispose(); controller.start(); await tick();
  pending.resolve([{ ...location, name: 'stale' }]); await tick();
  assert.equal(controller.getSnapshot().status, 'ready'); assert.equal(controller.getSnapshot().locations[0].name, 'State');
});

test('an older notice timer cannot erase a newer failure notice', async () => {
  const f = fixture(), controller = new FactoryLocationController(f.deps); controller.start(); await tick();
  f.deps.update = async () => { throw new Error('offline'); };
  assert.equal(await controller.setActive(location.id, false), 'failed'); const first = controller.getSnapshot().notice.serial;
  assert.equal(await controller.setActive(location.id, false), 'failed'); const second = controller.getSnapshot().notice.serial;
  controller.dismissNotice(first); assert.equal(controller.getSnapshot().notice.serial, second);
  controller.dismissNotice(second); assert.equal(controller.getSnapshot().notice, null);
});

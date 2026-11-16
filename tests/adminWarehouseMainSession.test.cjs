const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const strict = load('shared/camera/synchronousGuard.ts'), dart = load('admin/dartJsonString.ts'), scope = load('sessionReadScope.ts');
const filter = load('admin/adminWarehouseFilterStore.ts', { '../shared/camera/synchronousGuard': strict, './dartJsonString': dart });
const runtime = load('admin/adminWarehouseFilterRuntime.ts', { '../auth': { registerSessionResetHook: () => () => {} } });
const model = load('admin/adminWarehouseMainModel.ts', { './dartJsonString': dart });
const controllers = load('admin/adminWarehouseMainController.ts', { '../shared/camera/synchronousGuard': strict, './dartJsonString': dart,
  './adminWarehouseFilterStore': filter, './adminWarehouseMainModel': model });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture(role = 'admin') {
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role, ref: 'Original', display_name: 'Owner' }, capabilities: ['admin.access'], assigned_apparatus: [], assigned_warehouses: [] };
  const witness = { session }, listeners = new Set(), reads = []; let active = session, epoch = 1, auth = true, allowed = true, callback = () => true, summary = async () => ({ sections: [], qolipWarehouseNames: [] });
  const { createAdminWarehouseMainSession } = load('admin/adminWarehouseMainSession.ts', {
    '../auth': { activeSessionEpoch: value => active === value ? epoch : null, activeSessionToken: value => active === value ? value.token : null,
      isSessionWitnessCurrent: value => auth && value === witness, subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); } },
    '../appPreferences': {}, '../sessionReadScope': scope, '../shared/appRoutes': { appRoutes: { adminWarehouses: '/warehouses' }, canOpenRoute: () => allowed },
    '../shared/camera/synchronousGuard': strict, './adminWarehouseFilterStore': filter, './adminWarehouseFilterRuntime': runtime, './adminWarehouseMainController': controllers,
    './adminWarehouseMainRead': {
      loadAdminWarehouseMainSummary: async (received, flags, guard, readWitness) => { assert.equal(received, session); guard(); reads.push({ flags, guard, readWitness }); return summary(); },
      loadAdminWarehouseMainDetail: async (_session, _warehouse, _flags, guard) => { guard(); return null; },
      readAdminWarehouseMainItemsPage: async (_session, _warehouse, _query, _offset, guard) => { guard(); return []; },
      readAdminWarehouseMainQolipProducts: async (_session, _query, guard) => { guard(); return []; },
    },
  });
  const storage = { async getItem() { return null; }, async setItem() {}, async removeItem() {} };
  const makeOwner = () => createAdminWarehouseMainSession(session, witness, () => callback(), { storage });
  const owner = makeOwner();
  return { owner, makeOwner, session, reads, listeners, setCallback: value => { callback = value; }, setSummary: value => { summary = value; },
    changeEpoch: () => { epoch++; }, retireWitness: () => { auth = false; }, changeAccount: () => { active = { ...session }; }, deny: () => { allowed = false; },
    notify: () => [...listeners].forEach(listener => listener()) };
}
test('main owner passes original read authority and stable parent/live callbacks without changing scope-specific modes', async () => {
  for (const role of ['admin', 'brigader', 'werka', 'material_taminotchi', 'customer']) {
    const f = fixture(role); f.owner.activate(); await tick();
    assert.deepEqual(f.owner.flags, { adminScoped: role === 'admin' || role === 'brigader', warehouseScoped: role === 'werka' || role === 'material_taminotchi' });
    assert.equal(f.reads[0].readWitness(), true); assert.equal(f.owner.onCreated, f.owner.onChanged); assert.equal(f.owner.onChanged, f.owner.controller.reload);
    assert.equal(f.owner.onDeleted, f.owner.controller.warehouseDeleted); assert.equal(f.owner.refreshInPlace, f.owner.controller.refreshInPlace); f.owner.deactivate(); assert.equal(f.listeners.size, 0);
  }
});
test('epoch/account/witness/capability/readscope and display-name fallback authority cannot revive an original owner', async () => {
  for (const retire of [f => f.changeEpoch(), f => f.changeAccount(), f => f.retireWitness(), f => f.deny(),
    f => { f.session.assigned_warehouses.push('Other'); }, f => { f.session.profile.display_name = 'Another owner'; }, f => f.setCallback(() => false)]) {
    const f = fixture(), response = deferred(); f.setSummary(() => response.promise); f.owner.activate(); const read = f.reads[0]; retire(f); f.notify();
    assert.equal(read.readWitness(), false); response.resolve({ sections: [{ warehouse: 'Wrong account' }], qolipWarehouseNames: [] }); await tick();
    assert.equal(f.owner.controller.getSnapshot().valid, false); assert.deepEqual(f.owner.controller.getSnapshot().summary.sections, []); assert.equal(f.owner.current(), false); f.owner.deactivate();
  }
});
test('StrictMode reattachment replaces pending generations but keeps stable callback and original account ownership', async () => {
  const f = fixture(), old = deferred(); let requests = 0; f.setSummary(async () => ++requests === 1 ? old.promise : { sections: [{ warehouse: 'New' }], qolipWarehouseNames: [] });
  const refresh = f.owner.refreshInPlace; f.owner.activate(); const first = f.reads[0]; f.owner.deactivate(); f.owner.activate(); await tick();
  assert.equal(first.readWitness(), false); assert.equal(f.owner.current(), true); old.resolve({ sections: [{ warehouse: 'Old' }], qolipWarehouseNames: [] }); await tick();
  assert.deepEqual(f.owner.controller.getSnapshot().summary.sections.map(row => row.warehouse), ['New']); assert.equal(refresh, f.owner.refreshInPlace); assert.equal(f.listeners.size, 1); f.owner.deactivate();
});
test('asynchronous and reentrant owner authority fails closed without rejected-promise leakage or a send', async () => {
  for (const kind of ['async', 'reentrant']) {
    const f = fixture(); f.setCallback(kind === 'async' ? () => Promise.reject(Error('async authority')) : () => f.owner.current());
    f.owner.activate(); await tick(); assert.equal(f.owner.current(), false); assert.equal(f.reads.length, 0); f.owner.deactivate();
  }
});
test('a same-scope screen owner immediately reuses the warm selection under a fresh original authority', async () => {
  const f = fixture(); f.setSummary(async () => ({ sections: [{ warehouse: 'A' }], qolipWarehouseNames: [] }));
  f.owner.activate(); await tick(); f.owner.controller.selectWarehouse('A'); await tick(); f.owner.deactivate();
  const next = f.makeOwner(); assert.equal(next.controller.getSnapshot().warehouse, 'A'); assert.equal(next.preferences.cachedWarehouse, 'A');
  next.activate(); await tick(); assert.equal(next.controller.getSnapshot().warehouse, 'A'); assert.equal(next.controller.getSnapshot().detailPhase, 'ready'); next.deactivate();
  f.session.capabilities.push('changed.permission'); const different = f.makeOwner(); assert.equal(different.controller.getSnapshot().warehouse, null);
});

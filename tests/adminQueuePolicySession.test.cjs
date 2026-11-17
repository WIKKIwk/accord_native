const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', `${file}.ts`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const routes = load('shared/appRoutes'), scope = load('sessionReadScope'), profile = load('shared/profileSessionGuard'), dart = load('admin/dartJsonString');
const model = load('admin/adminQueuePolicyModel', { './dartJsonString': dart }), controller = load('admin/adminQueuePolicyController', { './dartJsonString': dart, './adminQueuePolicyModel': model });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve: value => resolve(value), reject: value => reject(value) }; }
function fixture() {
  const session = { token: 'fake-token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access'] }, witness = { session }, calls = [];
  let epoch = 1, witnessCurrent = true, parent = () => true, readCatalog = async () => [], readPolicies = async () => ({});
  const factory = load('admin/adminQueuePolicySession', {
    '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: value => witnessCurrent && value === witness },
    '../apparatusApi': { adminApparatus: async (account, options) => { options.beforeSend(); calls.push(['apparatus', account, options]); return readCatalog(); } },
    '../sessionReadScope': scope, '../shared/appRoutes': routes, '../shared/profileSessionGuard': profile, './adminQueuePolicyModel': model,
    './adminQueuePolicyController': controller, './adminQueuePolicyApi': { adminApparatusQueuePolicies: async (account, guard, readWitness) => {
      guard(); assert.equal(readWitness(), true); calls.push(['policies', account]); return readPolicies();
    }, adminUpdateApparatusQueuePolicy: async () => { throw new Error('No mutation expected'); } },
  }).adminQueuePolicySession;
  const owner = factory({ session, witness, isCurrent: () => parent() });
  return { session, witness, owner, calls, setEpoch: value => { epoch = value; }, retire: () => { witnessCurrent = false; }, setParent: value => { parent = value; },
    setCatalog: value => { readCatalog = value; }, setPolicies: value => { readPolicies = value; } };
}
for (const change of ['scope', 'epoch', 'permission', 'witness', 'token']) test(`queue policy original ${change} loss permanently retires its source owner`, () => {
  const f = fixture(); assert.equal(f.owner.current(), true);
  if (change === 'scope') f.session.baseUrl = 'https://other.example';
  if (change === 'epoch') f.setEpoch(2);
  if (change === 'permission') f.session.capabilities = [];
  if (change === 'witness') f.retire();
  if (change === 'token') f.session.token = '';
  assert.equal(f.owner.current(), false); f.session.baseUrl = 'https://server.example'; f.session.token = 'token'; f.session.capabilities = ['admin.access']; f.setEpoch(1);
  assert.equal(f.owner.current(), false); f.owner.controller.start(); assert.equal(f.calls.length, 0);
});
test('queue policy same-session token refresh stays valid while async or reentrant parent guards retire', () => {
  const fresh = fixture(); fresh.session.token = 'fresh'; assert.equal(fresh.owner.current(), true);
  const async = fixture(); async.setParent(() => Promise.resolve(true)); assert.equal(async.owner.current(), false);
  const reentrant = fixture(); reentrant.setParent(() => { reentrant.owner.current(); return true; }); assert.equal(reentrant.owner.current(), false);
});
test('queue panel starts both source reads together with apparatus limit300, without transient retries', async () => {
  const f = fixture(), catalog = deferred(), policies = deferred(); f.setCatalog(() => catalog.promise); f.setPolicies(() => policies.promise);
  f.owner.controller.start(); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0][2].limit, 300); assert.equal(f.calls[0][2].retryTransient, false);
  const failure = new Error('first failed read'); policies.reject(failure); await tick();
  assert.equal(f.owner.controller.getSnapshot().loading, true); assert.equal(f.owner.controller.getSnapshot().loadError, null);
  catalog.resolve([]); await tick(); assert.equal(f.owner.controller.getSnapshot().loadError, failure);
});
test('account retirement before the paired reads settle prevents source content publication', async () => {
  const f = fixture(), catalog = deferred(); f.setCatalog(() => catalog.promise); f.owner.controller.start();
  f.retire(); catalog.resolve([{ id: 'private-apparatus' }]); await tick();
  assert.equal(f.owner.controller.getSnapshot().invalidated, true); assert.equal(f.owner.controller.getSnapshot().data, null);
});

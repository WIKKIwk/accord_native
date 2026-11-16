const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const routes = load('shared/appRoutes'), scope = load('sessionReadScope'), profile = load('shared/profileSessionGuard');
const controller = load('admin/adminSettingsController', { './dartJsonString': load('admin/dartJsonString') });
function fixture() {
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access', 'admin.settings.read'] };
  const witness = { session }; let epoch = 1, current = true, outer = () => true;
  const { adminSettingsSession } = load('admin/adminSettingsSession', { '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null,
    isSessionWitnessCurrent: value => current && value === witness }, '../sessionReadScope': scope, '../shared/appRoutes': routes,
    '../shared/profileSessionGuard': profile, './adminSettings': {}, './adminSettingsController': controller });
  const owner = adminSettingsSession(session, witness, () => outer());
  return { session, witness, owner, setEpoch: value => { epoch = value; }, retire: () => { current = false; }, setOuter: value => { outer = value; } };
}
for (const change of ['scope', 'epoch', 'permission', 'witness', 'token']) test(`settings captured ${change} loss permanently retires the owner`, () => {
  const f = fixture(); assert.equal(f.owner.current(), true);
  if (change === 'scope') f.session.baseUrl = 'https://other.example';
  if (change === 'epoch') f.setEpoch(2);
  if (change === 'permission') f.session.capabilities = [];
  if (change === 'witness') f.retire();
  if (change === 'token') f.session.token = '';
  assert.equal(f.owner.current(), false);
  f.session.baseUrl = 'https://server.example'; f.session.capabilities = ['admin.access', 'admin.settings.read']; f.session.token = 'token'; f.setEpoch(1);
  assert.equal(f.owner.current(), false);
});
test('token-only refresh remains valid; async and reentrant current callbacks fail closed', async () => {
  const refreshed = fixture(); refreshed.session.token = 'fresh'; assert.equal(refreshed.owner.current(), true);
  const asyncGuard = fixture(); asyncGuard.setOuter(async () => true); assert.equal(asyncGuard.owner.current(), false);
  const reentrant = fixture(); reentrant.setOuter(() => { reentrant.owner.current(); return true; }); assert.equal(reentrant.owner.current(), false);
});

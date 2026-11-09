const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(change = '') {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: ['group'] };
  let active = true, epoch = 1, live = true, calls = 0;
  const auth = { activeSessionToken: value => active && value === session ? value.token : null,
    activeSessionEpoch: value => active && value === session ? epoch : null, refreshSession: async () => {
      session.token = 'fresh';
      if (change === 'role') session.profile.role = 'admin';
      if (change === 'identity') session.profile.ref = 'other';
      if (change === 'permission') session.capabilities = [];
      if (change === 'group') session.assigned_item_groups = ['other'];
      if (change === 'account') active = false;
      if (change === 'epoch') epoch++;
      if (change === 'screen') live = false;
      return true;
    } };
  const scope = compile('sessionReadScope'), initial = scope.sessionReadScope(session), expectedEpoch = auth.activeSessionEpoch(session);
  const authorized = compile('authorizedFetch', { './auth': auth });
  const api = compile('productionMapReadApi', { './authorizedFetch': authorized,
    './workerControlsApi': { productionMapResponseError: () => Error('server failure') },
    './workerProductionMapSaved': { productionMapSavedFromJson: raw => raw } });
  const guard = () => { if (!live || !auth.activeSessionToken(session) || auth.activeSessionEpoch(session) !== expectedEpoch ||
    scope.sessionReadScope(session) !== initial) throw Error('scope changed'); };
  const oldFetch = global.fetch;
  global.fetch = async () => { calls++; return new Response(calls === 1 ? '{"error":"expired"}' : '{"map":{"id":"one"}}',
    { status: calls === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } }); };
  return { session, api, guard, calls: () => calls, stop: () => { live = false; }, restore: () => { global.fetch = oldFetch; } };
}

test('optional guard blocks an invalid initial send', async () => {
  const h = setup(); h.stop();
  try { await assert.rejects(h.api.adminProductionMap(h.session, 'one', h.guard), /scope changed/); assert.equal(h.calls(), 0); }
  finally { h.restore(); }
});

for (const change of ['role', 'identity', 'permission', 'group', 'account', 'epoch', 'screen']) {
  test(`optional guard prevents a 401 retry after ${change} changes`, async () => {
    const h = setup(change);
    try { await assert.rejects(h.api.adminProductionMap(h.session, 'one', h.guard), change === 'account' ? /server failure/ : /scope changed/);
      assert.equal(h.calls(), 1); }
    finally { h.restore(); }
  });
}

test('same-session 401 token refresh retains the existing retry', async () => {
  const h = setup();
  try { assert.deepEqual(await h.api.adminProductionMap(h.session, 'one', h.guard), { map: { id: 'one' } }); assert.equal(h.calls(), 2); }
  finally { h.restore(); }
});

test('default detail and list callers preserve the old two-argument authorizedFetch calls', async () => {
  const calls = [], authorized = { authorizedFetch: async (...args) => { calls.push(args); return { status: 200, json: async () => calls.length === 1 ? {} : [] }; } };
  const api = compile('productionMapReadApi', { './authorizedFetch': authorized,
    './workerControlsApi': { productionMapResponseError: () => Error('server failure') },
    './workerProductionMapSaved': { productionMapSavedFromJson: raw => raw } });
  await api.adminProductionMap({}, ' one '); await api.adminProductionMaps({});
  assert.equal(calls[0].length, 2); assert.equal(calls[0][1], '/v1/mobile/admin/production-maps?id=one');
  assert.equal(calls[1].length, 2); assert.equal(calls[1][1], '/v1/mobile/admin/production-maps');
});

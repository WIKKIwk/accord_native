const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { sessionReadScope } = compile('sessionReadScope');
const station = 'apparatus:default:cut';
function setup(change) {
  const h = { session: { token: 'old', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'one' },
    capabilities: ['apparatus.queue.read'], assigned_apparatus: [station] }, active: true, sends: [] };
  const originalScope = sessionReadScope(h.session), originalFetch = global.fetch;
  h.valid = () => h.active && sessionReadScope(h.session) === originalScope;
  const auth = { activeSessionToken: () => h.active ? h.session.token : null, refreshSession: async () => {
    h.session.token = 'new'; if (change === 'account') h.active = false;
    if (change === 'role') h.session.profile.role = 'werka';
    if (change === 'identity') h.session.profile.ref = 'other';
    if (change === 'capability') h.session.capabilities = [];
    if (change === 'assignment') h.session.assigned_apparatus = [];
    if (change === 'server') h.session.baseUrl = 'https://other.test'; return true;
  } };
  const authorized = compile('authorizedFetch', { './auth': auth, 'expo/fetch': require('./support/expoFetch.cjs') });
  const controls = { WorkerControlException: class extends Error {}, productionMapResponseError: () => Error('API rejected') };
  h.get = compile('paddonsApi', { './authorizedFetch': authorized, './workerControlsApi': controls }).activeRezkaPaddon;
  h.put = compile('activePaddonSetApi', { './authorizedFetch': authorized, './workerControlsApi': controls }).setActiveRezkaPaddon;
  global.fetch = async (url, init) => { h.sends.push({ url, init }); return h.transport ? h.transport(url, init)
    : new Response(h.sends.length === 1 ? '{"error":"unauthorized"}' : JSON.stringify({ ok: true, apparatus: station, code: '00001' }), { status: h.sends.length === 1 ? 401 : 200 }); };
  h.restore = () => { global.fetch = originalFetch; }; return h;
}
for (const verb of ['get', 'put']) {
  const call = h => verb === 'get' ? h.get(h.session, station, h.valid) : h.put(h.session, station, '00001', h.valid);
  for (const change of ['account', 'role', 'identity', 'capability', 'assignment', 'server']) test(`${verb}: 401 cannot retry after ${change} changes`, async () => {
    const h = setup(change); try { await assert.rejects(call(h)); assert.equal(h.sends.length, 1); } finally { h.restore(); }
  });
  test(`${verb}: same-account token refresh preserves picker and checks the original scope`, async () => {
    const h = setup(); try { assert.equal(await call(h), '00001'); assert.equal(h.sends.length, 2);
      assert.equal(h.sends[0].init.headers.get('Authorization'), 'Bearer old'); assert.equal(h.sends[1].init.headers.get('Authorization'), 'Bearer new');
      assert.equal(h.sends[0].init.method ?? 'GET', verb === 'get' ? 'GET' : 'PUT');
      if (verb === 'put') assert.deepEqual(JSON.parse(h.sends[1].init.body), { apparatus: station, code: '00001' });
    } finally { h.restore(); }
  });
  test(`${verb}: expired before dispatch sends nothing`, async () => {
    const h = setup(); h.active = false; try { await assert.rejects(call(h)); assert.equal(h.sends.length, 0); } finally { h.restore(); }
  });
  test(`${verb}: a scope change while decoding the response cannot return an old choice`, async () => {
    const h = setup();
    h.transport = async () => ({ status: 200, json: async () => { h.session.profile.ref = 'other'; return { ok: true, apparatus: station, code: '00001' }; } });
    try { await assert.rejects(call(h), /worker.error.sync/); assert.equal(h.sends.length, 1); } finally { h.restore(); }
  });
}

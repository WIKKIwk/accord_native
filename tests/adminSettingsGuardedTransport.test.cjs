const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let valid = true, joins = 0, refreshes = 0, joined = async () => false;
  const session = { baseUrl: 'https://server.example', token: 'first' };
  const auth = { activeSessionToken: () => session.token, refreshSession: async () => { refreshes++; session.token = 'fresh'; return true; },
    joinRefreshForGuardedRead: async (...args) => { joins++; return joined(...args); } };
  const transport = load('authorizedFetch', { './auth': auth }), api = load('admin/adminSettings', { '../authorizedFetch': transport });
  const guard = () => { if (!valid) throw new Error('expired'); }, readWitness = () => { guard(); return true; };
  return { session, api, guard, read: () => api.adminSettings(session, guard, readWitness), retire: () => { valid = false; },
    counts: () => ({ joins, refreshes }), onJoin: value => { joined = value; } };
}
for (const code of [302, 401]) test(`settings GET original witness blocks retired ${code} continuation`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; f.retire(); return new Response('', { status: code, headers: code === 302 ? { location: '/v1/mobile/next' } : {} }); };
  await assert.rejects(f.read()); assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
});
test('settings guarded GET joins only independent refresh; valid token refresh retries once', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const unavailable = fixture();
  global.fetch = async () => new Response('', { status: 401 });
  await assert.rejects(unavailable.read(), error => error.code === 'guarded_read_refresh_unavailable');
  assert.deepEqual(unavailable.counts(), { joins: 1, refreshes: 0 });
  const f = fixture(), tokens = []; f.onJoin(async session => { session.token = 'fresh'; return true; });
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1
    ? new Response('', { status: 401 }) : new Response('{}', { status: 200 }); };
  await f.read(); assert.deepEqual(tokens, ['Bearer first', 'Bearer fresh']); assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});
for (const kind of ['read', 'write']) test(`settings ${kind} guard remains active through response body`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture();
  global.fetch = async () => { const response = new Response('{}', { status: 200 }); response.json = async () => { f.retire(); return {}; }; return response; };
  await assert.rejects(kind === 'read' ? f.read() : f.api.updateAdminSettings(f.session, f.api.adminSettingsFromJson({}), f.guard), /expired/);
});
test('settings PUT never follows redirects and rechecks the original account before a 401 retry', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; f.retire(); return new Response('', { status: 401 }); };
  await assert.rejects(f.api.updateAdminSettings(f.session, f.api.adminSettingsFromJson({}), f.guard)); assert.equal(sends, 1);
  const live = fixture(); sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 302, headers: { location: '/v1/mobile/next' } }); };
  await assert.rejects(live.api.updateAdminSettings(live.session, live.api.adminSettingsFromJson({}), live.guard), /update failed/); assert.equal(sends, 1);
});
test('settings unavailable original guard prevents all initial read/write traffic', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('{}'); }; f.retire();
  await assert.rejects(f.read(), /expired/); await assert.rejects(f.api.updateAdminSettings(f.session, f.api.adminSettingsFromJson({}), f.guard), /expired/);
  assert.equal(sends, 0); await tick();
});

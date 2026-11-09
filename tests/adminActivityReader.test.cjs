const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), scope = load('sessionReadScope');
const parser = load('shared/notificationApi', { '../authorizedFetch': {} });
const guards = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
function fixture(change = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' },
    capabilities: ['admin.access', 'admin.activity.read'] }; let active = session;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; change(value, () => { active = { ...value }; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminActivityApi', { '../authorizedFetch': transport, '../shared/notificationApi': parser, './adminProductionRequest': guards });
  const reader = load('admin/adminActivityReader', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes, './adminActivityApi': api });
  return { session, read: reader.adminActivityReader(session), switchAccount: () => { active = { ...session }; } };
}
const response = () => new Response(JSON.stringify([{ id: 'one', supplier_name: 'Vendor', status: 'accepted' }]), { status: 200 });
test('activity reader blocks send if account, role, scope or activity permission changes', async () => {
  for (const mutate of [f => f.switchAccount(), f => { f.session.profile.role = 'brigader'; },
    f => { f.session.capabilities = ['admin.access']; }, f => { f.session.baseUrl = 'https://other.example'; }]) {
    const f = fixture(), original = global.fetch; let sends = 0; mutate(f); global.fetch = async () => { sends++; return response(); };
    try { await assert.rejects(f.read(), /session changed/); assert.equal(sends, 0); } finally { global.fetch = original; }
  }
});
test('activity reader blocks a 401 retry after account, permission or role changes and allows token refresh', async () => {
  for (const change of [(s, swap) => swap(), s => { s.profile.role = 'brigader'; }, s => { s.capabilities = ['admin.access']; }]) {
    const f = fixture(change), original = global.fetch; let sends = 0;
    global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : response(); };
    try { await assert.rejects(f.read()); assert.equal(sends, 1); } finally { global.fetch = original; }
  }
  const f = fixture(), original = global.fetch, tokens = [];
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1 ? new Response('', { status: 401 }) : response(); };
  try { assert.equal((await f.read())[0].supplier_name, 'Vendor'); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); }
  finally { global.fetch = original; }
});
test('activity reader rejects a scope change while the response body is parsing', async () => {
  const f = fixture(), original = global.fetch;
  global.fetch = async () => ({ status: 200, headers: new Headers(), clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    json: async () => { f.switchAccount(); return [{ id: 'old' }]; } });
  try { await assert.rejects(f.read(), /session changed/); } finally { global.fetch = original; }
});

test('an invalidated captured witness blocks the activity reader before send', async () => {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' },
    capabilities: ['admin.access', 'admin.activity.read'] }, auth = { activeSessionToken: () => 'first', refreshSession: async () => true };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminActivityApi', { '../authorizedFetch': transport, '../shared/notificationApi': parser, './adminProductionRequest': guards });
  const read = load('admin/adminActivityReader', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes,
    './adminActivityApi': api }).adminActivityReader(session, () => false);
  const original = global.fetch; let sends = 0; global.fetch = async () => { sends++; return response(); };
  try { await assert.rejects(read(), /session changed/); assert.equal(sends, 0); } finally { global.fetch = original; }
});

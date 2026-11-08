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
const scope = load('sessionReadScope');
const model = { adminHomeCanLoadSummary: session => session.capabilities.includes('party.supplier.read') };
function fixture(refreshAction = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' },
    capabilities: ['admin.access', 'party.supplier.read'] };
  let active = session;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { refreshAction(value, () => { active = { ...value }; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminSupplierSummary', { '../authorizedFetch': transport });
  const reader = load('admin/adminHomeSummaryReader', { '../auth': auth, '../sessionReadScope': scope,
    './adminHomeModel': model, './adminSupplierSummary': api });
  return { session, read: reader.adminHomeSummaryReader(session), switchAccount: () => { active = { ...session }; } };
}
function response() { return new Response(JSON.stringify({ total_suppliers: 4, active_suppliers: 3, blocked_suppliers: 1 }), { status: 200 }); }

test('summary reader requires the original session, scope and supplier capability before sending', async () => {
  for (const mutate of [f => { f.session.capabilities = ['admin.access']; }, f => { f.session.profile.role = 'brigader'; }, f => f.switchAccount()]) {
    const f = fixture(), original = global.fetch; let sends = 0; mutate(f); global.fetch = async () => { sends++; return response(); };
    try { await assert.rejects(f.read()); assert.equal(sends, 0); } finally { global.fetch = original; }
  }
});
test('summary reader blocks 401 retry when the refreshed scope or account changed', async () => {
  for (const mutate of [(s) => { s.profile.role = 'brigader'; }, s => { s.capabilities = ['admin.access']; }, (_s, switchAccount) => switchAccount()]) {
    const f = fixture(mutate), original = global.fetch; let sends = 0;
    global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : response(); };
    try { await assert.rejects(f.read()); assert.equal(sends, 1); } finally { global.fetch = original; }
  }
});
test('summary accepts a token-only retry and rejects a response after scope changes', async () => {
  const f = fixture(s => { s.token = 'second'; }), original = global.fetch, tokens = [];
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1 ? new Response('', { status: 401 }) : response(); };
  try { assert.deepEqual(await f.read(), { total_suppliers: 4, active_suppliers: 3, blocked_suppliers: 1 }); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); }
  finally { global.fetch = original; }
  const g = fixture(); global.fetch = async () => { g.session.profile.role = 'brigader'; return response(); };
  try { await assert.rejects(g.read(), /session changed/); } finally { global.fetch = original; }
});

test('an invalidated captured witness stops the summary before a send or post-body result', async () => {
  const f = fixture(), original = global.fetch; let allowed = false, sends = 0;
  const auth = { activeSessionToken: value => value === f.session ? value.token : null, refreshSession: async () => true };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminSupplierSummary', { '../authorizedFetch': transport });
  const reader = load('admin/adminHomeSummaryReader', { '../auth': auth, '../sessionReadScope': scope,
    './adminHomeModel': model, './adminSupplierSummary': api }).adminHomeSummaryReader(f.session, () => allowed);
  global.fetch = async () => { sends++; return response(); };
  try { await assert.rejects(reader(), /session changed/); assert.equal(sends, 0); }
  finally { global.fetch = original; }
  allowed = true;
  global.fetch = async () => ({ status: 200, headers: new Headers(), clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    json: async () => { allowed = false; return { total_suppliers: 4, active_suppliers: 3, blocked_suppliers: 1 }; } });
  try { await assert.rejects(reader(), /session changed/); } finally { global.fetch = original; }
});

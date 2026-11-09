const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} }), exception = load('shared/mobileApiException');
const apparatus = load('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': controls }), dart = load('admin/dartJsonString');
const uri = load('admin/dartUri'), errors = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const station = 'apparatus:default:asset-005', projection = { apparatus_id: station, source_revision: 7, source_aasx_sha256: 'a'.repeat(64),
  display: { display_name: 'Flexo' }, capabilities: { print: 3 }, execution_profile: { operation: 'print', technology: 'flexographic' } };
function fixture(change = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' }, capabilities: ['admin.access'] };
  let active = session, generation = 1;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; change(value, () => { active = { ...value }; }, () => { generation++; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../workerControlsApi': controls, '../shared/mobileApiException': exception });
  const api = load('admin/apparatusCanonicalReadApi', { '../apparatusApi': apparatus, '../authorizedFetch': transport,
    './adminApiError': errors, './adminProductionRequest': request, './dartJsonString': dart, './dartUri': uri });
  const role = session.profile.role, capabilities = JSON.stringify(session.capabilities), capturedGeneration = generation;
  const guard = () => { if (active !== session || session.profile.role !== role || JSON.stringify(session.capabilities) !== capabilities || generation !== capturedGeneration)
    throw new Error('scope changed'); };
  return { session, api, guard };
}
test('canonical read blocks 401 retry on role, capability, account or generation change', async () => {
  for (const change of [session => { session.profile.role = 'customer'; }, session => { session.capabilities = []; },
    (_session, switchAccount) => switchAccount(), (_session, _switchAccount, advance) => advance()]) {
    const f = fixture(change), original = global.fetch; let sends = 0;
    global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify(projection), { status: 200 }); };
    try { await assert.rejects(f.api.adminCanonicalApparatus(f.session, station, f.guard)); assert.equal(sends, 1); }
    finally { global.fetch = original; }
  }
});
test('token-only refresh preserves the encoded path and only changes bearer token', async () => {
  const f = fixture(), original = global.fetch, urls = [], tokens = [];
  global.fetch = async (url, init) => { urls.push(url); tokens.push(new Headers(init.headers).get('authorization'));
    return urls.length === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify(projection), { status: 200 }); };
  try {
    assert.equal((await f.api.adminCanonicalApparatus(f.session, 'apparatus:default:a/b', f.guard)).id, station);
    assert.equal(urls[0], urls[1]); assert.equal(urls[0], 'https://server.example/v1/mobile/admin/apparatus/apparatus%3Adefault%3Aa%2Fb');
    assert.deepEqual(tokens, ['Bearer first', 'Bearer second']);
  } finally { global.fetch = original; }
});
test('an async guard on retry prevents a second send and handles the rejection', async () => {
  const f = fixture(), original = global.fetch; let sends = 0, checks = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const guard = () => { checks++; if (checks === 3) return Promise.reject(new Error('async rejection')); };
  try { await assert.rejects(f.api.adminCanonicalApparatus(f.session, station, guard), /Invalid admin guard/); assert.equal(sends, 1); }
  finally { global.fetch = original; }
  await new Promise(resolve => setImmediate(resolve));
});

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
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString');
const model = load('admin/apparatusCapacityModel', { '../workerControlsApi': controls, '../shared/mobileApiException': exception, './dartJsonString': dart });
const id = 'apparatus:default:print_1';
function fixture(change = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' }, capabilities: ['production.map.manage'] };
  let active = session, generation = 1;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; change(value, () => { active = { ...value }; }, () => { generation++; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/apparatusCapacityApi', { '../authorizedFetch': transport, '../workerControlsApi': controls,
    '../shared/mobileApiException': exception, './apparatusCapacityModel': model, './dartJsonString': dart });
  const role = session.profile.role, capabilities = JSON.stringify(session.capabilities), capturedGeneration = generation;
  const guard = () => { if (active !== session || session.profile.role !== role || JSON.stringify(session.capabilities) !== capabilities || generation !== capturedGeneration)
    throw new Error('scope changed'); };
  return { session, api, guard };
}
const downtime = model.apparatusDowntimeFromJson({ apparatus_id: id });
const calls = [f => f.api.adminApparatusCapacitySnapshot(f.session, f.guard),
  f => f.api.adminSaveApparatusDowntime(f.session, downtime, f.guard),
  f => f.api.adminCancelApparatusScheduleReservation(f.session, 'r', '', f.guard)];
const successful = url => new Response(JSON.stringify(url.endsWith('/cancel') ? { reservation: { apparatus_id: id } } :
  url.endsWith('/downtime') ? { downtime: { apparatus_id: id } } : { capacity: [] }), { status: 200 });
for (const [index, action] of calls.entries()) {
  test(`capacity operation ${index + 1} blocks 401 retry on role, capability, account or generation change`, async () => {
    for (const change of [session => { session.profile.role = 'customer'; }, session => { session.capabilities = []; },
      (_session, switchAccount) => switchAccount(), (_session, _switchAccount, advance) => advance()]) {
      const f = fixture(change), original = global.fetch; let sends = 0;
      global.fetch = async url => { sends++; return sends === 1 ? new Response('', { status: 401 }) : successful(url); };
      try { await assert.rejects(action(f)); assert.equal(sends, 1); } finally { global.fetch = original; }
    }
  });
  test(`capacity operation ${index + 1} permits token-only 401 refresh with unchanged scope`, async () => {
    const f = fixture(), original = global.fetch, tokens = [];
    global.fetch = async (url, init) => { tokens.push(new Headers(init.headers).get('authorization'));
      return tokens.length === 1 ? new Response('', { status: 401 }) : successful(url); };
    try { await action(f); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); } finally { global.fetch = original; }
  });
}

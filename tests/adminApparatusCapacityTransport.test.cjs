const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
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
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../workerControlsApi': controls,
    '../shared/mobileApiException': exception });
  const api = load('admin/apparatusCapacityApi', { './adminProductionRequest': request, '../shared/mobileApiException': exception,
    './apparatusCapacityModel': model, './dartJsonString': dart });
  const role = session.profile.role, capabilities = JSON.stringify(session.capabilities), capturedGeneration = generation;
  const guard = () => { if (active !== session || session.profile.role !== role || JSON.stringify(session.capabilities) !== capabilities || generation !== capturedGeneration)
    throw new Error('scope changed'); };
  return { session, api, guard };
}
const downtime = model.apparatusDowntimeFromJson({ apparatus_id: id });
const calls = [f => f.api.adminApparatusCapacitySnapshot(f.session, f.guard),
  f => f.api.adminSaveApparatusDowntime(f.session, downtime, f.guard),
  f => f.api.adminCancelApparatusScheduleReservation(f.session, 'r', '', f.guard),
  f => f.api.adminSaveApparatusCapacityProfile(f.session, model.apparatusCapacityProfileFromJson({ apparatus_id: id }),
    { capacity: () => 'mobile:canonical-apparatus:capacity:abc-1' }, f.guard),
  f => f.api.adminScheduleApparatusOrder(f.session, { order_id: 'o', apparatus_id: id, apparatus: '', earliest_start_unix: 1, duration_minutes: 1 },
    { schedule: () => 'mobile-schedule:o:123' }, f.guard)];
const successful = (url, init = {}) => new Response(JSON.stringify(url.endsWith('/cancel') || url.endsWith('/schedule') ? { reservation: { apparatus_id: id } } :
  url.endsWith('/downtime') ? { downtime: { apparatus_id: id } } : init.method === 'PUT' ?
    { revision: { revision: { apparatus_id: id, capacity: {} } } } : { capacity: [] }), { status: 200 });
for (const [index, action] of calls.entries()) {
  test(`capacity operation ${index + 1} blocks 401 retry on role, capability, account or generation change`, async () => {
    for (const change of [session => { session.profile.role = 'customer'; }, session => { session.capabilities = []; },
      (_session, switchAccount) => switchAccount(), (_session, _switchAccount, advance) => advance()]) {
      const f = fixture(change), original = global.fetch; let sends = 0;
      global.fetch = async (url, init) => { sends++; return sends === 1 ? new Response('', { status: 401 }) : successful(url, init); };
      try { await assert.rejects(action(f)); assert.equal(sends, 1); } finally { global.fetch = original; }
    }
  });
  test(`capacity operation ${index + 1} permits token-only 401 refresh with unchanged scope`, async () => {
    const f = fixture(), original = global.fetch, tokens = [];
    global.fetch = async (url, init) => { tokens.push(new Headers(init.headers).get('authorization'));
      return tokens.length === 1 ? new Response('', { status: 401 }) : successful(url, init); };
    try { await action(f); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); } finally { global.fetch = original; }
  });
}

test('idempotency factory runs once and the identical profile header survives a 401 retry', async () => {
  const f = fixture(), original = global.fetch, keys = [], bodies = []; let generated = 0;
  global.fetch = async (url, init) => { keys.push(new Headers(init.headers).get('idempotency-key')); bodies.push(init.body);
    return keys.length === 1 ? new Response('', { status: 401 }) : successful(url, init); };
  try {
    await f.api.adminSaveApparatusCapacityProfile(f.session, model.apparatusCapacityProfileFromJson({ apparatus_id: id }),
      { capacity: () => { generated++; return 'mobile:canonical-apparatus:capacity:abc-1'; } }, f.guard);
    assert.equal(generated, 1); assert.deepEqual(keys, ['mobile:canonical-apparatus:capacity:abc-1', 'mobile:canonical-apparatus:capacity:abc-1']);
    assert.equal(bodies[0], bodies[1]);
  } finally { global.fetch = original; }
});
test('schedule factory runs once and identical request body survives a 401 retry', async () => {
  const f = fixture(), original = global.fetch, bodies = []; let generated = 0;
  global.fetch = async (url, init) => { bodies.push(init.body); return bodies.length === 1 ? new Response('', { status: 401 }) : successful(url, init); };
  try {
    await f.api.adminScheduleApparatusOrder(f.session, { order_id: 'o', apparatus_id: id, apparatus: '', earliest_start_unix: 1, duration_minutes: 1 },
      { schedule: () => { generated++; return 'mobile-schedule:o:123'; } }, f.guard);
    assert.equal(generated, 1); assert.equal(bodies[0], bodies[1]); assert.equal(JSON.parse(bodies[0]).idempotency_key, 'mobile-schedule:o:123');
  } finally { global.fetch = original; }
});

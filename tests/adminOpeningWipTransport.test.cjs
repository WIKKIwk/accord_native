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
const inputModel = load('admin/openingWipInput', { './dartJsonString': dart });
const workerBatch = load('workerOpeningWip', { './workerControlsApi': controls });
const workerRecord = load('workerOpeningWipRecordsApi', { './authorizedFetch': {}, './workerControlsApi': controls, './workerOpeningWip': workerBatch });
function fixture(change = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' }, capabilities: ['production.map.manage'] };
  let active = session, generation = 1;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; change(value, () => { active = { ...value }; }, () => { generation++; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../workerControlsApi': controls,
    '../shared/mobileApiException': exception });
  const api = load('admin/openingWipApi', { './adminProductionRequest': request, '../shared/mobileApiException': exception,
    '../workerOpeningWipRecordsApi': workerRecord, './dartJsonString': dart, './openingWipInput': inputModel });
  const role = session.profile.role, capabilities = JSON.stringify(session.capabilities), capturedGeneration = generation;
  const guard = () => { if (active !== session || session.profile.role !== role || JSON.stringify(session.capabilities) !== capabilities || generation !== capturedGeneration)
    throw new Error('scope changed'); };
  return { session, api, guard };
}
const input = { idempotency_key: 'key', order_id: 'order', source_apparatus: 'apparatus:default:a', source_stage_node_id: 'stage', batches: [] };
const calls = [f => f.api.adminCreateOpeningWip(f.session, input, f.guard), f => f.api.adminOpeningWipQrReport(f.session, 'QR', f.guard)];
for (const [index, action] of calls.entries()) {
  test(`opening WIP operation ${index + 1} blocks 401 retry after role, capability, account or generation changes`, async () => {
    for (const change of [session => { session.profile.role = 'customer'; }, session => { session.capabilities = []; },
      (_session, switchAccount) => switchAccount(), (_session, _switchAccount, advance) => advance()]) {
      const f = fixture(change), original = global.fetch; let sends = 0;
      global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : new Response('{"record":{}}', { status: 200 }); };
      try { await assert.rejects(action(f)); assert.equal(sends, 1); } finally { global.fetch = original; }
    }
  });
  test(`opening WIP operation ${index + 1} keeps the same body on token-only 401 refresh`, async () => {
    const f = fixture(), original = global.fetch, tokens = [], bodies = [];
    global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); bodies.push(init.body);
      return tokens.length === 1 ? new Response('', { status: 401 }) : new Response('{"record":{}}', { status: 200 }); };
    try { await action(f); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); assert.equal(bodies[0], bodies[1]); }
    finally { global.fetch = original; }
  });
}

test('invalid async/value guards fail before local validation or any transport send', async () => {
  const invalid = [() => false, async () => false, async () => { throw new Error('async rejection'); },
    () => ({ then(_resolve, reject) { setImmediate(() => reject(new Error('thenable rejected'))); } })];
  for (const guard of invalid) {
    const f = fixture(), original = global.fetch; let sends = 0; global.fetch = async () => { sends++; return new Response('{}', { status: 200 }); };
    try {
      await assert.rejects(f.api.adminCreateOpeningWip(f.session, { ...input, batches: [{ quantity_basis: 'measured',
        finished_goods_meter: NaN, finished_goods_kg: 0, bobina_kg: 0 }] }, guard), /Invalid admin guard/);
      await assert.rejects(f.api.adminOpeningWipQrReport(f.session, '', guard), /Invalid admin guard/); assert.equal(sends, 0);
    } finally { global.fetch = original; }
  }
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
});
test('a guard returning a rejected promise on 401 retry blocks the second send and handles its rejection', async () => {
  const f = fixture(), original = global.fetch; let sends = 0, checks = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const guard = () => { checks++; if (checks === 3) return Promise.reject(new Error('async rejection')); };
  try { await assert.rejects(f.api.adminOpeningWipQrReport(f.session, 'QR', guard), /Invalid admin guard/); assert.equal(sends, 1); }
  finally { global.fetch = original; }
  await new Promise(resolve => setImmediate(resolve));
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString');
const queue = load('workerQueueModels', { './workerControlsApi': controls });
const model = load('admin/adminQueuePolicyModel', { './dartJsonString': dart });
const { AdminQueuePolicyController } = load('admin/adminQueuePolicyController', { './adminQueuePolicyModel': model, './dartJsonString': dart });
const id = 'apparatus:default:print_1', secondId = 'apparatus:default:laminate_1', session = { token: 'fake-test-token' };
const key = 'mobile:canonical-apparatus:queue-policy:abc-1';
const apparatus = (idValue = id, source_revision = 8) => ({ id: idValue, name: ` ${idValue} `, source_revision, source_aasx_sha256: 'old-sha' });
const policy = (changes = {}) => ({ apparatus_id: id, apparatus: 'Print', source_revision: 12, source_aasx_sha256: 'policy-sha',
  policy: 'free_pick', locked: false, reason: '', ...changes });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve: value => resolve(value), reject: value => reject(value) }; }
function apiFixture() {
  let response = new Response('{}'), onSend;
  const calls = [], request = load('admin/adminProductionRequest', { '../authorizedFetch': { authorizedFetch: async (account, url, init, guard, timeout, options) => {
    guard?.(); calls.push({ account, url, init, timeout, options }); if (onSend) await onSend(guard); return response;
  } }, '../workerControlsApi': controls, '../shared/mobileApiException': exception });
  const api = load('admin/adminQueuePolicyApi', { '../../modules/accord-native-clock/src/AccordNativeClockModule': { nativeEpochMicroseconds: () => '1234567890123456' },
    '../workerControlsApi': controls, '../workerQueueModels': queue, '../shared/mobileApiException': exception, './adminProductionRequest': request, './dartJsonString': dart });
  return { ...api, calls, respond(value, status = 200) { response = new Response(JSON.stringify(value), { status }); }, setResponse(value) { response = value; }, onSend(fn) { onSend = fn; } };
}

// Source-derived live contracts from f119 mobile_api_admin_queue_state_models_part_02.dart:240–334.
test('queue policies GET preserves the endpoint, source map/list parser, defaults and last duplicate', async () => {
  const f = apiFixture(); f.respond({ policies: [{ apparatus_id: id, policy: 'unknown', source_revision: 3.9 }, { apparatus_id: id, discipline: 'free_pick', locked: true }] });
  const value = await f.adminApparatusQueuePolicies(session);
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/queue-policies'); assert.equal(f.calls[0].init, undefined);
  assert.equal(value[id].policy, 'free_pick'); assert.equal(value[id].source_revision, 0); assert.equal(value[id].locked, true);
  f.respond({ policies: { ignoredKey: { apparatus_id: secondId } } });
  assert.equal((await f.adminApparatusQueuePolicies(session))[secondId].policy, 'strict_sequence');
  f.respond({ policies: [{ apparatus_id: `\u0085${id}\u0085`, discipline: '\u0085free_pick\u0085', source_aasx_sha256: '\u0085sha\u0085', apparatus: [1, 2], reason: { a: true } }] });
  const adapted = (await f.adminApparatusQueuePolicies(session))[id]; assert.equal(adapted.policy, 'free_pick'); assert.equal(adapted.source_aasx_sha256, 'sha');
  assert.equal(adapted.apparatus, '[1, 2]'); assert.equal(adapted.reason, '{a: true}');
  f.respond({}); assert.deepEqual(await f.adminApparatusQueuePolicies(session), {});
  f.respond({ policies: [null] }); await assert.rejects(f.adminApparatusQueuePolicies(session), /invalid item/);
});
test('queue policy PUT sends exact canonical body and one stable key, then uses committed revision fields', async () => {
  const f = apiFixture(); f.respond({ revision: { aasx_sha256: ' \u0085sha\u0085 ', revision: { apparatus_id: ` ${id} `,
    revision_metadata: { revision: 15.8 }, policies: { queue: ' free_pick ' } } } });
  const saved = await f.adminUpdateApparatusQueuePolicy(session, { apparatusId: `\u0085${id}\u0085`, expectedRevision: 14, policy: 'free_pick' }, undefined, () => key);
  assert.equal(f.calls[0].init.method, 'PUT'); assert.equal(f.calls[0].init.headers['idempotency-key'], key);
  assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { apparatus_id: id, expected_revision: 14, discipline: 'free_pick' });
  assert.deepEqual(saved, policy({ apparatus: '', source_revision: 15, source_aasx_sha256: 'sha' }));
});
test('queue policy acknowledgment uses original ID, next revision and strict policy fallbacks', async () => {
  const f = apiFixture(); f.respond({ revision: { revision: {} } });
  const saved = await f.adminUpdateApparatusQueuePolicy(session, { apparatusId: id, expectedRevision: 8, policy: 'free_pick' }, undefined, () => key);
  assert.deepEqual(saved, policy({ apparatus: '', source_revision: 9, source_aasx_sha256: '', policy: 'strict_sequence' }));
  f.respond({ revision: { revision: { revision_metadata: { revision: '9' } } } });
  await assert.rejects(f.adminUpdateApparatusQueuePolicy(session, { apparatusId: id, expectedRevision: 8, policy: 'free_pick' }, undefined, () => key), TypeError);
});
test('invalid canonical input or key never sends; malformed committed response keeps the source error', async () => {
  const f = apiFixture();
  await assert.rejects(f.adminUpdateApparatusQueuePolicy(session, { apparatusId: 'Print', expectedRevision: 8, policy: 'free_pick' }), error => error.code === 'apparatus_id_invalid');
  await assert.rejects(f.adminUpdateApparatusQueuePolicy(session, { apparatusId: id, expectedRevision: 8, policy: 'free_pick' }, undefined, () => 'bad'), TypeError);
  assert.equal(f.calls.length, 0); f.respond({ ok: true });
  await assert.rejects(f.adminUpdateApparatusQueuePolicy(session, { apparatusId: id, expectedRevision: 8, policy: 'free_pick' }, undefined, () => key),
    error => error instanceof exception.MobileApiException && error.code === 'queue_policies_invalid_response' && error.message === 'Aparat navbat qoidasi javobi noto‘g‘ri');
  f.respond([]); await assert.rejects(f.adminUpdateApparatusQueuePolicy(session, { apparatusId: id, expectedRevision: 8, policy: 'free_pick' }, undefined, () => key), TypeError);
});
test('original queue policy witness reaches reads and rejects retirement during body decoding', async () => {
  const f = apiFixture(); let current = true; const guard = () => { if (!current) throw new Error('retired'); }, witness = () => current;
  f.respond({ policies: [] }); await f.adminApparatusQueuePolicies(session, guard, witness);
  assert.equal(f.calls[0].options.readWitness, witness);
  f.setResponse({ status: 200, json: async () => { current = false; return { policies: [] }; } });
  await assert.rejects(f.adminApparatusQueuePolicies(session, guard, witness), /retired/);
  const count = f.calls.length; await assert.rejects(f.adminApparatusQueuePolicies(session, guard, witness), /retired/); assert.equal(f.calls.length, count);
});
test('native microsecond queue mutation IDs retain base36 timestamp and incrementing counter', () => {
  const f = apiFixture(), a = f.nextAdminQueuePolicyIdempotencyKey(() => '9007199254740993'), b = f.nextAdminQueuePolicyIdempotencyKey(() => '9007199254740993');
  assert.equal(a, `mobile:canonical-apparatus:queue-policy:${9007199254740993n.toString(36)}-1`);
  assert.equal(b, `mobile:canonical-apparatus:queue-policy:${9007199254740993n.toString(36)}-2`);
});
function controllerFixture(overrides = {}) {
  let current = true, cached = null; const calls = [], rows = [apparatus(), apparatus(secondId, 3)];
  const data = { apparatus: rows, policies: { [id]: policy() } };
  const controller = new AdminQueuePolicyController({ isCurrent: () => current, cached: () => cached, cache: value => { cached = value; calls.push('cache'); },
    read: async guard => { guard(); calls.push('read'); return data; },
    write: async (input, guard) => { guard(); calls.push(input); return policy({ apparatus_id: input.apparatusId, policy: input.policy, source_revision: input.expectedRevision + 1 }); }, ...overrides });
  return { controller, calls, rows, data, retire: () => { current = false; }, cache: () => cached };
}
test('effective defaults, optional exact apparatus filter and source order use the existing apparatus catalog', () => {
  const a = apparatus(), b = apparatus(secondId);
  assert.equal(model.adminQueuePolicyEffective(a, {}).policy, 'strict_sequence');
  assert.equal(model.adminQueuePolicyEffective(a, {}).source_revision, 8);
  assert.deepEqual(model.adminQueuePolicyVisible({ apparatus: [b, a], policies: {} }, `\u0085${id}\u0085`), [a]);
  assert.deepEqual(model.adminQueuePolicyVisible({ apparatus: [b, a], policies: {} }), [b, a]);
});
test('the source single warm panel cache remains unscoped across a later mount until another load replaces it', () => {
  const cache = new model.AdminQueuePolicyCache(), a = { apparatus: [apparatus()], policies: {} }, b = { apparatus: [apparatus(secondId)], policies: {} };
  assert.equal(cache.get(), null); cache.set(a); assert.equal(cache.get(), a);
  const laterMount = cache; assert.equal(laterMount.get(), a);
  laterMount.set(b); assert.equal(cache.get(), b);
});
test('panel cache appears before mounting and failed silent refresh keeps its source content', async () => {
  const cached = { apparatus: [apparatus()], policies: {} }, f = controllerFixture({ cached: () => cached, read: async () => { throw new Error('offline'); } });
  assert.equal(f.controller.getSnapshot().data, cached); assert.equal(f.controller.getSnapshot().loading, false);
  f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().data, cached); assert.equal(f.controller.getSnapshot().loadError, null);
});
test('initial error exposes retry, and successful reread replaces cache atomically', async () => {
  let attempts = 0; const expected = { apparatus: [], policies: {} };
  const f = controllerFixture({ read: async () => { if (!attempts++) throw new Error('offline'); return expected; } });
  f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().loading, false); assert.equal(f.controller.getSnapshot().data, null);
  assert.equal(f.controller.getSnapshot().loadError.message, 'offline'); await f.controller.reload();
  assert.equal(f.controller.getSnapshot().data, expected); assert.equal(f.cache(), expected);
});
test('policy writes use effective revision, serialize per apparatus and allow another apparatus concurrently', async () => {
  const writes = [], pending = deferred();
  const f = controllerFixture({ write: async (input, guard) => { guard(); writes.push(input); return input.apparatusId === id ? pending.promise : policy({ apparatus_id: secondId, source_revision: 4 }); } });
  f.controller.start(); await tick(); const first = f.controller.update(f.rows[0], 'strict_sequence');
  await f.controller.update(f.rows[0], 'free_pick'); await f.controller.update(f.rows[1], 'free_pick');
  assert.equal(writes.length, 2); assert.equal(writes[0].expectedRevision, 12); assert.equal(writes[1].expectedRevision, 3);
  assert.equal(f.controller.getSnapshot().saving.has(id), true); assert.equal(f.controller.getSnapshot().saving.has(secondId), false);
  pending.resolve(policy({ source_revision: 13, policy: 'strict_sequence' })); await first;
  assert.equal(f.controller.getSnapshot().policies[id].source_revision, 13); assert.equal(f.controller.getSnapshot().saving.size, 0);
});
test('locked controls do not send; selected unlocked controls still send as V2 does; failure preserves value', async () => {
  const f = controllerFixture({ write: async () => { throw new Error('failed'); } }); f.controller.start(); await tick();
  await f.controller.update(f.rows[0], 'free_pick');
  assert.equal(f.controller.getSnapshot().policies[id].policy, 'free_pick'); assert.equal(f.controller.getSnapshot().errorNotice.error.message, 'failed');
  const serial = f.controller.getSnapshot().errorNotice.serial; f.controller.dismissError(serial); assert.equal(f.controller.getSnapshot().errorNotice, null);
  const locked = controllerFixture({ read: async () => ({ apparatus: f.rows, policies: { [id]: policy({ locked: true }) } }) });
  locked.controller.start(); await tick(); await locked.controller.update(f.rows[0], 'strict_sequence'); assert.equal(locked.calls.filter(call => typeof call === 'object').length, 0);
});
test('retired policy operations never cache or publish their late acknowledgment or send another command', async () => {
  const pending = deferred(), f = controllerFixture({ write: () => pending.promise }); f.controller.start(); await tick();
  const update = f.controller.update(f.rows[0], 'strict_sequence'), cached = f.cache(); f.retire(); pending.resolve(policy({ source_revision: 13 })); await update;
  assert.equal(f.controller.getSnapshot().invalidated, true); assert.equal(f.controller.getSnapshot().data, null); assert.equal(f.cache(), cached);
  await f.controller.update(f.rows[1], 'free_pick'); assert.equal(f.controller.getSnapshot().errorNotice, null);
});

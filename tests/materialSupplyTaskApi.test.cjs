const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const fixture = require('./contracts/f11910bb/material_supply_tasks.json');
const response = (body, status = 200) => ({ body: JSON.stringify(body), status });
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup(plan, change = '') {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: ['apparatus:default:bosma_7'] };
  let active = true, epoch = 1, calls = [], refreshes = 0;
  const auth = { activeSessionToken: s => active && s === session ? session.token : null,
    activeSessionEpoch: s => active && s === session ? epoch : null, refreshSession: async () => {
    refreshes++; session.token = 'fresh';
    if (change === 'role') session.profile.role = 'admin';
    if (change === 'permission') session.capabilities = [];
    if (change === 'identity') session.profile.ref = 'other';
    if (change === 'account') active = false;
    if (change === 'epoch') epoch++;
    return true;
  } };
  const scope = compile('sessionReadScope'), authorized = compile('authorizedFetch', { './auth': auth });
  const controls = compile('workerControlsApi', { './authorizedFetch': authorized, './sessionReadScope': scope });
  const apparatus = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  const saved = compile('workerProductionMapSaved', { './workerControlsApi': controls });
  const dart = compile('shared/dartApparatus', { '../workerControlsApi': controls }), errors = compile('shared/mobileApiException');
  const model = compile('shared/supplyTasks/supplyTaskModels', { '../../apparatusApi': apparatus, '../../workerProductionMapSaved': saved,
    '../dartApparatus': dart, '../mobileApiException': errors });
  const api = compile('shared/supplyTasks/supplyTaskApi', { '../../auth': auth, '../../authorizedFetch': authorized,
    '../../sessionReadScope': scope, '../../workerControlsApi': controls, '../appRoutes': compile('shared/appRoutes'),
    '../dartApparatus': dart, '../mobileApiException': errors, '../camera/synchronousGuard': compile('shared/camera/synchronousGuard'),
    './supplyTaskModels': model });
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init }); const next = plan.shift();
    if (next instanceof Error) throw next;
    if (!next) throw Error('Unexpected network request');
    const result = await next;
    return new Response(result.body, { status: result.status, headers: { 'content-type': 'application/json' } });
  };
  return { session, api, authorized, auth, scope, dart, calls, refreshes: () => refreshes, setActive: value => { active = value; },
    restore: () => { global.fetch = original; } };
}
const wire = fixture.windows.material.input;

// @v2-test test/supply_tasks_api_test.dart
// Request assertions follow V2's local HttpServer test; no HTTP recording was produced by its MockClient recorder.
test('window request carries V2 kind, apparatus, limit and normalized ASCII search', async () => {
  const h = setup([response(fixture.windows.search_subset.input)]);
  try {
    const result = await h.api.readSupplyTaskWindow(h.session, { kind: 'material', search: '\u0085 HELLO \u0085' }, () => true);
    assert.equal(result.search, 'hello'); assert.equal(h.calls.length, 1);
    const url = new URL(h.calls[0].url);
    assert.equal(url.pathname, '/v1/mobile/production-tasks/window');
    assert.deepEqual(Object.fromEntries(url.searchParams), { kind: 'material', apparatus: '', limit: '10', search: 'hello' });
    assert.equal(h.calls[0].init.headers.get('authorization'), 'Bearer old');
    assert.equal(h.calls[0].init.method ?? 'GET', 'GET');
  } finally { h.restore(); }
});

test('Qolip access uses its existing route capability', async () => {
  const h = setup([response(fixture.windows.qolip.input)]); h.session.profile.role = 'qolipchi'; h.session.capabilities = ['qolip.manage'];
  try { assert.equal((await h.api.readSupplyTaskWindow(h.session, { kind: 'qolip' }, () => true)).kind, 'qolip'); }
  finally { h.restore(); }
});

test('same query and lifetime guard deduplicate HTTP, but each caller receives its own guard check', async () => {
  const gate = deferred(), h = setup([gate.promise, response(wire)]); let checks = 0; const current = () => { checks++; return true; };
  try {
    const first = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, current);
    const second = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, current);
    assert.notEqual(first, second); assert.equal(h.calls.length, 1);
    const before = checks; gate.resolve(response(wire)); await Promise.all([first, second]);
    assert.ok(checks >= before + 5); // after response, body, decode and once for each consumer
    await h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, current); assert.equal(h.calls.length, 2);
  } finally { h.restore(); }
});

test('different lifetime guards do not share an in-flight response', async () => {
  const one = deferred(), two = deferred(), h = setup([one.promise, two.promise]); let firstCurrent = true;
  try {
    const first = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => firstCurrent);
    const second = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true);
    assert.equal(h.calls.length, 2); firstCurrent = false; one.resolve(response(wire)); two.resolve(response(wire));
    await assert.rejects(first, /Hisob o‘zgardi/); assert.equal((await second).kind, 'material');
  } finally { h.restore(); }
});

test('each caller checks its lifetime before receiving a shared network error', async () => {
  const gate = deferred(), h = setup([gate.promise]); let current = true; const guard = () => current;
  try {
    const first = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, guard);
    const second = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, guard);
    current = false; gate.reject(Error('old account network detail'));
    await Promise.all([assert.rejects(first, /Hisob o‘zgardi/), assert.rejects(second, /Hisob o‘zgardi/)]);
    assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

test('a mutation epoch change prevents sharing an earlier in-flight query', async () => {
  const one = deferred(), two = deferred(), h = setup([one.promise, two.promise]), current = () => true;
  try {
    const first = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, current);
    h.authorized.invalidateQueueSnapshotReads();
    const second = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, current);
    assert.equal(h.calls.length, 2); one.resolve(response(wire)); two.resolve(response(wire)); await Promise.all([first, second]);
  } finally { h.restore(); }
});

for (const change of ['role', 'permission', 'identity', 'account']) {
  test(`401 refresh cannot retry after ${change} changes`, async () => {
    const h = setup([response({ error: 'expired' }, 401), response(wire)], change);
    try { await assert.rejects(h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true), /Hisob o‘zgardi/);
      assert.equal(h.calls.length, 1); assert.equal(h.refreshes(), 1);
    } finally { h.restore(); }
  });
}

test('same-scope 401 refresh retains a single safe GET retry', async () => {
  const h = setup([response({ error: 'expired' }, 401), response(wire)]);
  try { assert.equal((await h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true)).kind, 'material');
    assert.equal(h.calls.length, 2); assert.equal(h.calls[1].init.headers.get('authorization'), 'Bearer fresh');
  } finally { h.restore(); }
});

test('scope, capability, argument and unsupported Unicode failures send no requests', () => {
  const h = setup([]);
  try {
    assert.throws(() => h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => false), /Hisob o‘zgardi/);
    h.session.capabilities = [];
    assert.throws(() => h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true), /Hisob o‘zgardi/);
    h.session.capabilities = ['raw_material.assign'];
    for (const input of [{ kind: 'admin' }, { kind: 'material', limit: 11 }, { kind: 'material', apparatus: 'Bosma' },
      { kind: 'material', search: 'o‘rik' }, { kind: 'material', apparatus: 'apparatus:default:\u037f' }]) {
      assert.throws(() => h.api.readSupplyTaskWindow(h.session, input, () => true), /Invalid supply task window/);
    }
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
});

test('wrong query response, malformed JSON and denied HTTP do not produce a ready window', async () => {
  const wrong = structuredClone(wire); wrong.kind = 'qolip';
  for (const item of [response(wrong), { status: 200, body: '{' }, response({ error: 'forbidden' }, 403)]) {
    const h = setup([item]);
    try { await assert.rejects(h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true)); assert.equal(h.calls.length, 1); }
    finally { h.restore(); }
  }
});

test('malformed non-200 body keeps the source fallback error instead of becoming an empty result', async () => {
  const h = setup([{ status: 503, body: '<html>unavailable</html>' }]);
  try { await assert.rejects(h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true),
    error => error.code === 'supply_tasks_failed' && error.statusCode === 503);
  } finally { h.restore(); }
});

test('7.0 raw revision remains an explicit unported lexical-validation blocker', async () => {
  const raw = JSON.stringify(wire).replace('"rev":7,', '"rev":7.0,');
  assert.match(raw, /"rev":7\.0,/); assert.equal(fixture.windows.floating_revision.expected.ok, false);
  const h = setup([{ status: 200, body: raw }]);
  try { assert.equal((await h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => true)).revision, 7); }
  finally { h.restore(); }
});

test('supply reader rejects async, truthy non-boolean and throwing guards before network', async () => {
  for (const guard of [() => Promise.resolve(true), () => Promise.reject(Error('async guard')), () => 1, () => 'yes',
    () => { throw Error('guard threw'); }]) {
    const h = setup([]);
    try { assert.throws(() => h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, guard), /Hisob o‘zgardi/);
      assert.equal(h.calls.length, 0);
    } finally { h.restore(); }
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('supply reader detects scope, token or account changes made inside a true guard', () => {
  const changes = [h => { h.session.profile.role = 'admin'; }, h => { h.session.profile.ref = 'other'; },
    h => { h.session.capabilities = []; }, h => { h.session.assigned_item_groups = ['other']; },
    h => { h.session.token = 'different-token'; }, h => { h.setActive(false); }];
  for (const change of changes) {
    const h = setup([]);
    try { assert.throws(() => h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => { change(h); return true; }), /Hisob o‘zgardi/);
      assert.equal(h.calls.length, 0);
    } finally { h.restore(); }
  }
});

test('reentrant supply guard at beforeSend blocks the GET, and after response blocks its data', async () => {
  for (const changeAt of [2, 3]) {
    const h = setup(changeAt === 3 ? [response(wire)] : []); let checks = 0;
    try {
      const pending = h.api.readSupplyTaskWindow(h.session, { kind: 'material' }, () => {
        if (++checks === changeAt) h.session.profile.ref = 'other'; return true;
      });
      await assert.rejects(pending, /Hisob o‘zgardi/); assert.equal(h.calls.length, changeAt === 2 ? 0 : 1);
    } finally { h.restore(); }
  }
});

test('task controller accepts the real reader 401 retry when token rotates within the captured session epoch', async () => {
  const h = setup([response({ error: 'expired' }, 401), response(wire)]);
  const { SupplyTasksController } = compile('shared/supplyTasks/SupplyTasksController', {
    '../../auth': h.auth, '../../sessionReadScope': h.scope, '../appRoutes': compile('shared/appRoutes'),
    '../camera/synchronousGuard': compile('shared/camera/synchronousGuard'), '../dartApparatus': h.dart });
  const controller = new SupplyTasksController({ session: h.session, kind: 'material', isCurrent: () => true,
    loadWindow: (query, current) => h.api.readSupplyTaskWindow(h.session, query, current) });
  try {
    await controller.activate(); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].init.headers.get('authorization'), 'Bearer fresh');
    assert.equal(controller.getSnapshot().window.kind, 'material'); assert.equal(controller.canInteract(), true);
  } finally { controller.dispose(); h.restore(); }
});

for (const change of ['role', 'permission', 'identity', 'account', 'epoch']) {
  test(`task controller prevents reader 401 retry after ${change} changes`, async () => {
    const h = setup([response({ error: 'expired' }, 401), response(wire)], change);
    const { SupplyTasksController } = compile('shared/supplyTasks/SupplyTasksController', {
      '../../auth': h.auth, '../../sessionReadScope': h.scope, '../appRoutes': compile('shared/appRoutes'),
      '../camera/synchronousGuard': compile('shared/camera/synchronousGuard'), '../dartApparatus': h.dart });
    const controller = new SupplyTasksController({ session: h.session, kind: 'material', isCurrent: () => true,
      loadWindow: (query, current) => h.api.readSupplyTaskWindow(h.session, query, current) });
    try { await controller.activate(); assert.equal(h.calls.length, 1); assert.equal(controller.getSnapshot().window, null); }
    finally { controller.dispose(); h.restore(); }
  });
}

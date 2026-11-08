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
const a = 'apparatus:default:bosma_7', b = 'apparatus:default:asset-007';
const ambiguous = (options = [a, b], status = 400) => ({ status, body: { error: 'raw_material_group_ambiguous', apparatus_options: options } });
const success = { status: 200, body: { order_id: 'order', barcode: 'ROLL', apparatus: b } };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function setup(responses) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [a, b] };
  let active = true, current = true, refreshes = 0;
  const auth = { activeSessionToken: s => active && s === session ? session.token : null,
    refreshSession: async () => { refreshes++; session.token = 'new'; return true; } };
  const scope = compile('sessionReadScope'), authorized = compile('authorizedFetch', { './auth': auth });
  const controls = compile('workerControlsApi', { './authorizedFetch': authorized, './sessionReadScope': scope });
  const rawMaterials = { rawMaterialAssignment: value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid material assignment');
    return value;
  } };
  const unlink = compile('rawMaterialUnlinkApi', { './authorizedFetch': authorized, './workerControlsApi': controls,
    './workerRawMaterials': rawMaterials });
  const prep = compile('preparation/preparationInventoryAssignment', { '../apparatusApi': {}, '../authorizedFetch': authorized,
    '../rawMaterialLookupApi': {}, '../rawMaterialUnlinkApi': unlink, '../workerControlsApi': controls,
    '../workerProductionMapSaved': {}, '../workerRawMaterials': rawMaterials });
  const errors = compile('shared/mobileApiException'), routes = compile('shared/appRoutes');
  const { RawMaterialAssignmentCommands } = compile('shared/rawMaterialAssignmentCommands', {
    '../auth': auth, '../preparation/preparationInventoryAssignment': prep, '../rawMaterialUnlinkApi': unlink, '../sessionReadScope': scope,
    '../workerControlsApi': controls, './appRoutes': routes, './mobileApiException': errors,
  });
  const original = global.fetch, calls = [];
  global.fetch = async (url, init) => { calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
    const next = responses.shift(); if (next instanceof Error) throw next;
    if (!next) throw Error('Unexpected extra request');
    const response = await next;
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'content-type': 'application/json' } });
  };
  const command = new RawMaterialAssignmentCommands(session, () => current);
  return { session, command, calls, refreshes: () => refreshes, setCurrent: value => { current = value; },
    setActive: value => { active = value; }, restore: () => { global.fetch = original; } };
}
const opts = chooseApparatus => ({ chooseApparatus, cancelledMessage: 'Homashyoni ulash bekor qilindi' });

// @v2-test test/admin_raw_material_api_test.dart
// The source test's 400 ambiguity and canonical choices use HttpOverrides, not the recorder's MockClient.
test('a definite f119 ambiguity is retried only after the user selects an offered apparatus', async () => {
  const h = setup([ambiguous(), success]); let seen;
  try {
    const saved = await h.command.assignScanned(' order ', ' ROLL ', opts(async choices => { seen = choices; return b; }));
    assert.deepEqual(seen, [a, b]); assert.ok(Object.isFrozen(seen)); assert.equal(saved.apparatus, b);
    assert.equal(h.command.needsReconciliation, false);
    assert.deepEqual(h.calls.map(call => [call.method, call.body]), [
      ['POST', { order_id: 'order', barcode: 'ROLL' }], ['POST', { order_id: 'order', barcode: 'ROLL', apparatus: b }],
    ]);
  } finally { h.restore(); }
});

test('cancelled choice never sends a second assignment', async () => {
  const h = setup([ambiguous()]);
  try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => null)), e =>
    e.code === 'raw_material_assignment_cancelled' && e.message === 'Homashyoni ulash bekor qilindi');
    assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

for (const selected of ['apparatus:default:not-offered', 'not-canonical', '']) {
  test(`invalid or unoffered choice ${JSON.stringify(selected)} cannot send a second assignment`, async () => {
    const h = setup([ambiguous([a, 'not-canonical'])]);
    try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => selected)), /Invalid apparatus choice/);
      assert.equal(h.calls.length, 1);
    } finally { h.restore(); }
  });
}

for (const change of ['screen', 'permission', 'identity', 'account']) {
  test(`scope change during the choice (${change}) prevents a second assignment`, async () => {
    const h = setup([ambiguous()]), choice = deferred(), shown = deferred();
    try {
      const pending = h.command.assignScanned('order', 'ROLL', opts(async () => { shown.resolve(); return choice.promise; }));
      await shown.promise;
      if (change === 'screen') h.setCurrent(false);
      if (change === 'permission') h.session.capabilities = [];
      if (change === 'identity') h.session.profile.ref = 'other';
      if (change === 'account') h.setActive(false);
      choice.resolve(a); await assert.rejects(pending, /Sessiya o‘zgardi/); assert.equal(h.calls.length, 1);
    } finally { h.restore(); }
  });
}

test('missing permission or stale scope prevents the initial request', async () => {
  for (const change of ['permission', 'screen', 'account']) {
    const h = setup([]);
    try { if (change === 'permission') h.session.capabilities = []; if (change === 'screen') h.setCurrent(false);
      if (change === 'account') h.setActive(false);
      await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /Sessiya o‘zgardi/);
      assert.equal(h.calls.length, 0);
    } finally { h.restore(); }
  }
});

test('network failure, server error, malformed response and non-400 ambiguity never auto-repeat', async () => {
  for (const response of [new TypeError('network failure'), ambiguous([a, b], 500), ambiguous([a, b], 409),
    { status: 200, body: null }]) {
    const h = setup([response]); let chosen = false;
    try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => { chosen = true; return a; })));
      assert.equal(chosen, false); assert.equal(h.calls.length, 1);
      assert.equal(h.command.needsReconciliation, true);
      await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /natijasi noaniq/);
      assert.equal(h.calls.length, 1);
    } finally { h.restore(); }
  }
});

test('401 refresh never automatically repeats an assignment that may have reached the server', async () => {
  const h = setup([{ status: 401, body: { error: 'expired' } }, success]);
  try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /natijasi noaniq/);
    assert.equal(h.refreshes(), 1); assert.equal(h.calls.length, 1); assert.equal(h.command.needsReconciliation, true);
    await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /natijasi noaniq/);
    assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

test('the user-chosen second request also cannot retry a 401 automatically', async () => {
  const h = setup([ambiguous(), { status: 401, body: { error: 'expired' } }, success]);
  try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /natijasi noaniq/);
    assert.equal(h.refreshes(), 1); assert.equal(h.calls.length, 2); assert.equal(h.command.needsReconciliation, true);
    await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => a)), /natijasi noaniq/);
    assert.equal(h.calls.length, 2);
  } finally { h.restore(); }
});

test('a command instance serializes assignments and discards late success after scope changes', async () => {
  const pendingResponse = deferred(), h = setup([pendingResponse.promise]);
  try {
    const first = h.command.assignScanned('order', 'ROLL', opts(async () => a));
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(h.command.assignScanned('order', 'OTHER', opts(async () => a)), /Amal bajarilmoqda/);
    h.setCurrent(false); pendingResponse.resolve(success);
    await assert.rejects(first, /Sessiya o‘zgardi/); assert.equal(h.calls.length, 1);
    assert.equal(h.command.needsReconciliation, true);
  } finally { h.restore(); }
});

test('a successful first assignment returns without opening the choice', async () => {
  const h = setup([success]); let opened = false;
  try { assert.deepEqual(await h.command.assignScanned('order', 'ROLL', opts(async () => { opened = true; return a; })), success.body);
    assert.equal(opened, false); assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

test('ambiguous response without usable options is not repeated', async () => {
  for (const options of [[], [' ', '']]) {
    const h = setup([ambiguous(options)]); let opened = false;
    try { await assert.rejects(h.command.assignScanned('order', 'ROLL', opts(async () => { opened = true; return a; })),
      e => e.code === 'raw_material_group_ambiguous');
      assert.equal(opened, false); assert.equal(h.calls.length, 1);
    } finally { h.restore(); }
  }
});

const candidate = options => ({ barcode: 'ROLL', apparatus_options: options });
const linked = (status = 'available', consumed = 0) => ({ order_id: 'order', barcode: 'ROLL', stock_status: status, consumed_qty: consumed });
const manual = { kind: 'manual' }, scan = detailStatus => ({ kind: 'scan', detailStatus });

test('manual candidate requires confirmation, uses the sole apparatus directly, and preserves the V2 request', async () => {
  const h = setup([success]); let selections = 0;
  try {
    assert.equal(await h.command.assignCandidate('order', candidate([a]), async () => false, async () => { selections++; return a; }), null);
    assert.equal(h.calls.length, 0);
    await h.command.assignCandidate(' order ', candidate([a]), async () => true, async () => { selections++; return a; });
    assert.equal(selections, 0);
    assert.deepEqual(h.calls.map(call => [call.method, call.body]), [['POST', { order_id: 'order', barcode: 'ROLL', apparatus: a }]]);
  } finally { h.restore(); }
});

test('manual candidate with multiple choices permits only an offered, explicitly chosen apparatus', async () => {
  const h = setup([success]); let shown;
  try {
    assert.equal(await h.command.assignCandidate('order', candidate([a, b]), async () => true, async options => {
      shown = options; return null;
    }), null);
    assert.deepEqual(shown, [a, b]); assert.equal(h.calls.length, 0);
    await assert.rejects(h.command.assignCandidate('order', candidate([a, b]), async () => true,
      async () => 'apparatus:default:not-offered'), /Invalid apparatus choice/);
    assert.equal(h.calls.length, 0);
    await h.command.assignCandidate('order', candidate([a, b]), async () => true, async () => b);
    assert.equal(h.calls[0].body.apparatus, b);
  } finally { h.restore(); }
});

for (const during of ['confirmation', 'apparatus choice']) {
  test(`manual candidate cannot send after scope changes during ${during}`, async () => {
    const h = setup([]), gate = deferred(), shown = deferred();
    try {
      const pending = h.command.assignCandidate('order', candidate([a, b]),
        async () => { if (during === 'confirmation') { shown.resolve(); return gate.promise; } return true; },
        async () => { shown.resolve(); return gate.promise; });
      await shown.promise; h.setCurrent(false); gate.resolve(during === 'confirmation' ? true : a);
      await assert.rejects(pending, /Sessiya o‘zgardi/); assert.equal(h.calls.length, 0);
    } finally { h.restore(); }
  });
}

test('manual candidate 401 is not retried and requires reconciliation', async () => {
  const h = setup([{ status: 401, body: { error: 'expired' } }, success]);
  try { await assert.rejects(h.command.assignCandidate('order', candidate([a]), async () => true, async () => a), /natijasi noaniq/);
    assert.equal(h.calls.length, 1); assert.equal(h.command.needsReconciliation, true);
    await assert.rejects(h.command.assignCandidate('order', candidate([a]), async () => true, async () => a), /natijasi noaniq/);
    assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

test('manual and scanned unlinkability preserve their distinct f119 status rules', async () => {
  for (const [assignment, source] of [[linked('in_use'), manual], [linked('consumed'), manual],
    [linked('available', 1), scan('available')], [linked('', 0), scan('reserved')]]) {
    const h = setup([]); let confirmed = false;
    try { await assert.rejects(h.command.unlink(assignment, source, async () => { confirmed = true; return true; }), /uzib bo‘lmaydi/);
      assert.equal(confirmed, false); assert.equal(h.calls.length, 0);
    } finally { h.restore(); }
  }
  // Manual list uses stock status alone; scanned details also check consumed quantity.
  const h = setup([success, success]);
  try { await h.command.unlink(linked(' AVAILABLE ', 1), manual, async () => true);
    await h.command.unlink(linked('', 0), scan('available'), async () => true);
    assert.deepEqual(h.calls.map(call => [call.method, call.body]), [
      ['DELETE', { order_id: 'order', barcode: 'ROLL' }], ['DELETE', { order_id: 'order', barcode: 'ROLL' }],
    ]);
  } finally { h.restore(); }
});

test('unlink cancel and stale confirmation never send DELETE', async () => {
  const h = setup([]), gate = deferred(), shown = deferred();
  try {
    assert.equal(await h.command.unlink(linked(), manual, async () => false), null);
    const pending = h.command.unlink(linked(), manual, async () => { shown.resolve(); return gate.promise; });
    await shown.promise; h.session.capabilities = []; gate.resolve(true);
    await assert.rejects(pending, /Sessiya o‘zgardi/); assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
});

test('unlink 401 is not retried and requires reconciliation', async () => {
  const h = setup([{ status: 401, body: { error: 'expired' } }, success]);
  try { await assert.rejects(h.command.unlink(linked(), manual, async () => true), /natijasi noaniq/);
    assert.equal(h.calls.length, 1); assert.equal(h.command.needsReconciliation, true);
    await assert.rejects(h.command.unlink(linked(), manual, async () => true), /natijasi noaniq/);
    assert.equal(h.calls.length, 1);
  } finally { h.restore(); }
});

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
function setup(change) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: ['apparatus:default:asset-005'] };
  let active = true, calls = 0, guards = 0;
  const scope = compile('sessionReadScope'), initialScope = scope.sessionReadScope(session);
  const auth = { activeSessionToken: s => active && s === session ? session.token : null, refreshSession: async () => {
    session.token = 'refreshed';
    if (change === 'role') session.profile.role = 'admin';
    if (change === 'capability') session.capabilities = [];
    if (change === 'identity') session.profile.ref = 'other';
    if (change === 'account') active = false;
    return true;
  } };
  const authorized = compile('authorizedFetch', { './auth': auth });
  const controls = compile('workerControlsApi', { './authorizedFetch': authorized, './sessionReadScope': scope });
  const apparatus = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  const gscale = compile('gscale/gscaleAdminApi', { '../authorizedFetch': authorized, '../workerControlsApi': controls,
    '../workerProductionMapSaved': { productionMapSavedFromJson: value => value } });
  const lookup = compile('rawMaterialLookupApi', { './apparatusApi': apparatus, './workerControlsApi': controls,
    './workerRawMaterials': { rawMaterialAssignment: value => value }, './workerProductionMapSaved': { productionMapDefinitionFromJson: value => value },
    './workerQueueModels': { parseApparatusQueueStateMap: value => value ?? {} }, './workerClosedOrders': { productionOrderLogFromJson: value => value } });
  const assignment = compile('shared/rawMaterialAssignmentApi', { '../apparatusApi': apparatus, '../workerControlsApi': controls,
    './mobileApiException': compile('shared/mobileApiException') });
  const original = global.fetch;
  global.fetch = async url => {
    calls++;
    const isObject = /\/(lookup|diagnostics)\?/.test(String(url));
    return new Response(calls === 1 ? '{"error":"expired"}' : isObject ? '{}' : '[]',
      { status: calls === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } });
  };
  const guard = () => { guards++; if (!active || scope.sessionReadScope(session) !== initialScope) throw Error('Sessiya o‘zgardi'); };
  return { session, apparatus, gscale, lookup, assignment, guard, counts: () => ({ calls, guards }), restore: () => { global.fetch = original; } };
}
const reads = {
  orders: (h, guard) => h.gscale.adminRawMaterialAssignmentOrders(h.session, guard),
  apparatus: (h, guard) => h.apparatus.adminApparatus(h.session, { limit: 10000, beforeSend: guard }),
  lookup: (h, guard) => h.lookup.adminRawMaterialLookup(h.session, 'ROLL', guard),
  candidates: (h, guard) => h.assignment.adminRawMaterialAssignmentCandidates(h.session, 'order', '', guard),
  diagnostics: (h, guard) => h.assignment.adminRawMaterialAssignmentDiagnostics(h.session, 'ROLL', 'order', '', guard),
};
for (const [name, read] of Object.entries(reads)) {
  for (const change of ['role', 'capability', 'identity', 'account']) {
    test(`${name} cannot retry a 401 after ${change} changes`, async () => {
      const h = setup(change);
      try { await assert.rejects(read(h, h.guard)); assert.equal(h.counts().calls, 1); }
      finally { h.restore(); }
    });
  }
  test(`${name} preserves the default unguarded 401 retry`, async () => {
    const h = setup('none');
    try { await read(h); assert.deepEqual(h.counts(), { calls: 2, guards: 0 }); }
    finally { h.restore(); }
  });
}

test('scope guard failure is never treated as a transient TypeError or retried', async () => {
  const h = setup('none'); let invocations = 0; const error = new TypeError('scope invalid');
  try {
    await assert.rejects(h.apparatus.readApparatus(h.session, '/v1/mobile/admin/apparatus', true, undefined,
      () => { invocations++; throw error; }), value => value === error);
    assert.equal(invocations, 1); assert.equal(h.counts().calls, 0);
  } finally { h.restore(); }
});

test('legacy readers preserve their original underlying call signatures when no guard is supplied', async () => {
  const lengths = [], controls = { isCanonicalApparatusId: () => true, WorkerControlException: class extends Error {},
    productionMapResponseError: () => Error('unexpected') };
  const authorized = { authorizedFetch: async (...args) => { lengths.push(args.length); return new Response('[]', { status: 200 }); } };
  const apparatus = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  const gscale = compile('gscale/gscaleAdminApi', { '../authorizedFetch': authorized, '../workerControlsApi': controls,
    '../workerProductionMapSaved': { productionMapSavedFromJson: value => value } });
  await gscale.adminRawMaterialAssignmentOrders({}); await apparatus.adminApparatus({});
  assert.deepEqual(lengths, [2, 3]); lengths.length = 0;
  const read = { readApparatus: async (...args) => { lengths.push(args.length); const path = args[1];
    return { response: { status: 200 }, body: path.includes('/candidates?') ? '[]' : '{}' }; } };
  const lookup = compile('rawMaterialLookupApi', { './apparatusApi': read, './workerControlsApi': controls,
    './workerRawMaterials': { rawMaterialAssignment: value => value }, './workerProductionMapSaved': { productionMapDefinitionFromJson: value => value },
    './workerQueueModels': { parseApparatusQueueStateMap: () => ({}) }, './workerClosedOrders': { productionOrderLogFromJson: value => value } });
  const assignment = compile('shared/rawMaterialAssignmentApi', { '../apparatusApi': read, '../workerControlsApi': controls,
    './mobileApiException': compile('shared/mobileApiException') });
  await lookup.adminRawMaterialLookup({}, 'ROLL'); await assignment.adminRawMaterialAssignmentCandidates({}, 'order');
  await assignment.adminRawMaterialAssignmentDiagnostics({}, 'ROLL'); assert.deepEqual(lengths, [3, 3, 3]);
});

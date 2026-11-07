const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(filename, mocks) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id), mocks);
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
function setup(stem, name, options = {}) {
  const replay = contractFetch(stem, name, options), session = recordedSession(stem, name);
  session.profile = { role: 'tayyorlov_masteri', ref: 'worker' }; session.capabilities = ['preparation.access'];
  const api = load('preparationManagementApi', { '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } }, '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => {
    guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } } });
  return { api, session, replay };
}
// @v2-test test/preparation_material_management_test.dart
test('own materials can be listed and renamed', async () => {
  const { api, session, replay } = setup('preparation_material_management_test', 'rename prefilled own material, duplicate=false', { onlyPaths: ['/v1/mobile/preparation/materials'] });
  assert.equal((await api.preparationOwnedMaterials(session))[0].item_code, 'PREP-1');
  assert.equal(await api.preparationRenameMaterial(session, 'PREP-1', ' New glue '), 'New glue');
  replay.assertDone();
});
// @v2-test test/preparation_material_management_test.dart
test('duplicate material names retain the V2 error message', async () => {
  const { api, session, replay } = setup('preparation_material_management_test', 'rename prefilled own material, duplicate=true', { onlyPaths: ['/v1/mobile/preparation/materials'] });
  await api.preparationOwnedMaterials(session);
  await assert.rejects(api.preparationRenameMaterial(session, 'PREP-1', 'New glue'), e => e.code === 'preparation_material_name_taken' && e.message.includes('Boshqa nom'));
  replay.assertDone();
});
// @v2-test test/preparation_material_management_test.dart
test('delete and warehouse assignment keep the server confirmation', async () => {
  let run = setup('preparation_material_management_test', 'delete requires confirmation and removes only on success, blocked=false',
    { onlyPaths: ['/v1/mobile/preparation/materials'] });
  await run.api.preparationOwnedMaterials(run.session);
  await run.api.preparationDeleteMaterial(run.session, 'PREP-1'); run.replay.assertDone();
  run = setup('preparation_material_management_test', 'three-dot warehouse editing uses exclusive choices, blocked=false',
    { onlyPaths: ['/v1/mobile/preparation/materials', '/v1/mobile/preparation/materials/warehouses'] });
  await run.api.preparationOwnedMaterials(run.session);
  assert.deepEqual((await run.api.preparationSetMaterialWarehouses(run.session, 'PREP-1', ['Second'])).warehouses, ['Second']); run.replay.assertDone();
});
test('warehouse options use the lightweight scoped read and validate the response', async () => {
  let status = 200, body = { item_code: 'PREP-1', warehouses: ['Shared'], editable_warehouses: ['Own'] };
  const calls = [];
  const api = load('preparationManagementApi', {
    '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } },
    '../authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => { guard(); calls.push(url);
      return new Response(JSON.stringify(body), { status }); } },
  });
  const session = { baseUrl: 'https://test.invalid', profile: { role: 'tayyorlov_masteri', ref: 'prep' }, capabilities: ['preparation.access'] };
  assert.deepEqual(await api.preparationMaterialWarehouseOptions(session, ' PREP-1 '), { assigned: ['Shared'], editable: ['Own'] });
  assert.equal(calls[0], '/v1/mobile/preparation/materials/warehouses?item_code=PREP-1');
  body = { ...body, item_code: 'OTHER' };
  await assert.rejects(api.preparationMaterialWarehouseOptions(session, 'PREP-1'), /mos kelmadi/);
  body = { item_code: 'PREP-1', warehouses: ['Shared'], editable_warehouses: [1] };
  await assert.rejects(api.preparationMaterialWarehouseOptions(session, 'PREP-1'), /mos kelmadi/);
  status = 405;
  assert.equal(await api.preparationMaterialWarehouseOptions(session, 'PREP-1'), null);
  status = 403; body = { error: 'forbidden' };
  await assert.rejects(api.preparationMaterialWarehouseOptions(session, 'PREP-1'), error => error.statusCode === 403);
});
// @v2-test test/preparation_warehouse_management_test.dart
for (const code of ['preparation_warehouse_name_taken', 'preparation_warehouse_not_exclusive', 'unknown']) {
  test(`warehouse rename preserves error mapping: ${code}`, async () => {
    const { api, session, replay } = setup('preparation_warehouse_management_test', `warehouse errors are readable: ${code}`);
    await assert.rejects(api.preparationRenameWarehouse(session, 'Child', 'Own'), e => e.code === code && e.statusCode === 409 && !e.message.includes('dhsjkl'));
    replay.assertDone();
  });
}
// V2 has no recorded create/delete test: verify the requests and confirmation against its source.
test('warehouse create and delete use trimmed names and require a warehouse confirmation', async () => {
  const calls = [];
  const api = load('preparationManagementApi', {
    '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } },
    '../authorizedFetch': { authorizedFetch: async (session, path, init, guard) => {
      guard(); calls.push({ path, ...init });
      return new Response(JSON.stringify({ warehouse: ' Child ' }), { status: 200 });
    } },
  });
  const session = { baseUrl: 'https://mini-rs-erp-test.wspace.sbs', profile: { role: 'tayyorlov_masteri', ref: 'prep' }, capabilities: ['preparation.access'] };
  assert.equal(await api.preparationCreateWarehouse(session, ' Child ', ' Parent '), 'Child');
  await api.preparationDeleteWarehouse(session, ' Child ');
  assert.equal(calls[0].path, '/v1/mobile/preparation/warehouses');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].body), { name: 'Child', parent_warehouse: 'Parent' });
  assert.equal(calls[1].method, 'DELETE');
  assert.equal(calls[1].path, '/v1/mobile/preparation/warehouses?warehouse=Child');
});
// @v2-test test/preparation_material_management_test.dart
for (const role of ['material_taminotchi', 'homashyo_rezkachi']) {
  test(`${role} cannot list or mutate preparation materials`, async () => {
    const x = setup('preparation_material_management_test', 'rename prefilled own material, duplicate=false', { onlyPaths: ['/v1/mobile/preparation/materials'] });
    x.session.profile.role = role;
    for (const operation of [() => x.api.preparationOwnedMaterials(x.session), () => x.api.preparationRenameMaterial(x.session, 'PREP-1', 'No'),
      () => x.api.preparationDeleteMaterial(x.session, 'PREP-1'), () => x.api.preparationSetMaterialWarehouses(x.session, 'PREP-1', ['Own'])]) {
      await assert.rejects(operation(), e => e.code === 'forbidden');
    }
  });
}

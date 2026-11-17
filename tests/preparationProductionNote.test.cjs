const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '../src', name.endsWith('.ts') ? name : `${name}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id), mocks, cache) : require(id);
  cache.set(filename, mod.exports);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const note = (text = '', revision = 0, order_id = 'order-a') => ({ order_id, text, revision, updated_by_ref: revision ? 'master' : '', updated_by_name: revision ? 'Master' : '', updated_at: revision ? '2026-11-17T06:00:00Z' : null });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const model = load('shared/productionOrderNote');
const { PreparationProductionNoteEditor: Editor } = load('preparation/preparationProductionNoteEditor');

test('note counts Unicode characters, accepts multiline/clear and checks persisted metadata and order identity', () => {
  assert.equal(model.productionNoteText(`  ${'🫖'.repeat(2000)}  `).length, 4000);
  assert.throws(() => model.productionNoteText('🫖'.repeat(2001)), /2000/);
  assert.throws(() => model.productionNoteText('bad\0'), /2000/);
  assert.equal(model.productionNoteText('  Birinchi\nIkkinchi  '), 'Birinchi\nIkkinchi');
  assert.equal(model.productionNoteText('  '), '');
  assert.throws(() => model.productionOrderNoteFromJson(note('x', 1, 'other'), 'order-a'), /noto‘g‘ri/);
  assert.throws(() => model.productionOrderNoteFromJson(note('invalid', 0)), /noto‘g‘ri/);
  assert.throws(() => model.productionOrderNoteFromJson({ ...note('x', 1), updated_at: null }), /noto‘g‘ri/);
  const saved = model.productionOrderNoteFromJson(note('New', 2));
  assert.equal(model.latestProductionOrderNote(note('Old', 1), saved), saved);
  assert.equal(model.latestProductionOrderNote(note('Other', 5, 'order-b'), saved).order_id, 'order-b');
  assert.equal(model.latestProductionOrderNote(note('', 3), saved).text, '', 'remote clearing replaces a previous saved note');
});

test('editor saves one request, freezes the submitted draft and shows only server-confirmed text', async () => {
  const pending = deferred(), calls = [];
  const editor = new Editor('order-a', () => true, (text, revision) => { calls.push({ text, revision }); return pending.promise; });
  editor.open(note()); assert.equal(editor.canSave, false);
  editor.change('  Saqlansin\n🫖  '); const saving = editor.save(); await editor.save();
  editor.change('must not replace'); editor.cancel();
  assert.equal(editor.snapshot().saving, true); assert.equal(editor.snapshot().confirmed, null);
  assert.equal(editor.snapshot().draft, '  Saqlansin\n🫖  ');
  assert.deepEqual(calls, [{ text: 'Saqlansin\n🫖', revision: 0 }]);
  pending.resolve(note('Saqlansin\n🫖', 1)); await saving;
  assert.equal(editor.snapshot().original, null); assert.equal(editor.snapshot().confirmed.text, 'Saqlansin\n🫖');
  editor.open(note()); assert.equal(editor.snapshot().original.revision, 1, 'stale poll cannot reopen revision zero');
  editor.change(''); await editor.save(); // the fake server still returns the old text/revision
  assert.ok(editor.snapshot().error); assert.equal(editor.snapshot().draft, '');
});

test('conflict/network failure preserves draft and clearing requires server acknowledgement', async () => {
  let fail = true;
  const editor = new Editor('order-a', () => true, async (text, revision) => {
    if (fail) throw new Error('Eslatma o‘zgartirilgan. Oynani yopib, qayta oching');
    return note(text, revision + 1);
  });
  editor.open(note('Original', 2)); editor.change('Draft'); await editor.save();
  assert.equal(editor.snapshot().draft, 'Draft'); assert.equal(editor.snapshot().original.revision, 2);
  assert.equal(editor.snapshot().confirmed, null); assert.match(editor.snapshot().error, /o‘zgartirilgan/);
  fail = false; editor.change(' '); await editor.save(); assert.equal(editor.snapshot().confirmed.text, '');
  assert.equal(editor.snapshot().confirmed.revision, 3);
});

test('expired account or invalidated editor discards a late response and cannot send again', async () => {
  const pending = deferred(); let current = true, calls = 0;
  const editor = new Editor('order-a', () => current, async () => { calls++; return pending.promise; });
  editor.open(note()); editor.change('Pending'); const saving = editor.save();
  current = false; editor.invalidate(); pending.resolve(note('Pending', 1)); await saving;
  assert.equal(editor.snapshot().confirmed, null); assert.equal(editor.snapshot().original, null); assert.equal(editor.snapshot().draft, '');
  current = true; editor.open(note()); editor.change('Again'); await editor.save(); assert.equal(calls, 1);
});

function apiSetup(send) {
  let current = true, sends = 0;
  class ApiError extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
  const api = load('preparation/preparationProductionNoteApi', {
    '../auth': { captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => current },
    '../authorizedFetch': { authorizedFetch: async (session, url, init, guard) => { guard(); sends++; return send({ session, url, init, guard, expire: () => { current = false; } }); } },
    '../workerControlsApi': { WorkerControlException: ApiError },
  });
  return { api, expire: () => { current = false; }, sends: () => sends,
    session: { baseUrl: 'https://example.test', profile: { role: 'tayyorlov_masteri', ref: 'master' }, capabilities: ['preparation.access'] } };
}
test('API sends normalized PATCH with expected revision and validates its confirmation', async () => {
  const env = apiSetup(async ({ url, init }) => {
    assert.equal(url, '/v1/mobile/preparation/production/order/note'); assert.equal(init.method, 'PATCH');
    assert.deepEqual(JSON.parse(init.body), { order_id: 'order-a', text: 'Bir\nIkki', expected_revision: 0 });
    return new Response(JSON.stringify({ preparation_note: note('Bir\nIkki', 1) }));
  });
  const saved = await env.api.savePreparationProductionNote(env.session, ' order-a ', '  Bir\nIkki  ', 0);
  assert.equal(saved.revision, 1); assert.equal(env.sends(), 1);
  await assert.rejects(env.api.savePreparationProductionNote(env.session, 'order-a', 'x'.repeat(2001), 0), /2000/);
  assert.equal(env.sends(), 1);
});
test('API rejects stale accounts before send and after response body decoding', async () => {
  const before = apiSetup(() => { throw new Error('must not send'); }); before.expire();
  await assert.rejects(before.api.savePreparationProductionNote(before.session, 'order-a', 'Text', 0), /Akkaunt/);
  assert.equal(before.sends(), 0);
  const after = apiSetup(async ({ expire }) => ({ status: 200, json: async () => { expire(); return { preparation_note: note('Text', 1) }; } }));
  await assert.rejects(after.api.savePreparationProductionNote(after.session, 'order-a', 'Text', 0), /Akkaunt/);
});
test('API rejects conflict, wrong order, stale revision and mismatched saved text', async () => {
  for (const result of [note('Text', 1, 'other'), note('Text', 0), note('Other', 1)]) {
    const env = apiSetup(async () => new Response(JSON.stringify({ preparation_note: result })));
    await assert.rejects(env.api.savePreparationProductionNote(env.session, 'order-a', 'Text', 0));
  }
  const env = apiSetup(async () => new Response(JSON.stringify({ error: 'Eslatma o‘zgartirilgan' }), { status: 409 }));
  await assert.rejects(env.api.savePreparationProductionNote(env.session, 'order-a', 'Text', 0), error => error.statusCode === 409);
});

test('production journal and inventory decode the same original-order note, independent of current assignment', () => {
  const saved = note('Original order note', 2);
  const models = load('preparation/preparationProductionModel');
  const order = { order_id: 'order-a', active_batch_count: 0, batch_count: 1, roll_count: 1, total_net_kg: '10', total_length_m: '20', preparation_note: saved };
  assert.deepEqual(models.preparationProductionOrderFromJson(order).preparation_note, saved);
  assert.equal(models.preparationProductionOrderFromJson({ ...order, preparation_note: undefined }).preparation_note.revision, 0);
  assert.throws(() => models.preparationProductionOrderFromJson({ ...order, preparation_note: note('wrong', 1, 'order-b') }));
  const inventory = load('inventoryModels', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const asset = inventory.inventoryAssetFromJson({ asset_ref: 'raw:1', order_assignment: { order_id: 'order-b', order_label: 'Other order' }, preparation_note: saved });
  assert.deepEqual(asset.preparation_note, saved); assert.equal(asset.order_assignment.order_id, 'order-b');
});

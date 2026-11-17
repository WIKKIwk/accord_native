const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function fixture(handler = async () => ({ status: 200, json: async () => ({ templates: [] }) })) {
  const root = path.resolve(__dirname, '../src'), cache = new Map(), calls = [];
  const session = { token: 'token', baseUrl: 'https://test.invalid', profile: { role: 'brigader', ref: 'leader' }, capabilities: ['brigader.access'] };
  let current = session;
  const overrides = {
    'auth.ts': { currentSession: () => current },
    'authorizedFetch.ts': { authorizedFetch: async (...args) => { calls.push(args); args[3]?.(); return handler(...args); } },
    'workerControlsApi.ts': { isCanonicalApparatusId: () => true },
  };
  function load(file) {
    const absolute = path.resolve(root, file), relative = path.relative(root, absolute);
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loaded = new Module(absolute, module); loaded.filename = absolute; loaded.paths = module.paths; cache.set(absolute, loaded);
    loaded.require = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(absolute), name)) + '.ts') : require(name);
    loaded._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, absolute);
    return loaded.exports;
  }
  return { session, calls, load, model: load('admin/calculateOrderTemplateModel.ts'), api: load('admin/calculateOrderTemplateApi.ts'),
    store: load('admin/calculateOrderTemplateStore.ts'), switchAccount: value => { current = value; } };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (body, status = 200) => ({ status, json: async () => body });

// @v2-test test/admin_calculate_order_store_test.dart
test('archive API uses source GET, preserves list order/defaults and skips only non-map entries', async () => {
  const f = fixture(async () => response({ templates: [null, 1, { id: ' one ', width_mm: '530', name: ' Name ' }, { id: 'two', layers: null }] }));
  const rows = await f.api.calculateOrderTemplates(f.session);
  assert.equal(f.calls[0][1], '/v1/mobile/calculate/orders'); assert.equal(f.calls[0][2], undefined);
  assert.deepEqual(rows.map(row => row.id), ['one', 'two']); assert.equal(rows[0].frame_product_size_mm, 515);
  assert.equal(rows[0].frame_count, 1); assert.equal(rows[0].waste_percent, 5); assert.equal(rows[0].saved_at.getTime(), 0);
  assert.equal(rows[1].production_options, null); assert.equal(rows[1].roll_count, null);
  assert.throws(() => f.model.calculateOrderTemplateFromJson({ layers: 'bad' }), TypeError);
  const bad = fixture(async () => response({ templates: {} })); await assert.rejects(bad.api.calculateOrderTemplates(bad.session), TypeError);
});

test('template decoding reuses existing representation with Dart text conversion and NEXT LINE trim', () => {
  const f = fixture(), template = f.model.calculateOrderTemplateFromJson({ id: '\u0085 ID \u0085', name: { k: [1, true] }, width_mm: '\u0085 530 \u0085',
    layers: [{ material_id: 'only-id' }, { material: '\u0085 PET ', micron: 12 }], production_options: { print_method: '\u0085 FLEXO \u0085', cold_glue: true },
    combo: { id: { k: 1 }, name: [1, 'x'] } });
  assert.equal(template.id, 'ID'); assert.equal(template.name, '{k: [1, true]}'); assert.equal(template.width_mm, 530);
  assert.deepEqual(template.layers, [{ material_id: '', material: 'PET', micron: '12' }]); assert.equal(template.combo.id, '{k: 1}');
  assert.equal(template.combo.name, '[1, x]'); assert.equal(f.model.calculateOrderTemplateEffectivePrintMethod(template), 'flexo');
  for (const [status, expected] of [['Flexo', 'flexo'], ['Rulon', 'metal'], ['rulo', 'metal'], ['paket', 'metal'], ['unknown', '']])
    assert.equal(f.model.calculateOrderTemplateEffectivePrintMethod(f.model.calculateOrderTemplateFromJson({ status })), expected);
});

test('serializer sends all source fields, six-digit UTC time, optional omissions and effective legacy layers', () => {
  const f = fixture(), template = f.model.calculateOrderTemplateFromJson({ id: ' ID ', code: ' CODE ', name: ' Name ', saved_at: '2026-01-15T10:00:00.123456+05:00',
    first_layer_material: ' PET ', first_layer_micron: ' 12 ', second_layer_material: '', third_layer_micron: ' 40 ',
    kg: -1, roll_count: null, print_val_size_mm: null, variant_id: 'v', production_options: { print_method: 'flexo', cold_glue: true },
    products: [{ id: ' p ', item_code: ' sku ', product: ' Product ', frame_product_size_mm: 100, frame_count: 2 }],
    combo: { id: 'combo', item_code: 'sku', name: 'Combo', revision: 2, layout_fingerprint: 'finger' } });
  const body = f.model.calculateOrderTemplateToJson(template);
  assert.equal(body.saved_at, '2026-01-15T05:00:00.123456Z'); assert.equal(body.id, 'ID'); assert.equal(body.code, 'CODE');
  assert.deepEqual(body.layers, [{ material: 'PET', micron: '12' }, { material: '', micron: '40' }]);
  assert.equal(body.first_layer_material, 'PET'); assert.equal(body.second_layer_micron, '40'); assert.equal(body.third_layer_micron, '');
  assert.equal(body.products[0].id, ' p ', 'OrderProduct.toJson does not trim'); assert.equal(body.variant_id, 'v');
  assert.deepEqual(body.production_options, { print_method: 'flexo', cold_glue: true });
  for (const key of ['kg', 'roll_count', 'print_val_size_mm', 'source_map_id', 'effective_layers']) assert.equal(Object.hasOwn(body, key), false, key);
  const defaults = f.model.calculateOrderTemplateToJson(f.model.calculateOrderTemplateFromJson({}));
  for (const key of ['id', 'code', 'saved_at', 'combo', 'production_options', 'products', 'variant_id']) assert.equal(Object.hasOwn(defaults, key), false, key);
  assert.equal(defaults.name, ''); assert.equal(defaults.waste_percent, 5); assert.deepEqual(defaults.layers, []);
});

test('save/delete match exact source paths, JSON fields and untrimmed delete id', async () => {
  const f = fixture(async (_session, path) => response(path.endsWith('/delete') ? {} : { template: { id: 'server', code: 'Z1' } }));
  const template = f.model.calculateOrderTemplateFromJson({ name: 'A', kg: 20, roll_count: 0, print_val_size_mm: 0, source_map_id: ' map ' });
  const saved = await f.api.upsertCalculateOrderTemplate(f.session, template);
  assert.equal(saved.id, 'server'); assert.equal(f.calls[0][1], '/v1/mobile/calculate/orders');
  assert.equal(f.calls[0][2].method, 'POST'); assert.deepEqual(f.calls[0][2].headers, { 'Content-Type': 'application/json' });
  const body = JSON.parse(f.calls[0][2].body); assert.equal(body.name, 'A'); assert.equal(body.kg, 20); assert.equal(body.roll_count, 0);
  assert.equal(body.print_val_size_mm, 0); assert.equal(body.source_map_id, 'map');
  await f.api.deleteCalculateOrderTemplate(f.session, ' untrimmed ');
  assert.equal(f.calls[1][1], '/v1/mobile/calculate/orders/delete'); assert.equal(f.calls[1][2].method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[1][2].body), { id: ' untrimmed ' });
});

test('malformed success bodies use source empty payload fallback rather than invented errors', async () => {
  const f = fixture(async () => ({ status: 200, json: async () => { throw new SyntaxError('bad'); } }));
  assert.deepEqual(await f.api.calculateOrderTemplates(f.session), []);
  const saved = await f.api.upsertCalculateOrderTemplate(f.session, f.model.calculateOrderTemplateFromJson({})); assert.equal(saved.id, '');
  await f.api.deleteCalculateOrderTemplate(f.session, 'id');
});

test('outbound non-finite values fail before transport like Dart jsonEncode', async () => {
  const f = fixture();
  for (const width_mm of ['NaN', 'Infinity', '-Infinity']) {
    const template = f.model.calculateOrderTemplateFromJson({ width_mm });
    await assert.rejects(f.api.upsertCalculateOrderTemplate(f.session, template), /Non-finite/);
  }
  assert.equal(f.calls.length, 0);
});

test('non-200 error detail/code trimming and fallback are source-specific', async () => {
  for (const [operation, code, message] of [['list', 'calculate_orders', 'Calculate orders failed'], ['save', 'calculate_order_save', 'Calculate order save failed'], ['delete', 'calculate_order_delete', 'Calculate order delete failed']]) {
    const f = fixture(async () => response({ error: ' ', detail: '\u0085' }, 403));
    const run = () => operation === 'list' ? f.api.calculateOrderTemplates(f.session) : operation === 'save'
      ? f.api.upsertCalculateOrderTemplate(f.session, f.model.calculateOrderTemplateFromJson({})) : f.api.deleteCalculateOrderTemplate(f.session, 'x');
    await assert.rejects(run(), error => error.code === code && error.message === message && error.statusCode === 403);
  }
  const f = fixture(async () => response({ error: 42, detail: ['x', 1] }, 409));
  await assert.rejects(f.api.calculateOrderTemplates(f.session), error => error.code === '42' && error.message === '[x, 1]' && error.statusCode === 409);
});

test('original guard is retained across transport and buffered-body completion; invalid scoped reads never send', async () => {
  const body = deferred(); let active = true, checks = 0;
  const f = fixture(async () => ({ status: 200, json: () => body.promise }));
  const guard = () => { checks++; if (!active) throw Error('retired'); }, witness = () => active;
  const pending = f.api.calculateOrderTemplates(f.session, guard, witness); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.calls[0][5].readWitness, witness); f.calls[0][3](); active = false; body.resolve({ templates: [{ id: 'stale' }] });
  await assert.rejects(pending, /retired/); assert.ok(checks >= 4);
  const g = fixture(); await assert.rejects(g.api.calculateOrderTemplates(g.session, undefined, () => true), TypeError);
  assert.equal(g.calls.length, 0); await assert.rejects(g.api.deleteCalculateOrderTemplate(g.session, 'id', async () => {}), TypeError);
  assert.equal(g.calls.length, 0);
  g.session.token = 'test-mode-token'; await assert.rejects(g.api.calculateOrderTemplates(g.session), /test mode/); assert.equal(g.calls.length, 0);
});

function storeFixture() {
  const f = fixture(), archive = [], saves = [], deletes = []; let scope = 'admin';
  const client = { listTemplates: () => { const d = deferred(); archive.push(d); return d.promise; },
    upsertTemplate: value => { const d = deferred(); saves.push({ ...d, value }); return d.promise; },
    deleteTemplate: id => { const d = deferred(); deletes.push({ ...d, id }); return d.promise; } };
  const store = new f.store.CalculateOrderTemplateStore({ client, readScope: () => scope });
  return { ...f, store, archive, saves, deletes, setScope: value => { scope = value; }, template: (id, code = id) => f.model.calculateOrderTemplateFromJson({ id, code }) };
}

// @v2-test test/admin_calculate_order_store_test.dart
test('store single-flights archive, honors loaded/force and dedupes first code/id while preserving blank identities', async () => {
  const f = storeFixture(), first = f.store.load(); assert.equal(f.store.load({ force: true }), first); assert.equal(f.archive.length, 1);
  f.archive[0].resolve([f.template('new', ' CODE '), f.template('old', 'code'), f.template(' id ', ''), f.template('id', ''), f.template('', ''), f.template('', '')]);
  await first; assert.deepEqual(f.store.templates.map(row => row.id), ['new', 'id', '', '']); assert.equal(f.store.isLoaded, true);
  assert.throws(() => f.store.templates.push(f.template('x')), TypeError); await f.store.load(); assert.equal(f.archive.length, 1);
  const forced = f.store.load({ force: true }); assert.equal(f.archive.length, 2); f.archive[1].resolve([]); await forced;
});

test('store authoritative upsert has no archive reread and does not mark a partial archive loaded', async () => {
  const f = storeFixture(), save = f.store.upsert(f.template('draft')); const saved = f.template('saved'); f.saves[0].resolve(saved);
  assert.equal(await save, saved); assert.equal(f.store.isLoaded, false); assert.deepEqual(f.store.templates, [saved]); assert.equal(f.archive.length, 0);
  const loaded = f.store.load(); f.archive[0].resolve([f.template('old'), saved]); await loaded; assert.equal(f.store.isLoaded, true);
  const second = f.store.upsert(f.template('draft')); f.saves[1].resolve(f.template('changed', 'saved')); await second;
  assert.equal(f.archive.length, 1); assert.deepEqual(f.store.templates.map(row => row.id), ['changed', 'old']);
});

test('writes acknowledged during an older archive read are reapplied in acknowledgement order', async () => {
  const f = storeFixture(), loaded = f.store.load(), save = f.store.upsert(f.template('draft'));
  f.saves[0].resolve(f.template('new', 'same')); await save;
  const deleted = f.store.delete('remove'); f.deletes[0].resolve(); await deleted;
  f.archive[0].resolve([f.template('old', 'same'), f.template('remove'), f.template('keep')]); await loaded;
  assert.deepEqual(f.store.templates.map(row => row.id), ['new', 'keep']); assert.equal(f.store.isLoaded, true);
});

test('account switch rejects old scope cache effects, old archive errors and old write responses', async () => {
  const f = storeFixture(), oldScope = f.store.captureScope(), old = f.store.load(), save = f.store.upsert(f.template('draft'));
  f.setScope('sales'); f.store.remember(f.template('ignored'), { scope: oldScope }); assert.deepEqual(f.store.templates, []);
  const newer = f.store.load(); f.archive[1].resolve([f.template('sales')]); await newer;
  f.archive[0].reject(Error('old offline')); await old; f.saves[0].resolve(f.template('old-save')); const result = await save;
  assert.equal(result.id, 'old-save', 'source returns successful save while suppressing old cache publication');
  assert.deepEqual(f.store.templates.map(row => row.id), ['sales']); assert.equal(f.store.isCurrentScope(oldScope), false);
});

test('reset invalidates even the same scope and old finally cannot clear a newer archive flight', async () => {
  const f = storeFixture(), old = f.store.load(); f.store.reset(); const newer = f.store.load();
  f.archive[0].resolve([f.template('old')]); await old; assert.equal(f.store.load(), newer);
  f.archive[1].resolve([f.template('new')]); await newer; assert.deepEqual(f.store.templates.map(row => row.id), ['new']);
  const scope = f.store.captureScope(); f.store.dispose(); assert.equal(f.store.isCurrentScope(scope), false);
});

test('same-scope archive failure rethrows and a delete removes exact ids only after acknowledgement', async () => {
  const f = storeFixture(), failed = f.store.load(); f.archive[0].reject(Error('offline')); await assert.rejects(failed, /offline/);
  f.store.remember(f.template('id')); const removal = f.store.delete(' id '); f.deletes[0].resolve(); await removal;
  assert.equal(f.store.templates.length, 1); const exact = f.store.delete('id'); assert.equal(f.store.templates.length, 1);
  f.deletes[1].resolve(); await exact; assert.equal(f.store.templates.length, 0);
});

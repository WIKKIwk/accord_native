const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
const worker = load('workerOrderLogic', { './workerControlsApi': {} });
const rules = load('boyoqchi/returnedPaintRules', { '../workerOrderLogic': worker, './returnedPaintModel': model });
const { ReturnedPaintDraftStore } = load('boyoqchi/returnedPaintDraft', { './returnedPaintModel': model });
function storage() {
  const files = new Map(), writes = [];
  return { files, writes, async read(scope) { return files.get(scope) ?? null; },
    async write(scope, value) { await new Promise(resolve => setTimeout(resolve, 1)); writes.push([scope, value]); files.set(scope, value); },
    async remove(scope) { files.delete(scope); } };
}
const image = { image_id: 'image-1', image_name: 'qoldiq.jpg', image_mime: 'image/jpeg', image_size_bytes: 100, image_url: '/image-1' };

test('draft restores values, named fields, selected tab and full image metadata by scope', async () => {
  const backend = storage(), store = new ReturnedPaintDraftStore(backend);
  const draft = await store.load(' boyoqchi:worker-1:request-1 ');
  draft.setValue('rasxot:Oq', 0, '12.5', 9);
  draft.addNamedField('rasxot:Oq', ' Pantone Blue ');
  draft.setValue('rasxot:Oq', 9, '3', 10);
  draft.selectedUsageIndex = 1;
  draft.setImage(image);
  await store.flush('boyoqchi:worker-1:request-1');
  const restored = await new ReturnedPaintDraftStore(backend).load('boyoqchi:worker-1:request-1');
  assert.equal(restored.valuesFor('rasxot:Oq', 10)[0], '12.5');
  assert.equal(restored.valuesFor('rasxot:Oq', 10)[9], '3');
  assert.deepEqual(restored.fieldLabelsFor('rasxot:Oq', []), ['Pantone Blue']);
  assert.equal(restored.selectedUsageIndex, 1);
  assert.deepEqual(restored.image, image);
  assert.equal((await store.load('boyoqchi:worker-2:request-1')).image, null);
});

test('initial image is persisted, same-image changes are ignored, and named fields are case-insensitive', async () => {
  const backend = storage(), store = new ReturnedPaintDraftStore(backend);
  const draft = await store.load('scope', image);
  await store.flush('scope');
  assert.deepEqual(JSON.parse(backend.files.get('scope')).image, image);
  const count = backend.writes.length;
  draft.setImage({ ...image, image_name: 'new-name' });
  await store.flush('scope');
  assert.equal(backend.writes.length, count);
  assert.equal(draft.image.image_name, 'qoldiq.jpg');
  draft.addNamedField('rasxot:Pantone', ' Blue ');
  draft.addNamedField('rasxot:Pantone', 'blue');
  assert.deepEqual(draft.dynamicFieldLabelsFor('rasxot:Pantone'), ['Blue']);
});

test('legacy Pantone counts and color values migrate without dropping Mix data', async () => {
  const backend = storage();
  backend.files.set('old', JSON.stringify({ values: { 'rasxot:Oq': ['10', '1', '2', '3', '4', '5', '6', 'discard', '7', '8'] },
    pantone_counts: { 'rasxot:Oq': 1 }, selected_usage_index: 1 }));
  const draft = await new ReturnedPaintDraftStore(backend).load('old');
  assert.deepEqual(draft.valuesFor('rasxot:Oq', 8), ['1', '2', '3', '4', '5', '6', '7', '8']);
  assert.deepEqual(draft.dynamicFieldLabelsFor('rasxot:Oq'), ['Pantone 1']);
  assert.deepEqual(draft.dynamicFieldLabelsFor('rasxot:Mix'), ['Oq Mix']);
  assert.deepEqual(draft.valuesFor('rasxot:Mix', 1), ['10']);
});

test('pending writes finish before clear; cached scope is forgotten and other scopes survive', async () => {
  const backend = storage(), store = new ReturnedPaintDraftStore(backend);
  const a = await store.load('a'), b = await store.load('b');
  a.setValue('rasxot:Oq', 0, '1', 1); b.setValue('rasxot:Oq', 0, '2', 1);
  await Promise.all([store.clear('a'), store.flush('b')]);
  assert.equal(backend.files.has('a'), false);
  assert.equal(JSON.parse(backend.files.get('b')).values['rasxot:Oq'][0], '2');
  assert.notEqual(await store.load('a'), a);
});

test('Pantone hybrid collects independent paint and mix state', async () => {
  const draft = await new ReturnedPaintDraftStore(storage()).load('scope');
  draft.addNamedField('rasxot:Pantone', 'Blue shade');
  draft.setValue('rasxot:Pantone', 0, '2', 1);
  draft.addNamedField('rasxot:Pantone Mix', 'Recipe A');
  draft.setValue('rasxot:Pantone Mix', 0, '1.5', 1);
  assert.deepEqual(rules.returnedPaintItemsFromDraft(draft).map(x => [x.name, x.values]),
    [['Pantone', { 'Blue shade': '2' }], ['Mix', { 'Recipe A': '1.5' }]]);
});

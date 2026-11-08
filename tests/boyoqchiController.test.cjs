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
const { BoyoqchiRequestsController } = load('boyoqchi/boyoqchiController', { './boyoqchiLogic': { boyoqchiRequestKey: x => x.id } });
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

test('refresh loads first page, collapses expanded row and exposes V2 loading/error/empty states', async () => {
  let response = { items: [{ id: 'one' }, { id: 'two' }], has_more: true }, fail = false;
  const controller = new BoyoqchiRequestsController(async () => { if (fail) throw Error('offline'); return response; });
  await controller.refresh();
  assert.equal(controller.getSnapshot().phase, 'ready');
  controller.toggle(response.items[0]); assert.equal(controller.getSnapshot().expandedKey, 'one');
  controller.toggle(response.items[1]); assert.equal(controller.getSnapshot().expandedKey, 'two');
  controller.toggle(response.items[1]); assert.equal(controller.getSnapshot().expandedKey, null);
  controller.toggle(response.items[0]);
  response = { items: [], has_more: false };
  const loading = controller.refresh();
  assert.equal(controller.getSnapshot().phase, 'loading');
  assert.equal(controller.getSnapshot().expandedKey, null);
  await loading; assert.deepEqual(controller.getSnapshot().items, []);
  fail = true; await controller.refresh(); assert.equal(controller.getSnapshot().phase, 'error');
});

test('old refresh and catalog completions cannot overwrite a newer request or cancelled screen', async () => {
  const a = deferred(), b = deferred(), catalog = deferred(); let calls = 0;
  const controller = new BoyoqchiRequestsController(() => (++calls === 1 ? a.promise : b.promise), () => catalog.promise);
  const first = controller.refresh(), second = controller.refresh(), loadCatalog = controller.refreshApparatus();
  b.resolve({ items: [{ id: 'new' }], has_more: false }); await second;
  a.resolve({ items: [{ id: 'old' }], has_more: false }); await first;
  assert.equal(controller.getSnapshot().items[0].id, 'new');
  controller.cancelPending(); catalog.resolve([{ id: 'machine' }]); await loadCatalog;
  assert.deepEqual(controller.getSnapshot().apparatus, []);
});

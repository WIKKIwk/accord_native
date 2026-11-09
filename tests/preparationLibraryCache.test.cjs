const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/preparation', `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { PreparationLibraryCache } = load('preparationLibraryCache');
const data = () => ({ sets: [{ set_id: 'one', name: 'First' }, { set_id: 'two', name: 'Second' }],
  recipes: [{ product_code: 'P', material_id: 'M', id: 'variant', name: 'Recipe' }] });

test('library cache shares overlapping reads and retains only unchanged rows across refreshes', async () => {
  const cache = new PreparationLibraryCache(); let calls = 0, finish;
  const loader = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = cache.read('account', 'sets', loader), second = cache.read('account', 'sets', loader);
  assert.equal(first, second); assert.equal(calls, 1); finish(data()); const before = await first;
  assert.equal(await cache.read('account', 'sets', loader), before); assert.equal(calls, 1);
  const unchanged = await cache.read('account', 'sets', async () => data(), true);
  assert.equal(unchanged, before);
  const incoming = data(); incoming.sets[1].name = 'Renamed';
  const changed = await cache.read('account', 'sets', async () => incoming, true);
  assert.equal(changed.sets[0], before.sets[0]); assert.notEqual(changed.sets[1], before.sets[1]);
  assert.equal(changed.recipes, before.recipes);
});

test('an invalidation during a request discards its obsolete result and reads the new revision', async () => {
  const cache = new PreparationLibraryCache(); let finish, calls = 0;
  const fresh = data(); fresh.sets[0].name = 'New server value';
  const pending = cache.read('account', 'sets', () => ++calls === 1
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(fresh));
  cache.invalidate('account'); finish(data());
  const result = await pending;
  assert.equal(calls, 2); assert.equal(result.sets[0].name, 'New server value');
  assert.equal(cache.peek('account', 'sets'), result); assert.equal(cache.isFresh('account', 'sets'), true);
});

test('cached formula data is isolated by account and reset cannot restore an older response', async () => {
  const cache = new PreparationLibraryCache(); let finish;
  const pending = cache.read('first-account', 'sets', () => new Promise(resolve => { finish = resolve; }));
  const other = await cache.read('second-account', 'sets', async () => data());
  cache.clear('first-account'); finish(data()); await assert.rejects(pending, /Akkaunt/);
  assert.equal(cache.peek('first-account', 'sets'), null); assert.equal(cache.peek('second-account', 'sets'), other);
  cache.clear(); assert.equal(cache.peek('second-account', 'sets'), null);
});

test('successful formula writes invalidate both library views without changing API requests', async () => {
  const cache = new PreparationLibraryCache(), requests = [];
  const session = { baseUrl: 'https://example.test', profile: { role: 'tayyorlov_masteri', ref: 'worker' }, capabilities: ['preparation.access'] };
  class WorkerControlException extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
  const { preparationRequest } = load('preparationRequest', {
    '../authorizedFetch': { authorizedFetch: async (_session, path, init) => { requests.push({ path, init }); return new Response('{}', { status: 200 }); } },
    '../workerControlsApi': { WorkerControlException }, '../sessionReadScope': { sessionReadScope: () => 'account' },
    './preparationModel': { jsonObject: value => value }, './preparationLibraryCache': { preparationLibraryCache: cache },
  });
  await cache.read('account', 'sets', async () => data()); await cache.read('account', 'catalog', async () => data());
  await preparationRequest(session, '/v1/mobile/preparation/formula-catalog?');
  assert.equal(cache.isFresh('account', 'sets'), true);
  await preparationRequest(session, '/v1/mobile/preparation/materials', { method: 'PATCH' });
  assert.equal(cache.isFresh('account', 'sets'), true);
  const init = { method: 'PATCH', body: '{"name":"new"}' };
  await preparationRequest(session, '/v1/mobile/preparation/formula-variants?variant_id=v', init);
  assert.equal(cache.isFresh('account', 'sets'), false); assert.equal(cache.isFresh('account', 'catalog'), false);
  assert.ok(cache.peek('account', 'sets')); assert.equal(requests.at(-1).init, init);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cacheModule = new Module(path.resolve(__dirname, '../src/preparation/preparationLibraryCache.ts'), module);
cacheModule._compile(ts.transpileModule(fs.readFileSync(cacheModule.id, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, cacheModule.id);
class WorkerControlException extends Error { constructor(statusCode) { super('Denied'); this.statusCode = statusCode; } }
function setup(mode, options = {}) {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationLibrary.ts'), mod = new Module(filename, module);
  const set = { set_id: 'S1', name: 'Set', product_title: 'Product', product_code: 'P', order_codes: ['0278'], formulas: [{ variant_id: '' }] };
  const recipe = { id: 'v1', name: 'LG', formula_code: 'F1', material_name: 'PE', material_id: 'm', set_name: 'Set', product_title: 'Product', product_code: 'P', order_codes: ['0278'] };
  const cache = options.cache ?? new cacheModule.exports.PreparationLibraryCache(options.now);
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../auth') return { registerSessionResetHook: () => () => {} };
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === '../workerControlsApi') return { WorkerControlException };
    if (id === './preparationLibraryCache') return { preparationLibraryCache: cache };
    if (id === './usePreparationFormula') return { preparationFormulaErrorMessage: e => String(e) };
    if (id === './preparationFormulaApi') return { preparationFormulaSets: async () => { calls.push('sets'); return [{ ...set }]; },
      preparationFormulaCatalog: async () => { calls.push('catalog'); return options.catalog ? options.catalog(recipe) : [{ ...recipe }]; },
      preparationRenameFormulaSet: async (s, id, name) => name.trim(), preparationRenameFormulaVariant: async (s, args) => { calls.push(args); } };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const session = { scope: 'a' };
  return { state: new mod.exports.PreparationLibraryState(session, mode), api: mod.exports, session, calls, set, recipe, cache };
}
test('set library reads sets before recipes, searches and preserves set identity on rename', async () => {
  const x = setup('sets'); await x.state.load(); assert.deepEqual(x.calls, ['sets', 'catalog']);
  x.state.setQuery('0278'); assert.equal(x.state.filteredSets.length, 1); assert.equal(x.state.recipeCount(x.set), 2);
  await x.state.renameSet(x.set, ' New '); assert.equal(x.state.getSnapshot().sets[0].name, 'New');
});
test('session reset clears catalog before the session object changes and prevents reload', async () => {
  const x = setup('catalog'); await x.state.load();
  x.state.sessionChanged(true);
  assert.deepEqual(x.state.getSnapshot().recipes, []);
  await x.state.load(); assert.deepEqual(x.calls, ['catalog']);
  assert.match(x.state.getSnapshot().error, /Akkaunt/);
});
test('catalog clears on account change and normalizes variant names', async () => {
  const x = setup('catalog'); await x.state.load(); x.state.setQuery(' f1 '); assert.equal(x.state.filteredRecipes[0].id, 'v1');
  assert.equal(x.api.preparationVariantName('  New   recipe  '), 'New recipe');
  assert.equal(x.api.preparationVariantNameCanSave(' LG ', 'LG'), false);
  x.session.scope = 'b'; x.state.sessionChanged(); assert.equal(x.state.getSnapshot().recipes.length, 0); assert.match(x.state.getSnapshot().error, /Akkaunt/);
});

test('returning to a fresh library does not refetch, toggle loading or notify unchanged rows', async () => {
  const x = setup('sets'); await x.state.load(false);
  const before = x.state.getSnapshot(), notifications = [];
  x.state.subscribe(() => notifications.push(x.state.getSnapshot()));
  await x.state.load(false); await x.state.load(false);
  assert.deepEqual(x.calls, ['sets', 'catalog']); assert.equal(x.state.getSnapshot(), before); assert.deepEqual(notifications, []);
  x.state.dispose();
  const reopened = setup('sets', { cache: x.cache });
  assert.equal(reopened.state.getSnapshot().sets, before.sets); assert.equal(reopened.state.getSnapshot().loading, false);
  await reopened.state.load(false); assert.deepEqual(reopened.calls, []);
});

test('forced refresh keeps cached rows interactive and preserves unchanged object identities', async () => {
  const x = setup('sets'); await x.state.load(); const before = x.state.getSnapshot(), notifications = [];
  x.state.subscribe(() => notifications.push(x.state.getSnapshot()));
  await x.state.load();
  assert.deepEqual(x.calls, ['sets', 'catalog', 'sets', 'catalog']);
  assert.equal(x.state.getSnapshot(), before); assert.deepEqual(notifications, []);
});

test('expiry and successful mutations refresh the cache, while query changes keep existing data', async () => {
  let now = 0;
  const x = setup('sets', { now: () => now }); await x.state.load(false);
  x.state.setQuery('Product'); const sets = x.state.getSnapshot().sets;
  x.cache.invalidate('a'); await x.state.load(false);
  assert.equal(x.state.getSnapshot().sets, sets); assert.equal(x.calls.length, 4);
  now = 60_000; await x.state.load(false); assert.equal(x.calls.length, 6);
  assert.equal(x.state.getSnapshot().query, 'Product');
});

test('overlapping library reads share one request and a denied refresh clears cached data', async () => {
  let release, denied = false;
  const x = setup('catalog', { catalog: async recipe => {
    if (denied) throw new WorkerControlException(403);
    await new Promise(resolve => { release = resolve; }); return [recipe];
  } });
  const first = x.state.load(false), second = x.state.load(false);
  assert.equal(first, second); assert.deepEqual(x.calls, ['catalog']); release(); await first;
  denied = true; await x.state.load();
  assert.deepEqual(x.state.getSnapshot().recipes, []); assert.equal(x.cache.peek('a', 'catalog'), null);
});

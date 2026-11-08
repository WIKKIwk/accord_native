// Source-derived from f11910bb aparatchi_paddons_screen.dart and paddon_apparatus_scope_test.dart.
// No backend, Dart execution or native device is used.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const scope = load('rezka/rezkaPaddonScope.ts');
const { RezkaPaddonListController } = load('rezka/rezkaPaddonListController.ts', { './rezkaPaddonScope': scope });
const model = load('rezka/rezkaPaddonListModel.ts');
const { productionText, localizedGetter } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const row = (id, name, operation = 'cut', lifecycle = 'active') => ({ id, name, operation, lifecycle_state: lifecycle, sort_order: 1 });
const paddon = (code, apparatus, count, rewinding = false) => ({ code, apparatus_id: apparatus, item_count: count, contains_peremotka: rewinding });
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function make(options = {}) {
  const calls = []; let current = true;
  const c = new RezkaPaddonListController({ assigned: options.assigned ?? ['a'], routeId: options.routeId ?? '', routeName: options.routeName ?? '',
    isCurrent: () => current, loadApparatus: options.loadApparatus ?? (async () => { calls.push('catalog'); return options.catalog ?? [row('a', 'A')]; }),
    loadPaddons: options.loadPaddons ?? (async id => { calls.push(['list', id]); return options.paddons ?? []; }) });
  return { c, calls, lose: () => { current = false; } };
}
test('one assigned cutter is selected and list result is filtered and counted', async () => {
  const h = make({ catalog: [row('a', 'Cut A'), row('other', 'Other'), row('laminate', 'L', 'laminate')],
    paddons: [paddon('P1', 'a', 2), paddon('foreign', 'other', 4), paddon('P2', 'a', 3, true)] });
  h.c.resume(); await h.c.start(); const s = h.c.getSnapshot();
  assert.deepEqual(h.calls, ['catalog', ['list', 'a']]); assert.equal(s.phase, 'ready');
  assert.deepEqual(s.scope, { apparatusId: 'a', apparatusName: 'Cut A', needsApparatus: false });
  assert.deepEqual(s.paddons.map(p => p.code), ['P1', 'P2']); assert.equal(s.paddonCount, 2); assert.equal(s.wipCount, 5); h.c.dispose();
});
test('zero or multiple assigned cutters perform catalog read but no unscoped list read', async () => {
  for (const options of [{ assigned: [], catalog: [row('a', 'A')] }, { assigned: ['a', 'b'], catalog: [row('a', 'A'), row('b', 'B')] }]) {
    const h = make(options); h.c.resume(); await h.c.start();
    assert.deepEqual(h.calls, ['catalog']); assert.equal(h.c.getSnapshot().scope.needsApparatus, true); assert.equal(h.c.getSnapshot().phase, 'ready'); h.c.dispose();
  }
});
test('a foreign, retired or non-cut route ID cannot start a list read', async () => {
  for (const catalog of [[row('other', 'Other')], [row('a', 'A', 'cut', 'retired')], [row('a', 'A', 'laminate')]]) {
    const h = make({ catalog, routeId: 'a', routeName: 'From route' }); h.c.resume(); await h.c.start();
    assert.deepEqual(h.calls, ['catalog']); assert.equal(h.c.getSnapshot().phase, 'unavailable');
    assert.deepEqual(h.c.getSnapshot().paddons, []); h.c.dispose();
  }
});
test('catalog/list error shows error and a real retry reloads both', async () => {
  for (const failure of ['catalog', 'list']) {
    let attempts = 0, lists = 0;
    const h = make({ loadApparatus: async () => { attempts++; if (failure === 'catalog' && attempts === 1) throw Error('offline'); return [row('a', 'A')]; },
      loadPaddons: async () => { lists++; if (failure === 'list' && lists === 1) throw Error('offline'); return [paddon('ok', 'a', 1)]; } });
    h.c.resume(); await h.c.start(); assert.equal(h.c.getSnapshot().phase, 'error');
    await h.c.refresh(); assert.equal(h.c.getSnapshot().phase, 'ready'); assert.equal(attempts, 2);
    assert.equal(lists, failure === 'catalog' ? 1 : 2); h.c.dispose();
  }
});
test('refresh keeps prior data while pending and only newest generation may publish or start the list read', async () => {
  const slow = deferred(), fast = deferred(); let reads = 0, lists = 0;
  const h = make({ loadApparatus: () => { reads++; return reads === 1 ? Promise.resolve([row('a', 'A')]) : reads === 2 ? slow.promise : fast.promise; },
    loadPaddons: async () => { lists++; return [paddon(`P${lists}`, 'a', lists)]; } });
  h.c.resume(); await h.c.start(); const old = h.c.refresh(); await tick();
  assert.equal(h.c.getSnapshot().refreshing, true); assert.equal(h.c.getSnapshot().paddons[0].code, 'P1');
  const latest = h.c.refresh(); await tick(); fast.resolve([row('a', 'A')]); await latest;
  slow.resolve([row('a', 'A')]); await old;
  assert.equal(lists, 2); assert.equal(h.c.getSnapshot().paddons[0].code, 'P2'); assert.equal(h.c.getSnapshot().refreshing, false); h.c.dispose();
});
test('an older already-sent list response cannot overwrite a newer refresh', async () => {
  const slow = deferred(), fast = deferred(); let lists = 0;
  const h = make({ loadPaddons: () => { lists++; return lists === 1 ? Promise.resolve([paddon('initial', 'a', 1)]) : lists === 2 ? slow.promise : fast.promise; } });
  h.c.resume(); await h.c.start(); const old = h.c.refresh(); await tick(); const latest = h.c.refresh(); await tick();
  fast.resolve([paddon('new', 'a', 4)]); await latest; slow.resolve([paddon('old', 'a', 9)]); await old;
  assert.equal(h.c.getSnapshot().paddons[0].code, 'new'); assert.equal(h.c.getSnapshot().wipCount, 4); h.c.dispose();
});
test('StrictMode replay shares one read and pauses the second request while suspended', async () => {
  const catalog = deferred(); let catalogs = 0, lists = 0;
  const h = make({ loadApparatus: () => { catalogs++; return catalog.promise; }, loadPaddons: async () => { lists++; return []; } });
  h.c.resume(); const pending = h.c.start(); await tick(); h.c.suspend(); catalog.resolve([row('a', 'A')]); await tick();
  assert.equal(lists, 0); assert.equal(h.c.getSnapshot().phase, 'loading'); h.c.resume(); assert.equal(h.c.start(), pending);
  await pending; assert.equal(catalogs, 1); assert.equal(lists, 1); assert.equal(h.c.getSnapshot().phase, 'ready'); h.c.dispose();
});
test('unmount or invalidation while suspended cannot dispatch the next list read', async () => {
  for (const reason of ['dispose', 'reset', 'scope']) {
    const catalog = deferred(); let lists = 0;
    const h = make({ loadApparatus: () => catalog.promise, loadPaddons: async () => { lists++; return []; } });
    h.c.resume(); const pending = h.c.start(); await tick(); h.c.suspend();
    if (reason === 'dispose') h.c.dispose(); else if (reason === 'reset') h.c.invalidate(); else h.lose();
    catalog.resolve([row('a', 'A')]); await pending;
    assert.equal(lists, 0); assert.equal(h.c.getSnapshot().phase, 'invalid'); h.c.dispose();
  }
});
test('late list completion is hidden on scope change and only a valid suspended owner can later publish', async () => {
  for (const invalid of [false, true]) {
    const list = deferred(), entered = deferred();
    const h = make({ loadPaddons: () => { entered.resolve(); return list.promise; } });
    h.c.resume(); const pending = h.c.start(); await entered.promise; h.c.suspend(); if (invalid) h.lose();
    list.resolve([paddon('P', 'a', 2)]); await pending;
    assert.equal(h.c.getSnapshot().phase, invalid ? 'invalid' : 'loading');
    h.c.resume(); assert.equal(h.c.getSnapshot().phase, invalid ? 'invalid' : 'ready'); h.c.dispose();
  }
});
test('a reentrant refresh suppresses the superseded request before dispatch', async () => {
  let catalogs = 0, refreshed = false;
  const h = make({ loadApparatus: async () => { catalogs++; return [row('a', 'A')]; } });
  h.c.subscribe(() => { if (!refreshed && h.c.getSnapshot().phase === 'loading') { refreshed = true; void h.c.refresh(); } });
  h.c.resume(); await h.c.start(); await tick(); assert.equal(catalogs, 1); assert.equal(h.c.getSnapshot().phase, 'ready'); h.c.dispose();
});
test('scope lost after scheduling but before the first microtask does not dispatch', async () => {
  let catalogs = 0; const h = make({ loadApparatus: async () => { catalogs++; return [row('a', 'A')]; } });
  h.c.resume(); const pending = h.c.start(); h.lose(); await pending;
  assert.equal(catalogs, 0); assert.equal(h.c.getSnapshot().phase, 'invalid'); h.c.dispose();
});
test('suspension before the initial microtask postpones the catalog until resume', async () => {
  let catalogs = 0; const h = make({ loadApparatus: async () => { catalogs++; return [row('a', 'A')]; } });
  h.c.resume(); const pending = h.c.start(); h.c.suspend(); await tick(); assert.equal(catalogs, 0);
  h.c.resume(); await pending; assert.equal(catalogs, 1); assert.equal(h.c.getSnapshot().phase, 'ready'); h.c.dispose();
});
test('content uses the selected-source keys, totals and rewinding subtitle in all four locales', () => {
  const h = make(); const s = { ...h.c.getSnapshot(), phase: 'ready', scope: { apparatusId: 'a', apparatusName: 'Rezka 1', needsApparatus: false },
    paddons: [paddon('P1', 'a', 2, true)], paddonCount: 1, wipCount: 2 };
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const t = (key, values) => { const value = productionText(key, locale, values); assert.notEqual(value, key); return value; };
    const content = model.rezkaPaddonListContent(s, t, localizedGetter('retry', locale));
    assert.equal(content.title, t('worker.paddon.apparatus', { apparatus: 'Rezka 1' }));
    assert.equal(content.rows[0].count, t('worker.paddon.wip_count', { count: 2 }));
    assert.equal(content.rows[0].subtitle, t('worker.rezka.print.peremotka')); assert.ok(content.wipMetric.endsWith(': 2'));
  }
});

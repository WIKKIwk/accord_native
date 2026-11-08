const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}, extension = 'ts') {
  const filename = path.resolve(__dirname, '../src', `${file}.${extension}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const { SupplierStore } = load('supplier/supplierStore', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
});
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storeFixture(overrides = {}) {
  const calls = [];
  const api = Object.fromEntries(['supplierSummary', 'supplierHistory', 'supplierStatusBreakdown', 'supplierStatusDetails']
    .map(name => [name, async (...args) => { calls.push([name, ...args.slice(1)]); return name === 'supplierSummary'
      ? { pendingCount: 0, submittedCount: 0, returnedCount: 0 } : []; }]));
  const runtime = { subscribe: () => () => {}, applySummary: value => value };
  return { store: new SupplierStore({}, { ...api, ...overrides }, runtime), calls };
}

// Controlled hook lifecycle, not a native renderer or a device interaction test.
function harness() {
  let cursor = 0, pending = [], writes = 0;
  const slots = [];
  const changed = (before, after) => !before || before.length !== after.length || after.some((value, i) => value !== before[i]);
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[i].value, value => { writes++; slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!slots[i] || changed(slots[i].deps, deps)) pending.push(() => {
          slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
        });
      },
    },
    render(render) { cursor = 0; pending = []; return render(); },
    commit() { const effects = pending; pending = []; effects.forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    get writes() { return writes; },
  };
}
function hooks(h, overrides = {}) {
  return load('supplier/useSupplierOverview', {
    react: h.react, 'react-native': { AppState: {} }, '../shared/localization': {},
    '../shared/localization/runtime': { localeController: {} },
    '../shared/notificationStoresRuntime': { refreshHub: {} }, './supplierMaterialText': {}, ...overrides,
  });
}

function overviewViews(platform, h) {
  const jsx = (type, props) => ({ type, props });
  const components = names => Object.fromEntries(names.split(' ').map(name => [name, name]));
  const text = { t: value => value, l: key => key, lm: (key, values) => `${key}:${JSON.stringify(values)}` };
  return load(`supplier/SupplierOverviewScreens.${platform}`, {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui/swift-ui': components('Button HStack ProgressView Section Spacer Text VStack'),
    '@expo/ui/jetpack-compose': { ...components('Host Text TextButton'), useMaterialColors: () => ({}) },
    'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { ...components('ActivityIndicator RefreshControl ScrollView Text View'), PlatformColor: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../preparation/PreparationUI': components('PreparationList PreparationRow PreparationText'),
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
    './supplierScreenModel': load('supplier/supplierScreenModel', {
      '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
      '../shared/searchNormalizer': load('shared/searchNormalizer'),
    }),
    './useSupplierOverview': { ...hooks(h), useSupplierStore: store => store, useSupplierText: () => text },
  }, 'tsx');
}
function renderedNodes(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(renderedNodes);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return renderedNodes(node.type(node.props));
  return [node, ...renderedNodes(node.props.children)];
}
const isLoading = nodes => nodes.some(node => node?.type === 'ProgressView' || node?.type === 'ActivityIndicator');

// Source-derived: V2 has no Supplier API/logic recordings. The widgets call bootstrap in initState;
// cached results bypass loading before build, including successful empty maps in SupplierStore.
test('breakdown first render reuses cached history or returned results, including empty lists', async () => {
  for (const kind of ['pending', 'submitted', 'returned']) {
    for (const items of [[], [{ item_code: 'A' }]]) {
      const f = storeFixture({ supplierHistory: async () => items, supplierStatusBreakdown: async () => items });
      if (kind === 'returned') await f.store.bootstrapBreakdown(kind); else await f.store.bootstrapHistory();
      const h = harness(), { useSupplierBreakdown } = hooks(h);
      assert.equal(h.render(() => useSupplierBreakdown(f.store, kind)), true, `${kind}, ${items.length} cached rows`);
      h.commit(); await tick(); h.unmount();
    }
  }
});

test('detail first render reuses cached empty and populated results with Dart-trimmed keys', async () => {
  for (const items of [[], [{ id: 'receipt-A' }]]) {
    const f = storeFixture({ supplierStatusDetails: async () => items });
    await f.store.bootstrapDetail('returned', ' \u0085A\u0085 ');
    const h = harness(), { useSupplierStatusDetail } = hooks(h);
    assert.equal(h.render(() => useSupplierStatusDetail(f.store, 'returned', 'A')), true);
    h.commit(); await tick(); h.unmount();
  }
});

test('both native overview views render cached categories, returned rows and detail without a loading surface', async () => {
  for (const platform of ['ios', 'android']) {
    for (const surface of ['grouped', 'returned', 'detail']) {
      for (const populated of [false, true]) {
        const rows = populated ? [{ id: 'receipt-A', item_code: 'A', item_name: 'Cotton', uom: 'kg',
          total_returned_qty: 7, receipt_count: 1, sent_qty: 7, accepted_qty: 0, created_label: 'Today', note: '' }] : [];
        const f = storeFixture({ supplierHistory: async () => [], supplierStatusBreakdown: async () => rows,
          supplierStatusDetails: async () => rows });
        if (surface === 'grouped') await f.store.bootstrapHistory();
        else if (surface === 'returned') await f.store.bootstrapBreakdown('returned');
        else await f.store.bootstrapDetail('returned', 'A');
        const h = harness(), views = overviewViews(platform, h);
        const props = { store: f.store, kind: surface === 'grouped' ? 'pending' : 'returned', itemCode: 'A', itemName: 'Cotton',
          onBack: () => {}, onCategory: () => {}, onDetail: () => {} };
        const nodes = h.render(() => renderedNodes(surface === 'detail' ? views.SupplierStatusDetailScreen(props)
          : views.SupplierStatusBreakdownScreen(props)));
        assert.equal(isLoading(nodes), false, `${platform}: ${surface}, populated=${populated}`);
        const texts = nodes.filter(node => typeof node === 'string');
        if (surface === 'grouped') assert.ok(texts.includes('supplierPendingDispatchesTitle')
          || nodes.some(node => node?.props?.title === 'supplierPendingDispatchesTitle'));
        else if (!populated) assert.ok(texts.includes(surface === 'detail' ? 'noSupplierReceiptsYet' : 'noStatusRecords'));
        else assert.ok(nodes.some(node => node === 'Cotton' || node === '7 kg' || node?.props?.title === 'Cotton' || node?.props?.title === '7 kg'));
        h.unmount();
      }
    }
  }
});

test('both native detail views still show loading when an explicit refresh has no visible rows', async () => {
  for (const platform of ['ios', 'android']) {
    let requests = 0;
    const next = deferred(), f = storeFixture({ supplierStatusDetails: () => ++requests === 1 ? Promise.resolve([]) : next.promise });
    await f.store.bootstrapDetail('returned', 'A');
    const h = harness(), views = overviewViews(platform, h);
    const refresh = f.store.refreshDetail('returned', 'A');
    const nodes = h.render(() => renderedNodes(views.SupplierStatusDetailScreen({ store: f.store, kind: 'returned',
      itemCode: 'A', itemName: 'Cotton', onBack: () => {} })));
    assert.equal(isLoading(nodes), true, platform);
    h.unmount(); next.resolve([]); await refresh;
  }
});

test('uncached breakdown and detail remain waiting until their own requests finish', async () => {
  for (const surface of ['breakdown', 'detail']) {
    const request = deferred(), f = storeFixture({
      [surface === 'breakdown' ? 'supplierStatusBreakdown' : 'supplierStatusDetails']: () => request.promise,
    });
    const h = harness(), api = hooks(h);
    const render = () => surface === 'breakdown' ? api.useSupplierBreakdown(f.store, 'returned')
      : api.useSupplierStatusDetail(f.store, 'returned', 'A');
    assert.equal(h.render(render), false); h.commit();
    assert.equal(h.render(render), false);
    request.resolve([]); await tick();
    assert.equal(h.render(render), true); h.unmount();
  }
});

test('readiness from an earlier store never skips loading for another store with the same route', async () => {
  for (const surface of ['breakdown', 'detail']) {
    const request = deferred(), old = storeFixture(), next = storeFixture({
      [surface === 'breakdown' ? 'supplierStatusBreakdown' : 'supplierStatusDetails']: () => request.promise,
    });
    const h = harness(), api = hooks(h);
    const render = store => surface === 'breakdown' ? api.useSupplierBreakdown(store, 'returned')
      : api.useSupplierStatusDetail(store, 'returned', 'A');
    assert.equal(h.render(() => render(old.store)), false); h.commit(); await tick();
    assert.equal(h.render(() => render(old.store)), true);
    assert.equal(h.render(() => render(next.store)), false);
    h.commit(); assert.equal(h.render(() => render(next.store)), false);
    request.resolve([]); await tick();
    assert.equal(h.render(() => render(next.store)), true); h.unmount();
  }
});

test('route changes and unmount ignore completion of an obsolete read', async () => {
  for (const surface of ['breakdown', 'detail']) {
    const first = deferred(), second = deferred();
    const f = storeFixture({
      supplierStatusBreakdown: (_session, kind) => kind === 'returned' ? first.promise : Promise.resolve([]),
      supplierHistory: () => second.promise,
      supplierStatusDetails: (_session, _kind, code) => code === 'A' ? first.promise : second.promise,
    });
    const h = harness(), api = hooks(h);
    const render = next => surface === 'breakdown' ? api.useSupplierBreakdown(f.store, next ? 'pending' : 'returned')
      : api.useSupplierStatusDetail(f.store, 'returned', next ? 'B' : 'A');
    assert.equal(h.render(() => render(false)), false); h.commit();
    assert.equal(h.render(() => render(true)), false); h.commit();
    first.resolve([]); await tick();
    assert.equal(h.writes, 0); assert.equal(h.render(() => render(true)), false);
    h.unmount(); second.resolve([]); await tick(); assert.equal(h.writes, 0);
  }
});

test('failed uncached reads release waiting and leave their source error visible', async () => {
  for (const surface of ['breakdown', 'detail']) {
    const failure = Error('source failure'), f = storeFixture({
      [surface === 'breakdown' ? 'supplierStatusBreakdown' : 'supplierStatusDetails']: async () => { throw failure; },
    });
    const h = harness(), api = hooks(h);
    const render = () => surface === 'breakdown' ? api.useSupplierBreakdown(f.store, 'returned')
      : api.useSupplierStatusDetail(f.store, 'returned', 'A');
    assert.equal(h.render(render), false); h.commit(); await tick();
    assert.equal(h.render(render), true);
    assert.equal(surface === 'breakdown' ? f.store.breakdownError('returned') : f.store.detailError('returned', 'A'), failure);
    h.unmount();
  }
});

test('home and recent load on entry, refresh only for Supplier push or resume, and remove listeners', () => {
  for (const mode of ['home', 'history']) {
    const h = harness(), calls = [], pushes = new Set(), states = new Set();
    const store = Object.fromEntries(['bootstrapSummary', 'bootstrapHistory', 'refreshAll', 'refreshHistory']
      .map(name => [name, async () => { calls.push(name); }]));
    const refreshHub = { topic: '', version: 0, subscribe: callback => { pushes.add(callback); return () => pushes.delete(callback); } };
    const AppState = { addEventListener: (event, callback) => {
      assert.equal(event, 'change'); states.add(callback); return { remove: () => states.delete(callback) };
    } };
    const { useSupplierRootRefresh } = hooks(h, {
      'react-native': { AppState }, '../shared/notificationStoresRuntime': { refreshHub },
    });
    h.render(() => useSupplierRootRefresh(store, mode)); h.commit();
    assert.deepEqual(calls, mode === 'home' ? ['bootstrapSummary', 'bootstrapHistory'] : ['bootstrapHistory']);
    const refresh = mode === 'home' ? 'refreshAll' : 'refreshHistory', initial = calls.length;
    const push = (topic, version) => { refreshHub.topic = topic; refreshHub.version = version; pushes.forEach(callback => callback()); };
    push('worker', 1); push('supplier', 2); push('supplier', 2); push('supplier', 3);
    states.forEach(callback => callback('background')); states.forEach(callback => callback('inactive'));
    states.forEach(callback => callback('active'));
    assert.deepEqual(calls.slice(initial), [refresh, refresh, refresh]);
    h.unmount(); assert.equal(pushes.size, 0); assert.equal(states.size, 0);
    push('supplier', 4); states.forEach(callback => callback('active'));
    assert.equal(calls.length, initial + 3);
  }
});

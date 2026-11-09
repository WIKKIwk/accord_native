const assert = require('node:assert/strict');
const test = require('node:test');
const { tick, deferred, storeFixture, harness, hooks, overviewViews, renderedNodes, isLoading } = require('./support/supplierOverviewHarness.cjs');

function rootRefreshFixture() {
  const h = harness(), pushes = new Set(), states = new Set();
  const refreshHub = { topic: 'supplier', version: 0, subscribe: callback => { pushes.add(callback); return () => pushes.delete(callback); } };
  const AppState = { addEventListener: (_event, callback) => {
    states.add(callback); return { remove: () => states.delete(callback) };
  } };
  const { useSupplierRootRefresh } = hooks(h, {
    'react-native': { AppState }, '../shared/notificationStoresRuntime': { refreshHub },
  });
  const spyStore = () => {
    const calls = [], store = Object.fromEntries(['bootstrapSummary', 'bootstrapHistory', 'refreshAll', 'refreshHistory']
      .map(name => [name, async () => { calls.push(name); }]));
    return { store, calls };
  };
  return { h, pushes, states, refreshHub, spyStore, useSupplierRootRefresh };
}

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

test('queued Supplier push and resume callbacks cannot start reads after home or recent unmount', () => {
  for (const mode of ['home', 'history']) {
    const f = rootRefreshFixture(), { store, calls } = f.spyStore();
    f.h.render(() => f.useSupplierRootRefresh(store, mode)); f.h.commit();
    const queuedPush = [...f.pushes][0], queuedResume = [...f.states][0], initial = calls.length;
    f.h.unmount();
    f.refreshHub.version = 1; queuedPush(); queuedResume('active');
    assert.equal(calls.length, initial, `${mode}: callbacks delivered after disposal`);
    assert.equal(f.pushes.size, 0); assert.equal(f.states.size, 0);
  }
});

test('store or mode replacement retires old callbacks while the current root continues to refresh', () => {
  for (const [mode, nextMode, replaceStore] of [['home', 'home', true], ['history', 'history', true],
    ['home', 'history', false], ['history', 'home', false]]) {
    const f = rootRefreshFixture(), old = f.spyStore(), next = replaceStore ? f.spyStore() : old;
    f.h.render(() => f.useSupplierRootRefresh(old.store, mode)); f.h.commit();
    const queuedPush = [...f.pushes][0], queuedResume = [...f.states][0];
    f.h.render(() => f.useSupplierRootRefresh(next.store, nextMode)); f.h.commit();
    const oldCount = old.calls.length, nextCount = next.calls.length;
    f.refreshHub.version = 1; queuedPush(); queuedResume('active');
    assert.equal(old.calls.length, oldCount); assert.equal(next.calls.length, nextCount);
    f.pushes.forEach(callback => callback()); f.states.forEach(callback => callback('active'));
    const refresh = nextMode === 'home' ? 'refreshAll' : 'refreshHistory';
    assert.deepEqual(next.calls.slice(nextCount), [refresh, refresh]);
    if (replaceStore) assert.equal(old.calls.length, oldCount);
    f.h.unmount();
  }
});

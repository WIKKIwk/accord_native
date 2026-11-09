const assert = require('node:assert/strict');
const test = require('node:test');
const { tick, deferred, storeFixture, harness, overviewViews, renderedNodes, isLoading } = require('./support/supplierOverviewHarness.cjs');

// Source-derived surface audit at f11910bb, not V2 HTTP recordings or native-device tests.
const record = (id, status = 'pending', extra = {}) => ({ id, status, item_code: `CODE-${id}`, item_name: `Name ${id}`,
  sent_qty: 10.4, accepted_qty: 0, amount: 0, currency: '', uom: 'kg', created_label: `Date ${id}`, note: '', event_type: '', ...extra });
const entry = (code, extra = {}) => ({ item_code: code, item_name: `Item ${code}`, total_sent_qty: 999,
  total_accepted_qty: 888, total_returned_qty: 12.4, receipt_count: 3, uom: 'kg', ...extra });
const surfaces = ['home', 'recent', 'pending', 'submitted', 'returned', 'category', 'detail'];
function fixture(platform, surface, overrides = {}, props = {}) {
  const f = storeFixture(overrides), h = harness(), views = overviewViews(platform, h);
  const names = { home: 'SupplierHomeScreen', recent: 'SupplierRecentScreen', pending: 'SupplierStatusBreakdownScreen',
    submitted: 'SupplierStatusBreakdownScreen', returned: 'SupplierStatusBreakdownScreen',
    category: 'SupplierSubmittedCategoryDetailScreen', detail: 'SupplierStatusDetailScreen' };
  const allProps = { store: f.store, kind: ['pending', 'submitted'].includes(surface) ? surface : 'returned',
    category: 'pendingDispatches', itemCode: 'A', itemName: 'Selected item', onOpenDrawer() {}, onBack() {},
    onStatus() {}, onCategory() {}, onDetail() {}, ...props };
  const render = () => h.render(() => renderedNodes(views[names[surface]](allProps)));
  const settle = async () => { render(); h.commit(); await tick(); return render(); };
  return { ...f, h, render, settle };
}
function texts(nodes) {
  return nodes.flatMap(node => typeof node === 'string' || typeof node === 'number' ? [String(node)]
    : node?.type === 'PreparationRow' ? [node.props.title, ...(node.props.subtitle?.split('\n') ?? [])] : []);
}
function actions(nodes) {
  return nodes.filter(node => typeof node?.props?.onPress === 'function' || typeof node?.props?.onClick === 'function');
}
function press(node) { return (node.props.onPress ?? node.props.onClick)(); }
function refreshAction(nodes) {
  const list = nodes.find(node => node?.type === 'PreparationList');
  if (list) return list.props.refresh;
  return nodes.find(node => node?.type === 'ScrollView')?.props.refreshControl?.props.onRefresh;
}
function title(nodes) {
  return nodes.find(node => node?.type === 'Screen')?.props.options.title
    ?? nodes.find(node => node?.type === 'RoleHeader')?.props.title;
}
async function bootstrap(store, surface) {
  if (['home', 'recent', 'pending', 'submitted', 'category'].includes(surface)) await store.bootstrapHistory();
  else if (surface === 'returned') await store.bootstrapBreakdown('returned');
  else await store.bootstrapDetail('returned', 'A');
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: home preserves summary order, pending fields and the restricted action boundary`, async () => {
    const selected = [], rows = [record('one'), record('two', 'draft', { sent_qty: 2.7 }), record('accepted', 'accepted'),
      record('partial', 'partial'), record('rejected', 'rejected'), record('cancelled', 'cancelled')];
    const f = fixture(platform, 'home', { supplierHistory: async () => rows,
      supplierSummary: async () => ({ pendingCount: 8, submittedCount: 7, returnedCount: 6 }) }, { onStatus: kind => selected.push(kind) });
    await f.store.refreshAll(); const nodes = f.render();
    assert.equal(title(nodes), 'supplierRoleName');
    assert.deepEqual(texts(nodes), ['pendingStatus', '8', 'submittedStatus', '7', 'returnedStatus', '6', 'inProgressItemsTitle',
      'Name one', 'CODE-one', '10 kg', 'Date one', 'Name two', 'CODE-two', '3 kg', 'Date two']);
    assert.equal(actions(nodes).length, 3, 'receipt actions remain absent in the restricted host');
    actions(nodes).forEach(press); assert.deepEqual(selected, ['pending', 'submitted', 'returned']);
    assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
  });

  test(`${platform}: recent preserves server order, blank-name fallback, amounts and currency without repeat actions`, async () => {
    const rows = [record('one', 'accepted', { item_name: ' \u0085 ', amount: 14.6, currency: 'USD' }),
      record('two', 'pending', { amount: 2.4 }), record('three', 'partial', { amount: -5, currency: 'MUST NOT APPEAR' })];
    const f = fixture(platform, 'recent', { supplierHistory: async () => rows });
    await bootstrap(f.store, 'recent'); const nodes = f.render();
    assert.equal(title(nodes), 'recentTitle');
    const screen = nodes.find(node => node?.type === 'Screen'), header = nodes.find(node => node?.type === 'RoleHeader');
    if (screen) assert.ok(texts(renderedNodes(screen.props.options.headerTitle())).includes('recentSubtitle'));
    else assert.equal(header.props.subtitle, 'recentSubtitle');
    assert.deepEqual(texts(nodes), ['CODE-one', '10 kg', '15 USD', 'Date one', 'Name two', '10 kg', '2', 'Date two',
      'Name three', '10 kg', 'Date three']);
    assert.equal(actions(nodes).length, 0); assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
  });

  test(`${platform}: pending and submitted show the exact two category counts and safe destinations`, async () => {
    const rows = [record('pending'), record('draft', 'draft'), record('unannounced', 'pending', { event_type: 'werka_unannounced_pending' }),
      record('accepted', 'accepted'), record('approved', 'accepted', { event_type: 'werka_unannounced_approved' }),
      record('note', 'accepted', { note: ' \u0085Unannounced item approved: yes' }), record('rejected', 'rejected')];
    for (const kind of ['pending', 'submitted']) {
      const selected = [], f = fixture(platform, kind, { supplierHistory: async () => rows }, { onCategory: value => selected.push(value) });
      await bootstrap(f.store, kind); const nodes = f.render();
      assert.equal(title(nodes), kind === 'pending' ? 'pendingStatus' : 'submittedStatus');
      assert.deepEqual(texts(nodes), kind === 'pending' ? ['supplierPendingDispatchesTitle', '2', 'supplierPendingUnannouncedTitle', '1']
        : ['supplierAcceptedByWerkaTitle', '1', 'supplierAcceptedUnannouncedTitle', '2']);
      actions(nodes).forEach(press);
      assert.deepEqual(selected, kind === 'pending' ? ['pendingDispatches', 'pendingUnannounced'] : ['acceptedByWerka', 'approvedUnannounced']);
      assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
    }
  });

  test(`${platform}: returned breakdown uses returned quantity and passes untouched detail arguments`, async () => {
    const opened = [], rows = [entry(' B '), entry('A', { receipt_count: 2, total_returned_qty: 7.5, uom: 'm' })];
    const f = fixture(platform, 'returned', { supplierStatusBreakdown: async () => rows }, { onDetail: (...args) => opened.push(args) });
    await bootstrap(f.store, 'returned'); const nodes = f.render();
    assert.equal(title(nodes), 'returnedStatus');
    assert.deepEqual(texts(nodes), ['Item  B ', 'sentQtyStatus:{"qty":12.4,"uom":"kg","statusWord":"returnedstatus"}',
      'receiptCountLabel:{"count":3}', 'Item A', 'sentQtyStatus:{"qty":7.5,"uom":"m","statusWord":"returnedstatus"}',
      'receiptCountLabel:{"count":2}']);
    actions(nodes).forEach(press); assert.deepEqual(opened, [['returned', ' B ', 'Item  B '], ['returned', 'A', 'Item A']]);
    assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
  });

  test(`${platform}: all four category views retain matching row order and nonblank note text`, async () => {
    const rows = [record('one', 'pending', { note: ' Keep surrounding spaces ' }),
      record('two', 'draft', { event_type: 'werka_unannounced_pending' }), record('three', 'pending', { sent_qty: 2.7, note: ' \u0085 ' }),
      record('four', 'accepted'), record('five', 'accepted', { note: ' Aytilmagan mahsulot tasdiqlandi: yes' }),
      record('six', 'accepted', { event_type: 'werka_unannounced_approved' }), record('seven', 'partial')];
    const expected = {
      pendingDispatches: ['supplierPendingDispatchesTitle', ['10 kg', 'Date one', ' Keep surrounding spaces ', '3 kg', 'Date three']],
      pendingUnannounced: ['supplierPendingUnannouncedTitle', ['10 kg', 'Date two']],
      acceptedByWerka: ['supplierAcceptedByWerkaTitle', ['10 kg', 'Date four']],
      approvedUnannounced: ['supplierAcceptedUnannouncedTitle', ['10 kg', 'Date five', ' Aytilmagan mahsulot tasdiqlandi: yes', '10 kg', 'Date six']],
    };
    for (const [category, [heading, content]] of Object.entries(expected)) {
      const f = fixture(platform, 'category', { supplierHistory: async () => rows }, { category });
      await bootstrap(f.store, 'category'); const nodes = f.render();
      assert.equal(title(nodes), heading); assert.deepEqual(texts(nodes), content);
      assert.equal(actions(nodes).length, 0); assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
    }
  });

  test(`${platform}: status detail preserves accepted/note conditions and omits held receipt actions`, async () => {
    const rows = [record('one', 'partial', { accepted_qty: 2.5, note: ' Supplier note ' }),
      record('two', 'rejected', { accepted_qty: -1, note: ' \u0085 ' }), record('three', 'cancelled')];
    const f = fixture(platform, 'detail', { supplierStatusDetails: async () => rows }, { itemName: ' Selected item ' });
    await bootstrap(f.store, 'detail'); const nodes = f.render();
    assert.equal(title(nodes), ' Selected item ');
    assert.deepEqual(texts(nodes), ['10 kg', 'Date one', 'acceptedQtyLabel:{"qty":2.5,"uom":"kg"}', ' Supplier note ',
      '10 kg', 'Date two', '10 kg', 'Date three']);
    assert.equal(actions(nodes).length, 0); assert.equal(typeof refreshAction(nodes), 'function'); f.h.unmount();
  });

  test(`${platform}: successful empty states have precisely the V2 refresh availability`, async () => {
    const expected = { home: [['pendingStatus', '0', 'submittedStatus', '0', 'returnedStatus', '0'], true],
      recent: [['noSupplierShipmentsYet'], false], pending: [['supplierPendingDispatchesTitle', '0', 'supplierPendingUnannouncedTitle', '0'], true],
      submitted: [['supplierAcceptedByWerkaTitle', '0', 'supplierAcceptedUnannouncedTitle', '0'], true],
      returned: [['noStatusRecords'], false], category: [['noRecordsYet'], false], detail: [['noSupplierReceiptsYet'], false] };
    for (const surface of surfaces) {
      const f = fixture(platform, surface); await bootstrap(f.store, surface); const nodes = f.render();
      assert.equal(isLoading(nodes), false, surface); assert.deepEqual(texts(nodes), expected[surface][0], surface);
      assert.equal(typeof refreshAction(nodes) === 'function', expected[surface][1], surface); f.h.unmount();
    }
  });

  test(`${platform}: uncached requests show loading without empty, error or refresh surfaces`, async () => {
    for (const surface of surfaces) {
      const pending = deferred(), wait = () => pending.promise;
      const f = fixture(platform, surface, { supplierHistory: wait, supplierStatusBreakdown: wait, supplierStatusDetails: wait });
      const request = bootstrap(f.store, surface), nodes = f.render();
      assert.equal(isLoading(nodes), true, surface); assert.deepEqual(texts(nodes), [], surface);
      assert.equal(refreshAction(nodes), undefined, surface);
      pending.resolve([]); await request; f.h.unmount();
    }
  });

  test(`${platform}: every non-null initial failure enters retry/error, including false, zero and empty text`, async () => {
    for (const surface of surfaces) {
      for (const failure of [Error('offline'), false, 0, '']) {
        const fail = async () => { throw failure; };
        const f = fixture(platform, surface, { supplierHistory: fail, supplierStatusBreakdown: fail, supplierStatusDetails: fail });
        await bootstrap(f.store, surface); const nodes = await f.settle();
        assert.equal(isLoading(nodes), false, `${surface}: ${String(failure)}`);
        if (surface === 'home' || surface === 'recent') {
          assert.ok(texts(nodes).includes('serverDisconnectedRetry'));
          assert.equal(actions(nodes).length, 1); assert.equal(typeof refreshAction(nodes), 'function');
        } else {
          assert.deepEqual(texts(nodes), [String(failure)], surface);
          assert.equal(actions(nodes).length, 0); assert.equal(refreshAction(nodes), undefined);
        }
        f.h.unmount();
      }
    }
  });

  test(`${platform}: home and recent retry the actual reader and recover from initial failure`, async () => {
    for (const surface of ['home', 'recent']) {
      let failing = true;
      const calls = [], f = fixture(platform, surface, {
        supplierHistory: async () => { calls.push('history'); if (failing) throw Error('offline'); return [record('recovered')]; },
        supplierSummary: async () => { calls.push('summary'); return { pendingCount: 1, submittedCount: 0, returnedCount: 0 }; },
      });
      await bootstrap(f.store, surface); const failed = await f.settle();
      assert.ok(texts(failed).includes('serverDisconnectedRetry')); calls.length = 0; failing = false;
      press(actions(failed)[0]); await tick(); const recovered = f.render();
      assert.deepEqual(calls, surface === 'home' ? ['summary', 'history'] : ['history']);
      assert.equal(isLoading(recovered), false); assert.ok(texts(recovered).includes('Name recovered'));
      assert.ok(!texts(recovered).includes('serverDisconnectedRetry')); f.h.unmount();
    }
  });

  test(`${platform}: failed refreshes retain successful content rather than replacing it with an error`, async () => {
    for (const surface of surfaces) {
      let fail = false;
      const history = async () => { if (fail) throw Error('SHOULD NOT REPLACE CACHE'); return [record('cached')]; };
      const breakdown = async () => { if (fail) throw Error('SHOULD NOT REPLACE CACHE'); return [entry('A')]; };
      const f = fixture(platform, surface, { supplierHistory: history, supplierStatusBreakdown: breakdown, supplierStatusDetails: history });
      await bootstrap(f.store, surface); const before = texts(f.render()); fail = true;
      if (surface === 'returned') await f.store.refreshBreakdown('returned');
      else if (surface === 'detail') await f.store.refreshDetail('returned', 'A');
      else await f.store.refreshHistory();
      const nodes = f.render(); assert.equal(isLoading(nodes), false, surface); assert.deepEqual(texts(nodes), before, surface);
      assert.equal(typeof refreshAction(nodes), 'function', surface); f.h.unmount();
    }
  });

  test(`${platform}: pull-to-refresh calls only the V2 reader for its surface`, async () => {
    for (const surface of surfaces) {
      const calls = [], history = async () => { calls.push('history'); return [record('cached')]; };
      const f = fixture(platform, surface, {
        supplierHistory: history,
        supplierSummary: async () => { calls.push('summary'); return { pendingCount: 0, submittedCount: 0, returnedCount: 0 }; },
        supplierStatusBreakdown: async (_session, kind) => { calls.push(`breakdown:${kind}`); return [entry('A')]; },
        supplierStatusDetails: async (_session, kind, code) => { calls.push(`detail:${kind}:${code}`); return [record('cached')]; },
      });
      await bootstrap(f.store, surface); calls.length = 0;
      refreshAction(f.render())(); await tick();
      assert.deepEqual(calls, surface === 'home' ? ['summary', 'history'] : surface === 'returned' ? ['breakdown:returned']
        : surface === 'detail' ? ['detail:returned:A'] : ['history'], surface); f.h.unmount();
    }
  });

  test(`${platform}: every read-only surface preserves its back/menu callback and supplied dock slot`, async () => {
    for (const surface of surfaces) {
      for (const rootBack of surface === 'home' || surface === 'recent' ? [false, true] : [false]) {
        const calls = [], footer = { type: 'SupplierAuditFooter', props: {} };
        const f = fixture(platform, surface, {}, { footer, onOpenDrawer: () => calls.push('drawer'), onBack: () => calls.push('back'),
          ...(rootBack ? { onRootBack: () => calls.push('rootBack') } : {}) });
        await bootstrap(f.store, surface); const nodes = f.render();
        assert.equal(nodes.filter(node => node?.type === 'SupplierAuditFooter').length, 1, surface);
        const screen = nodes.find(node => node?.type === 'Screen');
        const control = screen ? screen.props.options.headerLeft().props : nodes.find(node => node?.type === 'RoleHeader').props.navigation;
        const root = surface === 'home' || surface === 'recent';
        assert.equal(control.icon, root && !rootBack ? 'menu' : 'back');
        control.onPress();
        assert.deepEqual(calls, [rootBack ? 'rootBack' : root ? 'drawer' : 'back']); f.h.unmount();
      }
    }
  });
}

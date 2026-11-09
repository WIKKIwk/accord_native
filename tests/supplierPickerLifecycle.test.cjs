const assert = require('node:assert/strict');
const test = require('node:test');
const { load, tick, deferred } = require('./support/supplierOverviewHarness.cjs');

const model = load('supplier/supplierScreenModel', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
  '../shared/searchNormalizer': load('shared/searchNormalizer'),
});
const controllers = load('supplier/supplierCreateController', { './supplierScreenModel': model });

// Controlled React effects and event delivery. This is not a native event/device test.
function harness(read) {
  let cursor = 0, pending = [];
  const slots = [], listeners = new Set();
  const changed = (a, b) => !a || a.length !== b.length || b.some((value, i) => value !== a[i]);
  const react = {
    useMemo(create, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: create(), deps };
      return slots[i].value;
    },
    useSyncExternalStore(_subscribe, snapshot) { cursor++; return snapshot(); },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) pending.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  const AppState = { addEventListener(event, callback) {
    assert.equal(event, 'change'); listeners.add(callback); return { remove: () => listeners.delete(callback) };
  } };
  const { useSupplierPicker } = load('supplier/useSupplierCreate', {
    react, 'react-native': { AppState }, '../preparation/usePreparationNotice': {},
    './supplierApi': { supplierItems: read }, './supplierCreateController': controllers,
  });
  return {
    listeners,
    render(session) { cursor = 0; pending = []; return useSupplierPicker({ session }); },
    commit() { const effects = pending; pending = []; effects.forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

// V2 supplier_item_picker_screen.dart:27-52: init loads, resume reloads only while mounted.
test('picker loads on entry and resume, and a queued resume after disposal cannot start a read', async () => {
  const calls = [], session = {};
  const h = harness(async actual => { calls.push(actual); return []; });
  h.render(session); h.commit(); await tick();
  assert.deepEqual(calls, [session]);
  const callback = [...h.listeners][0];
  callback('background'); callback('inactive'); callback('active'); await tick();
  assert.deepEqual(calls, [session, session]);
  h.unmount(); assert.equal(h.listeners.size, 0);
  callback('active'); await tick();
  assert.deepEqual(calls, [session, session]);
});

test('replacing the picker session retires queued old callbacks without blocking current refresh', async () => {
  const calls = [], requests = [], old = { id: 'old' }, current = { id: 'current' };
  const h = harness(session => { calls.push(session); const request = deferred(); requests.push(request); return request.promise; });
  const first = h.render(old); h.commit(); const oldCallback = [...h.listeners][0];
  const second = h.render(current); h.commit(); const currentCallback = [...h.listeners][0];
  oldCallback('active');
  assert.deepEqual(calls, [old, current]);
  currentCallback('active'); assert.deepEqual(calls, [old, current, current]);
  requests[0].resolve([{ code: 'old' }]); requests[1].resolve([{ code: 'superseded' }]);
  requests[2].resolve([{ code: 'current' }]); await tick();
  assert.deepEqual(first.controller.getSnapshot().items, []);
  assert.deepEqual(second.controller.getSnapshot().items, [{ code: 'current' }]);
  h.unmount(); assert.equal(h.listeners.size, 0);
});

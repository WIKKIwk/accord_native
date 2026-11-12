const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./support/workerOrderScreen.cjs');
const { hooks, tick, defer } = require('./support/workerPaddonHarness.cjs');
const { workerQrPayload } = load('workerQr.ts');

function setup(platform = 'ios', options = {}) {
  const runner = hooks();
  const h = { scope: 'one', version: 1, current: true, reads: [], orders: [], closes: 0, permissionRequests: 0,
    permission: { granted: true, status: 'granted', canAskAgain: true }, ...options };
  const { useWorkerQrScanner } = load('components/useWorkerQrScanner.ts', {
    react: runner.react,
    'expo-camera': { useCameraPermissions: () => [h.permission, async () => { h.permissionRequests++; return h.permission; }] },
    'react-native': { Platform: { OS: platform }, AppState: { currentState: 'active', addEventListener: (_event, receive) => { h.appState = receive; return { remove() {} }; } } },
    '../auth': { activeSessionToken: () => 'token', captureSessionWitness: () => ({ version: h.version }), isSessionWitnessCurrent: witness => witness.version === h.version },
    '../sessionReadScope': { sessionReadScope: () => h.scope }, '../workerQr': { workerQrPayload },
    '../workerFabQr': { prepareWorkerFabQr: async (_s, _a, qr) => { h.reads.push(qr); if (h.gate) await h.gate.promise; if (h.failure) throw Error(h.failure);
      return { orderId: 'order', switching: false }; }, WorkerFabGuidance: class extends Error {}, workerFabErrorText: e => e.message },
    '../workerFabQrReads': { workerFabQrReads: (_s, _a, _get, current) => ({ current }) },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: key => key, t: text => text }) },
  });
  h.props = { session: {}, apparatusId: 'apparatus', apparatus: { id: 'apparatus' }, getSnapshot: () => null, apparatusLabel: value => value,
    current: () => h.current, onClose: () => h.closes++, onOrder: (...args) => h.orders.push(args) };
  h.render = () => { runner.begin(); h.model = useWorkerQrScanner(h.props); runner.flush(); return h.model; };
  h.dispose = runner.dispose;
  h.render();
  return h;
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: normalized lookup waits for sheet dismissal and opens the order once`, async () => {
    const h = setup(platform, { gate: defer() });
    h.model.camera.scan('https://example.test/scan/x?qr_payload=00001');
    h.model.camera.scan('duplicate'); assert.deepEqual(h.reads, ['00001']);
    h.gate.resolve(); await tick();
    assert.equal(h.render().closing, true); assert.equal(h.model.camera.active, false); assert.deepEqual(h.orders, []);
    h.model.close(); // SwiftUI echoes false after a programmatic close.
    h.model.dismissed(); h.model.dismissed();
    assert.deepEqual(h.orders, [['apparatus', 'order', '00001', false]]); assert.equal(h.closes, 0);
    h.dispose();
  });
  test(`${platform}: close during lookup aborts the handoff and late camera frames are ignored`, async () => {
    const h = setup(platform, { gate: defer() });
    h.model.camera.scan('first'); h.model.close(); h.model.camera.scan('late'); h.gate.resolve(); await tick();
    h.render().dismissed(); assert.deepEqual(h.reads, ['first']); assert.deepEqual(h.orders, []); assert.equal(h.closes, 1); h.dispose();
  });
  test(`${platform}: account/window changes during dismissal discard the scanned order`, async () => {
    for (const change of [h => { h.version++; }, h => { h.scope = 'another'; }, h => { h.current = false; }]) {
      const h = setup(platform); h.model.camera.scan('QR'); await tick(); h.render(); change(h); h.model.dismissed();
      assert.deepEqual(h.orders, []); assert.equal(h.closes, 1); h.dispose();
    }
  });
  test(`${platform}: manual entry stops camera detection and preserves native dismissal ordering`, async () => {
    const h = setup(platform); h.model.openManual(); h.model.camera.scan('frame-after-manual'); h.render();
    assert.equal(h.model.camera.active, false); assert.deepEqual(h.reads, []);
    h.model.setManual('https://example.test/scan/x?qr_payload=00001'); h.render().confirmManual();
    assert.deepEqual(h.reads, platform === 'ios' ? [] : ['00001']);
    h.render().manualDismissed(); await tick();
    assert.deepEqual(h.reads, ['00001']); assert.deepEqual(h.orders, []);
    h.render().dismissed(); assert.equal(h.orders[0][2], '00001'); h.dispose();
  });
}
test('manual cancellation or an expired manual witness cannot issue a lookup', () => {
  for (const cancelled of [true, false]) {
    const h = setup(); h.model.openManual(); h.model.setManual('QR'); h.render();
    if (cancelled) h.model.cancelManual(); else { h.model.confirmManual(); h.version++; }
    h.render().manualDismissed(); assert.deepEqual(h.reads, []); h.dispose();
  }
});
test('background and sheet closure release the camera and torch; resume can scan again', () => {
  const h = setup(); h.model.camera.onReady(); h.render().camera.toggleTorch(); assert.equal(h.render().camera.torch, true);
  h.appState('background'); assert.equal(h.model.camera.current(), false);
  h.render(); assert.equal(h.model.camera.active, false); assert.equal(h.model.camera.torch, false);
  h.appState('active'); assert.equal(h.render().camera.active, true);
  h.model.close(); assert.equal(h.model.camera.current(), false); assert.equal(h.render().camera.active, false); h.dispose();
});
test('camera failure exposes retry and the manual alternative without changing lookup failures', async () => {
  const h = setup(); h.model.camera.onError(); h.render();
  assert.equal(h.model.camera.unavailable, true); assert.equal(h.model.camera.active, false);
  await h.model.camera.retry(); h.render(); assert.equal(h.model.camera.unavailable, false); assert.equal(h.model.camera.generation, 1);
  h.failure = 'lookup failed'; h.model.camera.scan('QR'); await tick(); h.render();
  assert.equal(h.model.error, 'lookup failed'); assert.equal(h.model.closing, false);
  h.model.clearError(); h.model.openManual(); assert.equal(h.render().manualOpen, true); h.dispose();
});
test('permission is requested once and denied permission still permits manual input', () => {
  const h = setup('android', { permission: { granted: false, status: 'undetermined', canAskAgain: true } });
  h.render(); assert.equal(h.permissionRequests, 1); assert.equal(h.model.camera.active, false);
  h.model.openManual(); assert.equal(h.render().manualOpen, true); h.dispose();
});

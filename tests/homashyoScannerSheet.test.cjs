const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./support/workerOrderScreen.cjs');
const { hooks, jsx, tick } = require('./support/workerPaddonHarness.cjs');

function fixture(platform, options = {}) {
  const runner = hooks(), guard = load('shared/camera/synchronousGuard.ts');
  const h = { current: true, permission: { granted: true, canAskAgain: true }, results: [], closes: 0, requests: 0, ...options };
  const { RawSplitScanGate } = load('homashyo/rawSplitScanLogic.ts', { './rawSplitBarcode': { rawSplitBarcode: value => value.trim().toUpperCase() } });
  const { useRawSplitScanner } = load('homashyo/useRawSplitScanner.ts', {
    react: runner.react, '../shared/camera/synchronousGuard': guard,
    '../shared/camera/useCameraSurfacePermission': { useCameraSurfacePermission: () => ({ permission: h.permission, checking: false,
      canUseCamera: () => h.permission?.granted === true, requestPermission: async () => { h.requests++; return h.permission; } }) },
    '../shared/localization': { productionText: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    './rawSplitScanLogic': { RawSplitScanGate },
  });
  const { RawSplitScanner } = load('homashyo/RawSplitScanner.tsx', {
    react: runner.react, 'react/jsx-runtime': jsx, 'react-native': { Platform: { OS: platform },
      AppState: { addEventListener: (_event, listener) => { h.app = listener; return { remove() {} }; } } },
    '../components/WorkerQrScannerView': { WorkerQrScannerView: 'WorkerQrScannerView' },
    '../components/useWorkerOrderText': { useWorkerOrderText: () => ({ p: key => key, t: value => value }) },
    '../shared/camera/synchronousGuard': guard, './useRawSplitScanner': { useRawSplitScanner },
  });
  h.props = { visible: true, active: true, isCurrent: () => h.current, onClose: () => { h.closes++; },
    onComplete: (barcode, source) => { if (!h.current) return false; h.results.push([barcode, source]); return true; } };
  h.render = () => {
    const wrapper = RawSplitScanner(h.props);
    if (!wrapper) return null;
    runner.begin(); const tree = wrapper.type(wrapper.props); runner.flush();
    assert.equal(tree.type, 'WorkerQrScannerView'); h.model = tree.props.model; return h.model;
  };
  h.dispose = runner.dispose;
  h.render();
  return h;
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: homashyo reuses the worker scanner sheet and delivers one raw barcode after dismissal`, () => {
    const h = fixture(platform);
    h.model.camera.scan('display-code', ' raw-code ');
    h.model.camera.scan('duplicate');
    assert.deepEqual(h.results, []); assert.equal(h.render().closing, true); assert.equal(h.model.camera.active, false);
    h.model.close(); // Native iOS may echo a close event for a programmatic dismissal.
    h.model.dismissed(); h.model.dismissed();
    assert.deepEqual(h.results, [['RAW-CODE', 'camera']]); assert.equal(h.closes, 0); h.dispose();
  });
  test(`${platform}: empty raw data is not replaced and parsed data is used when raw is absent`, () => {
    const h = fixture(platform);
    h.model.camera.scan('display-code', ''); assert.equal(h.render().closing, false);
    h.model.camera.scan(' display-code '); h.render().dismissed();
    assert.deepEqual(h.results, [['DISPLAY-CODE', 'camera']]); h.dispose();
  });
  test(`${platform}: denied camera still allows manual barcode input with native dismissal ordering`, () => {
    const h = fixture(platform, { permission: { granted: false, canAskAgain: false } });
    assert.equal(h.model.camera.unavailable, true); h.model.openManual();
    let model = h.render(); assert.equal(model.manualOpen, true); assert.equal(model.camera.active, false);
    model.setManual(' manual-123 '); model = h.render(); model.confirmManual();
    model = h.render(); assert.deepEqual(h.results, []);
    if (platform === 'ios') { assert.equal(model.closing, false); model.manualDismissed(); model = h.render(); }
    assert.equal(model.closing, true); model.dismissed();
    assert.deepEqual(h.results, [['MANUAL-123', 'manual']]); assert.equal(h.closes, 0); h.dispose();
  });
  test(`${platform}: cancelling manual input resumes the camera after the dialog is dismissed`, () => {
    const h = fixture(platform); h.model.openManual(); let model = h.render(); model.cancelManual(); model = h.render();
    if (platform === 'ios') { assert.equal(model.camera.active, false); model.manualDismissed(); model = h.render(); }
    assert.equal(model.camera.active, true); assert.equal(model.camera.current(), true);
    assert.equal(model.camera.generation, 1); assert.deepEqual(h.results, []); h.dispose();
  });
  test(`${platform}: cancel, dismissal and stale ownership cannot dispatch a scan`, () => {
    const closed = fixture(platform); closed.model.close(); closed.model.camera.scan('late');
    assert.equal(closed.closes, 0); closed.render().dismissed(); closed.model.dismissed();
    assert.deepEqual(closed.results, []); assert.equal(closed.closes, 1); closed.dispose();
    const stale = fixture(platform); stale.model.camera.scan('old'); stale.render(); stale.current = false; stale.model.dismissed();
    assert.deepEqual(stale.results, []); assert.equal(stale.closes, 1); stale.dispose();
    const unmounted = fixture(platform); unmounted.model.camera.scan('old'); unmounted.render(); unmounted.dispose(); unmounted.model.dismissed();
    assert.deepEqual(unmounted.results, []); assert.equal(unmounted.closes, 0);
  });
  test(`${platform}: camera activity follows the owner and retry restores a failed preview`, async () => {
    const h = fixture(platform); h.model.camera.onReady(); h.render().camera.toggleTorch();
    assert.equal(h.render().camera.torch, true); h.app('background'); h.props.active = false; assert.equal(h.render().camera.current(), false);
    assert.equal(h.render().camera.torch, false); h.model.camera.scan('background'); assert.deepEqual(h.results, []);
    h.props.active = true; h.render().camera.onError(); assert.equal(h.render().camera.unavailable, true);
    await h.model.camera.retry(); const model = h.render(); assert.equal(model.camera.unavailable, false); assert.equal(model.camera.generation, 1);
    h.dispose();
  });
  test(`${platform}: asynchronous owner guards never authorize the camera`, async () => {
    for (const guard of [() => Promise.resolve(true), () => Promise.reject(new Error('stale'))]) {
      const h = fixture(platform); h.props.isCurrent = guard; const model = h.render();
      assert.equal(model.camera.current(), false); model.camera.scan('old'); await tick();
      assert.deepEqual(h.results, []); h.dispose();
    }
  });
}

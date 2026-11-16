const base = require('./adminUsersSupport.cjs');
const model = base.load('admin/adminReliableScannerModel'), coordinatorModule = base.load('admin/adminReliableScannerCoordinator'), sessionModule = base.load('admin/adminReliableScannerSession', { './adminReliableScannerModel': model });
function scheduler() {
  let now = 0, serial = 0; const timers = new Map();
  return { set(callback, duration) { const id = ++serial; timers.set(id, { at: now + duration, callback }); return id; }, clear(id) { timers.delete(id); }, size: () => timers.size, now: () => now,
    async advance(duration) { const end = now + duration; while (true) { const next = [...timers.entries()].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].callback(); await base.flush(); } now = end; await base.flush(); } };
}
function environment() {
  const calls = [], errors = [], clock = scheduler(), report = (error, context) => { errors.push([context, error]); };
  const coordinator = new coordinatorModule.AdminReliableScannerCoordinator(report);
  function create(name, options = {}) {
    const identity = {}, captures = [], detectionErrors = [], torch = []; let state = Object.freeze({ nativeIdentity: identity, runIdentity: null, initialized: options.initialized ?? false, isRunning: false, hasCameraPermission: options.initialized ?? false, error: null, torch: 'unavailable' });
    let start = async () => { state = Object.freeze({ ...state, initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {}, torch: 'off' }); }, stop = async () => { state = Object.freeze({ ...state, isRunning: false, runIdentity: null, torch: state.torch === 'unavailable' ? 'unavailable' : 'off' }); }, dispose = async () => { state = Object.freeze({ ...state, isRunning: false, runIdentity: null }); }, toggling = async () => { state = Object.freeze({ ...state, torch: state.torch === 'on' ? 'off' : 'on' }); return { nativeIdentity: identity, runIdentity: state.runIdentity, torch: state.torch }; };
    const completion = operation => Object.freeze({ nativeIdentity: identity, operation });
    const driver = { nativeIdentity: identity, getState: () => state,
      start: async () => { calls.push([name, 'start']); const receipt = await start(); return receipt === undefined ? completion('start') : receipt; },
      stop: async () => { calls.push([name, 'stop']); const receipt = await stop(); return receipt === undefined ? completion('stop') : receipt; },
      dispose: async () => { calls.push([name, 'dispose']); const receipt = await dispose(); return receipt === undefined ? completion('dispose') : receipt; },
      subscribeCaptures: listener => { calls.push([name, 'listen-capture']); captures.push(listener); return () => calls.push([name, 'unlisten-capture']); },
      subscribeDetectionErrors: listener => { calls.push([name, 'listen-error']); detectionErrors.push(listener); return () => calls.push([name, 'unlisten-error']); },
      subscribeTorch: listener => { calls.push([name, 'listen-torch']); torch.push(listener); return () => calls.push([name, 'unlisten-torch']); },
      toggleTorch: async () => { calls.push([name, 'torch']); return toggling(); } };
    const session = new sessionModule.AdminReliableScannerSession(driver, coordinator, report, clock);
    return { session, driver, identity, captures, detectionErrors, torch, state: () => state, patch: value => { state = Object.freeze({ ...state, ...value }); },
      start: value => { start = value; }, stop: value => { stop = value; }, dispose: value => { dispose = value; }, toggle: value => { toggling = value; }, completion,
      capture: barcodes => ({ nativeIdentity: identity, runIdentity: state.runIdentity, barcodes }), error: error => ({ nativeIdentity: identity, runIdentity: state.runIdentity, error }) };
  }
  return { create, calls, errors, clock, coordinator };
}
module.exports = { ...base, model, ...coordinatorModule, ...sessionModule, scheduler, environment };

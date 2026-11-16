const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminReliableScannerSupport.cjs');
test('construction has no native actions; capture subscription precedes explicit attach and actual start receipt/running state', async () => {
  const e = s.environment(), a = e.create('A'), frames = []; assert.deepEqual(e.calls, []); assert.equal(a.session.phase, 'idle'); a.session.subscribeCaptures(receipt => frames.push(receipt)); await a.session.attach();
  assert.deepEqual(e.calls, [['A', 'listen-capture'], ['A', 'start']]); assert.equal(a.session.phase, 'running'); const frame = a.capture([{ rawValue: 'FIRST' }, { displayValue: 'SECOND' }]); a.captures[0](frame); assert.equal(frames[0], frame); assert.deepEqual(frames[0].barcodes.map(value => value.rawValue ?? value.displayValue), ['FIRST', 'SECOND']);
});
test('only most recently promoted attached+visible+resumed+requested session owns camera and stop precedes owner handoff', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'); await a.session.attach(); await b.session.attach(); assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['B', 'start']]); assert.equal(a.session.phase, 'suspended'); assert.equal(b.session.phase, 'running');
  await b.session.setRouteVisible(false); assert.deepEqual(e.calls.slice(-2), [['B', 'stop'], ['A', 'start']]); await b.session.setRouteVisible(true); assert.deepEqual(e.calls.slice(-2), [['A', 'stop'], ['B', 'start']]);
  await b.session.stop(); await b.session.setAppResumed(false); await b.session.setAppResumed(true); assert.equal(b.session.phase, 'suspended'); assert.equal(a.session.phase, 'running'); await b.session.retry(); assert.equal(b.session.phase, 'running');
});
test('native dispose of a retired nonowner is deferred while another camera owns platform, and executes only after live owner stops', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'); await a.session.attach(); await b.session.attach(); await a.session.dispose(); assert.equal(e.calls.some(([name, kind]) => name === 'A' && kind === 'dispose'), false); assert.equal(a.session.disposed, true);
  await b.session.stop(); assert.deepEqual(e.calls.slice(-2), [['B', 'stop'], ['A', 'dispose']]); assert.equal(a.session.phase, 'disposed'); assert.equal(await a.session.start(), false); await a.session.attach(); assert.equal(a.session.phase, 'disposed');
});
test('current owner disposal stops then disposes original driver before next owner starts; repeated dispose never releases a replacement', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'); await a.session.attach(); await b.session.attach(); await b.session.dispose(); assert.deepEqual(e.calls.slice(-3), [['B', 'stop'], ['B', 'dispose'], ['A', 'start']]); const count = e.calls.length; await b.session.dispose(); assert.equal(e.calls.length, count);
});
test('uninitialized first permission/start has no 8 second timeout even if OS was previously granted; serial queue waits actual native completion', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'), prompt = s.deferred(); a.start(() => prompt.promise); const attached = a.session.attach(); const queued = b.session.attach(); await e.clock.advance(60000); assert.equal(e.clock.size(), 0); assert.deepEqual(e.calls, [['A', 'start']]); assert.equal(a.session.phase, 'starting');
  a.patch({ initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {} }); prompt.resolve(a.completion('start')); await attached; await queued; assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['B', 'start']]);
});
test('permission snapshot is read AFTER invoking start; a genuine initialized state now enforces Source 8 second two-attempt recovery', async () => {
  const e = s.environment(), a = e.create('A'), pending = s.deferred(); a.start(() => { a.patch({ initialized: true, hasCameraPermission: true }); return pending.promise; }); const attaching = a.session.attach(); await e.clock.advance(8000); assert.equal(a.session.recoveryCount, 1); assert.equal(a.session.phase, 'recovering'); assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['A', 'start']]); await e.clock.advance(8000); await attaching;
  assert.equal(a.session.phase, 'error'); assert.equal(a.session.lastError.name, 'TimeoutError'); pending.resolve(a.completion('start')); await s.flush(); assert.equal(a.session.phase, 'error');
});
test('first failed native start retries only once with actual stop, preserves error identity and clears it on genuine running recovery', async () => {
  const e = s.environment(), a = e.create('A', { initialized: true }), error = Error('native start failed'); let starts = 0;
  a.start(async () => { if (++starts === 1) throw error; a.patch({ isRunning: true, runIdentity: {} }); }); const phases = []; a.session.subscribe(() => phases.push(a.session.phase)); await a.session.attach();
  assert.deepEqual(phases, ['starting', 'recovering', 'running']); assert.equal(a.session.recoveryCount, 1); assert.equal(a.session.lastError, null); assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['A', 'start']]);
});
test('resolved start without actual matching completion/running state never fakes a running phase', async () => {
  for (const invalid of [null, { nativeIdentity: {}, operation: 'start' }, { nativeIdentity: {}, operation: 'stop' }]) { const e = s.environment(), a = e.create('A', { initialized: true }); a.start(async () => invalid); await a.session.attach(); assert.equal(a.session.phase, 'error'); assert.equal(a.session.recoveryCount, 1); }
  const e = s.environment(), a = e.create('A', { initialized: true }), error = Error('native failed state'); a.patch({ error }); a.start(async () => a.completion('start')); await a.session.attach(); assert.equal(a.session.lastError, error); assert.equal(a.session.phase, 'error');
});
test('4 second Source release timeout records a failure and permits policy reconciliation, never manufactures a native stop receipt', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'), release = s.deferred(); await a.session.attach(); a.stop(() => release.promise); const switching = b.session.attach(); await e.clock.advance(3999); assert.deepEqual(e.calls.slice(-1), [['A', 'stop']]); await e.clock.advance(1); await switching; assert.equal(a.session.lastError.name, 'TimeoutError'); assert.equal(b.session.phase, 'running'); assert.equal(a.state().isRunning, true);
  release.resolve(a.completion('stop')); await s.flush(); assert.equal(b.session.phase, 'running');
});
test('4 second Source disposal is best effort and terminal policy phase cannot be mistaken for actual native dispose acknowledgment', async () => {
  const e = s.environment(), a = e.create('A'), disposal = s.deferred(); await a.session.attach(); a.dispose(() => disposal.promise); const retiring = a.session.dispose(); await s.flush(); assert.equal(a.session.disposed, true); await e.clock.advance(4000); await retiring; assert.equal(a.session.phase, 'disposed'); assert.equal(a.session.lastError.name, 'TimeoutError'); disposal.resolve(a.completion('dispose')); await s.flush(); assert.equal(a.session.phase, 'disposed');
});
test('route coverage/background suspends actual camera; returning foreground forces a fresh Source stop/start and explicit stop survives visibility changes', async () => {
  const e = s.environment(), a = e.create('A'); await a.session.attach(); await a.session.setAppResumed(false); assert.equal(a.session.phase, 'suspended'); await a.session.setAppResumed(true); assert.equal(a.session.phase, 'running'); assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['A', 'start']]);
  await a.session.stop(); const count = e.calls.length; await a.session.setRouteVisible(false); await a.session.setRouteVisible(true); assert.equal(e.calls.length, count); assert.equal(a.session.phase, 'suspended');
});
test('detached session cannot start a camera; exact effect replay may attach retained original driver without permanent disposal', async () => {
  const e = s.environment(), a = e.create('A'); assert.equal(await a.session.start(), false); assert.deepEqual(e.calls, []); await a.session.attach(); await a.session.detach(); assert.equal(a.session.phase, 'suspended'); await a.session.attach(); assert.equal(a.session.phase, 'running'); assert.equal(e.calls.some(([, kind]) => kind === 'dispose'), false);
});
test('native detection errors report original error and coalesce one recovery while in flight, without pretending the error is a mount failure', async () => {
  const e = s.environment(), a = e.create('A'), stop = s.deferred(); await a.session.attach(); const error = Error('decode failure'), receipt = a.error(error); a.stop(() => stop.promise); a.session.handleDetectionError(receipt); a.session.handleDetectionError(receipt); await s.flush(); assert.equal(e.calls.filter(([, kind]) => kind === 'stop').length, 1); assert.deepEqual(e.errors.map(([kind]) => kind), ['detection', 'detection']); stop.resolve(a.completion('stop')); await a.session.settled; await s.flush(); assert.equal(a.session.phase, 'running');
});
test('original run/capture/error/torch receipts and unsubscribed native callbacks cannot adopt a restarted or disposed driver', async () => {
  const e = s.environment(), a = e.create('A'), frames = [], torches = []; const leave = a.session.subscribeCaptures(receipt => frames.push(receipt)), errors = a.session.subscribeDetectionErrors(), lights = a.session.subscribeTorch(receipt => torches.push(receipt)); await a.session.attach();
  const old = a.capture([{ rawValue: 'old' }]), oldError = a.error(Error('old error')), oldTorch = { nativeIdentity: a.identity, runIdentity: a.state().runIdentity, torch: 'on' }; await a.session.retry(); a.captures[0](old); a.detectionErrors[0](oldError); a.torch[0](oldTorch); assert.deepEqual(frames, []); assert.deepEqual(e.errors, []); assert.deepEqual(torches, []);
  leave(); errors(); lights(); a.captures[0](a.capture([{ rawValue: 'late removed callback' }])); assert.deepEqual(frames, []); await a.session.dispose(); a.session.handleDetectionError(oldError); assert.deepEqual(e.errors, []);
});
test('torch control requires actual initialized/running/available state and late acknowledgment never moves to a new native run', async () => {
  const e = s.environment(), a = e.create('A'); assert.equal(await a.session.toggleTorch(), null); await a.session.attach(); const on = await a.session.toggleTorch(); assert.equal(on.torch, 'on'); const pending = s.deferred(), run = a.state().runIdentity; a.toggle(() => pending.promise); const toggling = a.session.toggleTorch(); await a.session.retry(); pending.resolve({ nativeIdentity: a.identity, runIdentity: run, torch: 'off' }); assert.equal(await toggling, null);
});
test('driver identity/methods cannot be replaced after construction and missing native receipt contracts fail closed', async () => {
  const e = s.environment(), a = e.create('A'); a.driver.start = async () => { assert.fail('replacement method'); }; await a.session.attach(); assert.equal(a.session.phase, 'running');
  for (const driver of [null, {}, { ...a.driver, subscribeCaptures: null }, { ...a.driver, getState: null }]) assert.throws(() => new s.AdminReliableScannerSession(driver, e.coordinator, () => {}), TypeError);
});
test('actual early capture can arrive before the start future completes because the listener was attached before native start', async () => {
  const e = s.environment(), a = e.create('A'), pending = s.deferred(), frames = []; a.start(() => pending.promise); a.session.subscribeCaptures(receipt => frames.push(receipt));
  const attached = a.session.attach(); assert.equal(a.session.phase, 'starting'); a.patch({ initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {} });
  const frame = a.capture([{ rawValue: 'EARLY' }]); a.captures[0](frame); assert.deepEqual(frames, [frame]); assert.equal(a.session.phase, 'starting');
  pending.resolve(a.completion('start')); await attached; assert.equal(a.session.phase, 'running');
});
test('dispose during an actual pending permission prompt waits for original completion then stop/dispose, before a newer owner starts', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'), pending = s.deferred(), phases = []; a.start(() => pending.promise); a.session.subscribe(() => phases.push(a.session.phase));
  const attached = a.session.attach(), disposed = a.session.dispose(), next = b.session.attach(); await e.clock.advance(60000); assert.deepEqual(e.calls, [['A', 'start']]);
  a.patch({ initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {} }); pending.resolve(a.completion('start')); await Promise.all([attached, disposed, next]);
  assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['A', 'dispose'], ['B', 'start']]); assert.deepEqual(phases, ['starting', 'running', 'stopping', 'disposed']); assert.equal(b.session.phase, 'running');
});
test('failed native subscription setup makes any leaked original callback inert rather than accepting future frames, decode errors or torch state', async () => {
  for (const method of ['subscribeCaptures', 'subscribeDetectionErrors', 'subscribeTorch']) for (const throws of [false, true]) {
    const e = s.environment(), a = e.create('A'), received = [], failure = Error('native subscribe failed'); let leaked;
    const driver = { ...a.driver, [method]: listener => { leaked = listener; if (throws) throw failure; } };
    const session = new s.AdminReliableScannerSession(driver, e.coordinator, error => e.errors.push(error), e.clock);
    assert.throws(() => session[method](receipt => received.push(receipt)), throws ? error => error === failure : TypeError); await session.attach(); const before = e.calls.length;
    leaked(method === 'subscribeCaptures' ? a.capture([{ rawValue: 'LEAKED' }]) : method === 'subscribeDetectionErrors' ? a.error(failure) : { nativeIdentity: a.identity, runIdentity: a.state().runIdentity, torch: 'on' });
    await s.flush(); assert.deepEqual(received, []); assert.deepEqual(e.errors, []); assert.equal(e.calls.length, before);
  }
});
test('original native state access retiring the owner or its subscription cannot authorize a queued capture or a new torch command', async () => {
  for (const command of ['capture-dispose', 'capture-unsubscribe', 'torch-dispose']) {
    const e = s.environment(), a = e.create('A'), frames = []; let armed = false, session, leave;
    const driver = { ...a.driver, getState: () => { const state = a.state(); if (armed) { armed = false; if (command === 'capture-unsubscribe') leave(); else void session.dispose(); } return state; } };
    session = new s.AdminReliableScannerSession(driver, e.coordinator, () => {}, e.clock); leave = session.subscribeCaptures(receipt => frames.push(receipt)); await session.attach(); armed = true;
    if (command === 'torch-dispose') { assert.equal(await session.toggleTorch(), null); assert.equal(e.calls.some(([, kind]) => kind === 'torch'), false); }
    else { a.captures[0](a.capture([{ rawValue: 'STALE' }])); assert.deepEqual(frames, []); } await session.settled;
  }
});
test('a failing coalesced coordinator batch settles every request and a throwing reporter cannot block the next original camera owner', async () => {
  const e = s.environment(), a = e.create('A'), b = e.create('B'), c = e.create('C'), pending = s.deferred(), failure = Error('native state read failed'), reported = [];
  const coordinator = new s.AdminReliableScannerCoordinator(error => { reported.push(error); throw Error('reporter failed'); });
  const first = new s.AdminReliableScannerSession(a.driver, coordinator, () => {}, e.clock), broken = new s.AdminReliableScannerSession({ ...b.driver, getState: () => { throw failure; } }, coordinator, () => {}, e.clock), next = new s.AdminReliableScannerSession(c.driver, coordinator, () => {}, e.clock);
  let follow; broken.subscribe(() => { if (broken.phase === 'error') follow = next.attach(); }); a.start(() => pending.promise);
  const attaching = first.attach(), one = broken.attach(), two = broken.attach(), all = coordinator.settled; a.patch({ initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {} }); pending.resolve(a.completion('start'));
  await Promise.all([attaching, one, two, all]); await follow; assert.deepEqual(reported, [failure]); assert.equal(broken.lastError, failure); assert.equal(next.phase, 'running'); assert.deepEqual(e.calls, [['A', 'start'], ['A', 'stop'], ['B', 'stop'], ['C', 'start']]);
});
test('a preview-style Promise<void> cannot stand in for an actual native start completion even if the state reports running', async () => {
  const e = s.environment(), a = e.create('A'); let starts = 0;
  const session = new s.AdminReliableScannerSession({ ...a.driver, start: async () => { starts++; a.patch({ initialized: true, hasCameraPermission: true, isRunning: true, runIdentity: {} }); } }, e.coordinator, () => {}, e.clock);
  await session.attach(); assert.equal(starts, 2); assert.equal(session.phase, 'error'); assert.match(session.lastError.message, /Original native scanner completion/);
});

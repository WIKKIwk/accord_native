const test = require('node:test'), assert = require('node:assert/strict'), s = require('./adminScaffoldLayoutSupport.cjs');
async function bound(f) { const binding = f.register(); await s.flush(); binding.setDockMarker({ tag: 2, nativeID: 'actual-dock-host' }); await s.flush(); return binding; }
test('first real page can mount before markers; actual viewport then dock-only native receipt bootstraps source layout without a fixed-host deadlock', async () => {
  const f = s.fixture(); assert.equal(f.owner.reader.isAvailable(), true); f.pair(); assert.deepEqual(f.emitted, [null]); assert.equal(f.calls.length, 0);
  const binding = f.register(); assert.equal(binding.getSnapshot().phase, 'binding'); assert.equal(binding.getSnapshot().metrics, null); await s.flush();
  assert.deepEqual(binding.getSnapshot().metrics, { platform: 'android', width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 0 }); assert.equal(binding.getSnapshot().viewport.safeTop, 30); assert.equal(binding.getSnapshot().dockHeight, null);
  binding.setDockMarker({ tag: 2, nativeID: 'actual-dock-host' }); await s.flush(); assert.equal(f.calls[1].kind, 'dock'); assert.equal(f.calls[1].args[1].nativeID, 'actual-dock-host');
  assert.equal(binding.getSnapshot().dockHeight, 547 / 2.75); assert.notEqual(binding.getSnapshot().dockHeight, 199); assert.equal(f.calls.some(call => call.kind === 'pair'), false); f.cleanup();
});
test('full Reader pair requires actual registered Source scaffold and original viewport/dock/fixed receipts, preserving original raw IME and stable window identity', async () => {
  const f = s.fixture(), binding = await bound(f); const stop = f.pair(); await s.flush(); const pair = f.emitted.at(-1); assert.ok(pair); assert.equal(pair.window.identity, binding.getSnapshot().windowIdentity); assert.equal(pair.host.windowIdentity, pair.window.identity); assert.equal(pair.dock.windowIdentity, pair.window.identity);
  assert.equal(pair.window.viewport.height, 800); assert.equal(pair.host.frame.height, 500); assert.equal(pair.dock.height, 547 / 2.75); assert.deepEqual(pair.remainingSafeArea, { left: 11, right: 23, bottom: 0 });
  const foreign = f.owner.registerScaffold({ scaffold: { ...f.scaffold }, viewportMarker: { tag: 8, nativeID: 'fake-source' }, isCurrent: () => true }); assert.equal(foreign, null); assert.equal(f.calls.length, 3); stop(); await s.flush(); assert.equal(f.releases.at(-1).handle, f.calls[2].result.handle); f.cleanup();
});
test('real dock marker can arrive while viewport ACK is pending; no numeric host value or invented marker dispatches a native part', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(); binding.setDockMarker({ tag: 2, nativeID: 'dock-real' }); assert.equal(f.calls.length, 1);
  f.settle(0); await s.flush(); assert.equal(f.calls.length, 2); assert.equal(binding.getSnapshot().dockHeight, null); f.settle(1); await s.flush(); assert.equal(binding.getSnapshot().dockHeight, 547 / 2.75); f.cleanup();
});
test('pre-ACK event keeps newest real revision; late initial ACK cannot overwrite actual keyboard/viewport facts', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(), call = f.calls[0], seen = []; binding.subscribe(() => seen.push(binding.getSnapshot().metrics?.viewInsetsBottom)); f.emit({ ...call.result.initial, revision: 3, frame: 3, viewport: s.viewport({ rawImeBottom: 300 }) });
  f.settle(0); await s.flush(); assert.deepEqual(seen, [300]); assert.equal(binding.getSnapshot().metrics.viewInsetsBottom, 300); f.emit({ ...call.result.initial, revision: 2, frame: 2 }); assert.equal(binding.getSnapshot().metrics.viewInsetsBottom, 300); f.cleanup();
});
test('source frame coherence holds an old dock/pair rather than mixing it with newer native viewport/IME facts', async () => {
  const f = s.fixture(), binding = await bound(f); f.pair(); await s.flush(); const viewport = f.calls[0].result.initial, dock = f.calls[1].result.initial, pair = f.calls[2].result.initial;
  f.emit({ ...viewport, revision: 5, frame: 20, viewport: s.viewport({ rawImeBottom: 300 }) }); assert.equal(binding.getSnapshot().dockHeight, null);
  f.emit({ ...dock, revision: 5, frame: 19 }); assert.equal(binding.getSnapshot().dockHeight, null); f.emit({ ...pair, revision: 5, frame: 19 }); assert.equal(f.emitted.at(-1), null);
  f.emit({ ...dock, revision: 6, frame: 20, dock: { viewport: s.viewport({ rawImeBottom: 300 }), dockHeight: 200 } }); assert.equal(binding.getSnapshot().dockHeight, 200);
  f.emit({ ...pair, revision: 6, frame: 21, pair: { ...pair.pair, viewport: s.viewport({ rawImeBottom: 400 }), dockHeight: 201 } }); assert.equal(f.emitted.at(-1).window.rawImeBottom, 400); assert.equal(binding.getSnapshot().dockHeight, 201); f.cleanup();
});
test('unknown native geometry remains null and temporary same-original-window absence never abandons the global source owner', async () => {
  const f = s.fixture(), binding = await bound(f); f.pair(); await s.flush(); const viewport = f.calls[0].result.initial, dock = f.calls[1].result.initial, pair = f.calls[2].result.initial;
  f.emit({ ...viewport, revision: 2, frame: 5, viewport: null }); f.emit({ ...dock, revision: 2, frame: 5, dock: null }); f.emit({ ...pair, revision: 2, frame: 5, pair: null }); assert.equal(binding.getSnapshot().metrics, null); assert.equal(binding.getSnapshot().dockHeight, null); assert.equal(f.emitted.at(-1), null); assert.equal(f.owner.reader.isAvailable(), true);
  f.emit({ ...dock, revision: 3, frame: 6 }); f.emit({ ...pair, revision: 3, frame: 6 }); assert.ok(f.emitted.at(-1)); f.cleanup();
});
test('old native view/window retirement cannot be adopted by a later Source scaffold registration or retained event/callback', async () => {
  const f = s.fixture(), first = await bound(f); f.pair(); await s.flush(); const old = f.calls[0].result.initial; f.emit({ ...old, revision: 10, frame: 10, retired: true, viewport: null }); assert.equal(first.getSnapshot().phase, 'retired');
  const fresh = f.register({ tag: 10, nativeID: 'new-original-viewport' }); await s.flush(); const identity = fresh.getSnapshot().windowIdentity; f.emit({ ...old, revision: 11, frame: 11 }); first.setDockMarker({ tag: 9, nativeID: 'old-dock' }); assert.equal(fresh.getSnapshot().windowIdentity, identity); assert.equal(fresh.getSnapshot().dockHeight, null); f.cleanup();
});
test('cleanup/account loss before original ACK cancels exact pending ticket and releases its late native receipt without publishing measurements', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(); f.owner.dispose(); assert.deepEqual(f.cancellations, [f.calls[0].ticket]); f.settle(0); await s.flush(); assert.equal(f.releases[0].handle, f.calls[0].result.handle); assert.equal(binding.getSnapshot().phase, 'retired'); assert.equal(binding.getSnapshot().metrics, null); assert.equal(f.listeners.size, 0);
});
test('actual Source epoch retirement releases all native viewport/dock/pair resources and same-object authority cannot revive them', async () => {
  const f = s.fixture(), binding = await bound(f); f.pair(); await s.flush(); f.current(false); f.target.current(); assert.equal(binding.getSnapshot().phase, 'retired'); assert.equal(f.owner.reader.isAvailable(), false); assert.equal(f.releases.length, 3); f.current(true); assert.equal(f.owner.reader.isAvailable(), false); f.cleanup();
});
test('original fixed native lifetime false is latched, while changing top/focus is not silently mixed into account/viewport ownership', async () => {
  const f = s.fixture(), binding = await bound(f); f.pair(); await s.flush(); const old = f.calls[2].result.initial, count = f.emitted.length; f.fixed(false); f.emit({ ...old, revision: 2, frame: 5 }); f.fixed(true); f.emit({ ...old, revision: 3, frame: 6 }); assert.equal(f.emitted.length, count); assert.equal(f.owner.reader.isAvailable(), true); assert.equal(binding.getSnapshot().phase, 'bound'); f.cleanup();
});
test('reentrant account retirement during real layout publication suppresses pending dock dispatch and future pair admission', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(); binding.setDockMarker({ tag: 2, nativeID: 'real-dock' }); binding.subscribe(() => { if (binding.getSnapshot().metrics) { f.original(false); f.owner.reader.isAvailable(); } }); f.settle(0); await s.flush(); assert.equal(binding.getSnapshot().phase, 'retired'); assert.equal(f.calls.length, 1); assert.equal(f.owner.reader.isAvailable(), false); f.cleanup();
});
test('strict asynchronous/reentrant page/account guards cannot authorize local native geometry requests', async () => {
  const f = s.fixture(); f.original(Promise.reject(Error('async authority'))); assert.equal(f.owner.reader.isAvailable(), false); assert.equal(f.register(), null); assert.equal(f.calls.length, 0); f.cleanup(); await s.flush();
});
test('malformed/cross-window original receipts are released and never produce a usable native layout or retry under another source identity', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(); f.calls[0].result.initial.viewport.safeTop = undefined; f.settle(0); await s.flush(); assert.equal(binding.getSnapshot().phase, 'unavailable'); assert.equal(f.releases.length, 1); assert.equal(binding.getSnapshot().metrics, null); f.cleanup();
  const g = s.fixture({ pending: true }), second = g.register(); g.settle(0); await s.flush(); second.setDockMarker({ tag: 2, nativeID: 'dock' }); g.calls[1].result.windowID = 'foreign-window'; g.calls[1].result.initial.windowID = 'foreign-window'; g.settle(1); await s.flush(); assert.equal(second.getSnapshot().dockHeight, null); assert.equal(g.releases.at(-1).windowID, 'foreign-window'); g.cleanup();
});
test('only a new genuine dock-marker callback can retry a failed native slot bind with a new original ticket; no retry timer or scalar substitute runs', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(), marker = { tag: 2, nativeID: 'actual-dock' }; f.settle(0); await s.flush(); binding.setDockMarker(marker); f.calls[1].deferred.reject(Error('marker detached before native bind')); await s.flush();
  assert.equal(binding.getSnapshot().dockHeight, null); assert.equal(f.calls.length, 2); binding.setDockMarker(marker); assert.equal(f.calls.length, 3); assert.notEqual(f.calls[2].ticket, f.calls[1].ticket); f.settle(2); await s.flush(); assert.equal(binding.getSnapshot().dockHeight, 547 / 2.75); f.cleanup();
});
test('reentrant same-dock receiver cannot recursively receive a closed Pair or dispatch duplicate native dock flights', async () => {
  const f = s.fixture(), binding = await bound(f), next = { tag: 4, nativeID: 'next-genuine-dock' }; let nulls = 0;
  f.pair(value => { if (value === null) { nulls++; binding.setDockMarker(next); } }); await s.flush(); binding.setDockMarker(next); await s.flush();
  assert.equal(nulls, 1); assert.deepEqual(f.calls.filter(call => call.kind === 'dock').map(call => call.args[1].nativeID), ['actual-dock-host', 'next-genuine-dock']); assert.equal(binding.getSnapshot().dockHeight, 547 / 2.75); f.cleanup();
});
test('new genuine dock intent during null publication supersedes the older intent before any old native request can dispatch', async () => {
  const f = s.fixture(), binding = await bound(f), middle = { tag: 4, nativeID: 'superseded-dock' }, latest = { tag: 5, nativeID: 'latest-dock' };
  f.pair(value => { if (value === null) binding.setDockMarker(latest); }); await s.flush(); binding.setDockMarker(middle); await s.flush();
  assert.deepEqual(f.calls.filter(call => call.kind === 'dock').map(call => call.args[1].nativeID), ['actual-dock-host', 'latest-dock']); f.cleanup();
});
test('pre-ACK original window retirement never transiently publishes its older initial native geometry or starts a dock bind', async () => {
  const f = s.fixture({ pending: true }), binding = f.register(), call = f.calls[0], seen = []; binding.setDockMarker({ tag: 2, nativeID: 'actual-dock' }); binding.subscribe(() => seen.push(binding.getSnapshot().phase));
  f.emit({ ...call.result.initial, revision: 2, frame: 2, retired: true, viewport: null }); f.settle(0); await s.flush(); assert.deepEqual(seen, ['retired']); assert.equal(binding.getSnapshot().metrics, null); assert.equal(f.calls.length, 1); f.cleanup();
});

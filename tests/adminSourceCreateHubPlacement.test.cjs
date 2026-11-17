const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs');
function fixture(t) {
  const f = s.fixture(), local = new s.localPlacement.AdminSourceCreateHubPlacementOwner(f.owner), stop = local.attach(), view = {};
  t.after(() => { stop(); f.cleanup(); });
  const bind = (tag = 71, nativeID = local.getSnapshot().markerID, generation = local.getSnapshot().generation) => local.bindMarker(view, { tag, nativeID }, generation);
  const ready = async () => { f.commit(); f.viewport(); await s.flush(); bind(); f.bindDock(); await s.flush(); };
  return { ...f, local, view, bind, ready };
}
test('actual local marker bootstraps before dock ACK; only SAME original native pair receipt supplies placement and never global availability', async t => {
  const f = fixture(t); assert.equal(f.local.getSnapshot().presentation, null); f.commit(); f.viewport(); await s.flush(); assert.ok(f.local.getSnapshot().markerID); f.bind();
  assert.equal(f.local.placement(), null); assert.equal(f.native.calls.filter(value => value.kind === 'pair').length, 0); f.bindDock(); assert.equal(f.local.placement(), null); await s.flush();
  const receipt = f.local.placement(), pair = f.native.calls.find(value => value.kind === 'pair'); assert.ok(receipt); assert.equal(pair.args[2].tag, 71); assert.equal(pair.args[2].nativeID, f.local.getSnapshot().markerID);
  assert.equal(receipt.dockHeight, 547 / 2.75); assert.deepEqual(receipt.frame, pair.result.initial.pair.fixed); assert.equal(receipt.nativeFrame, pair.result.initial.frame);
  assert.equal(f.local.getSnapshot().presentation.state, f.native.hub.getSnapshot()); assert.equal('isAvailable' in f.local, false); assert.equal('ownsOverlayTop' in f.local, false);
});
test('copied receipt/window/scaffold and foreign Reader cannot manufacture original local placement', async t => {
  const f = fixture(t); await f.ready(); const receipt = f.local.placement(), window = receipt.windowIdentity;
  assert.equal(f.reader.hubPlacementCurrent(receipt, f.scaffold.ticket, window), true); assert.equal(f.reader.hubPlacementCurrent({ ...receipt }, f.scaffold.ticket, window), false);
  assert.equal(f.reader.hubPlacementCurrent(receipt, { ...f.scaffold.ticket }, window), false); assert.equal(f.reader.hubPlacementCurrent(receipt, f.scaffold.ticket, { ...window }), false);
  const foreign = new f.reader.constructor({ observer: f.native.native, messenger: f.messenger, isCurrent: () => true }); t.after(() => foreign.dispose()); assert.equal(foreign.hubPlacementCurrent(receipt, f.scaffold.ticket, window), false);
  const count = f.native.calls.length; assert.equal(f.reader.observeHubPlacement({ scaffold: f.scaffold.ticket, windowIdentity: { ...window }, marker: { tag: 99, nativeID: 'foreign' }, isCurrent: () => true }, () => {}), null); assert.equal(f.native.calls.length, count);
});
test('retained content-only updates keep marker/native lease while geometry unknown and real native pair retirement revoke its receipt', async t => {
  const f = fixture(t); await f.ready(); const receipt = f.local.placement(), markerID = f.local.getSnapshot().markerID, calls = f.native.calls.length, ticket = f.registration().getSnapshot();
  f.native.hub.updatePrimary(ticket, { hasReplacement: true, replacement: { actual: 'count 1' } }); f.native.hub.updatePrimary(ticket, { hasReplacement: true, replacement: { actual: 'count 2 spinner' } });
  assert.equal(f.local.getSnapshot().markerID, markerID); assert.equal(f.local.placement(), receipt); assert.equal(f.native.calls.length, calls); assert.equal(f.local.getSnapshot().presentation.primary.replacementValue.actual, 'count 2 spinner');
  const pair = f.native.calls.find(value => value.kind === 'pair').result.initial; f.native.emit({ ...pair, revision: 4, frame: 9, pair: null }); assert.equal(f.local.placement(), null); assert.equal(f.reader.hubPlacementCurrent(receipt, f.scaffold.ticket, receipt.windowIdentity), false);
});
test('actual retained native ref Strict replay requires fresh marker and ACK; late original callbacks cannot adopt the new generation', async t => {
  const f = fixture(t); await f.ready(); const old = f.local.placement(), generation = f.local.getSnapshot().generation, nativeID = f.local.getSnapshot().markerID; f.local.detach(); const stop = f.local.attach(); t.after(stop);
  assert.equal(f.local.placement(), null); assert.notEqual(f.local.getSnapshot().markerID, nativeID); const calls = f.native.calls.length; f.bind(71, nativeID, generation); assert.equal(f.native.calls.length, calls);
  f.bind(); await s.flush(); assert.ok(f.local.placement()); assert.notEqual(f.local.placement(), old); assert.equal(f.reader.hubPlacementCurrent(old, f.scaffold.ticket, old.windowIdentity), false);
});
test('pending native ACK is released after cleanup and foreign ref replacement cannot retarget original local owner', async t => {
  const f = fixture(t), pending = s.deferred(), original = f.native.native.bindParts; let received;
  f.native.native.bindParts = (...args) => original(...args).then(value => { received = value; return pending.promise.then(() => value); });
  f.commit(); f.viewport(); await s.flush(); f.bind(); f.bindDock(); await s.flush(); assert.ok(received); assert.equal(f.local.placement(), null); f.local.detach(); pending.resolve(); await s.flush(); assert.equal(f.local.placement(), null); assert.ok(f.native.releases.some(value => value.handle === received.handle));
  const stop = f.local.attach(); t.after(stop); f.bind(); f.local.bindMarker({}, { tag: 71, nativeID: f.local.getSnapshot().markerID }); assert.equal(f.local.getSnapshot().retired, true); assert.equal(f.scope.readCurrent(), true);
});
test('real account/Source retirement permanently rejects old local receipt while domain scope cannot be revived', async t => {
  const f = fixture(t); await f.ready(); const receipt = f.local.placement(); f.current(false); f.scope.readCurrent(); assert.equal(f.local.getSnapshot().retired, true); assert.equal(f.local.placement(), null);
  f.current(true); f.local.attach(); f.bind(); assert.equal(f.local.placement(), null); assert.equal(f.reader.hubPlacementCurrent(receipt, f.scaffold.ticket, receipt.windowIdentity), false);
});
test('newer original native unknown event received before bind ACK never transiently publishes the obsolete initial placement', async t => {
  const f = fixture(t), pending = s.deferred(), original = f.native.native.bindParts; let receipt;
  f.native.native.bindParts = (...args) => original(...args).then(value => { receipt = value; return pending.promise.then(() => value); });
  f.commit(); f.viewport(); await s.flush(); f.bind(); f.bindDock(); await s.flush(); const seen = []; f.local.subscribe(() => seen.push(f.local.getSnapshot().receipt));
  f.native.emit({ ...receipt.initial, revision: 7, frame: 20, pair: null }); pending.resolve(); await s.flush(); assert.equal(f.local.placement(), null); assert.equal(seen.some(Boolean), false);
});
test('original callback replacing genuine dock membership during observe rejects the stale request before a native pair is issued', async t => {
  const f = fixture(t); await f.ready(); const receipt = f.local.placement(), ticket = f.registration().getSnapshot(), calls = f.native.calls.length;
  const stop = f.reader.observeHubPlacement({ scaffold: f.scaffold.ticket, windowIdentity: receipt.windowIdentity, marker: { tag: 92, nativeID: 'real-pending-marker' },
    isCurrent: () => { f.native.hub.updatePrimary(ticket, { showPrimaryFab: false }); return true; } }, () => {});
  assert.equal(stop, null); assert.equal(f.native.calls.length, calls); assert.equal(f.local.placement(), null); assert.equal(f.scope.readCurrent(), true);
});
test('reentrant newer SAME-watch pair wins over an older known or null outer sample and copied stale revisions never validate', async t => {
  const f = fixture(t); await f.ready(); const pair = f.native.calls.find(value => value.kind === 'pair').result.initial, original = f.local.placement(); let serial = 3;
  for (const kind of ['known-known', 'known-null', 'null-known']) {
    let once = true; const innerRevision = serial + 1, innerFrame = serial + 20;
    const reenter = () => { if (once) { once = false; f.native.emit({ ...pair, revision: innerRevision, frame: innerFrame, pair: kind === 'known-null' ? null : { ...pair.pair, fixed: { ...pair.pair.fixed, width: 222 } } }); } };
    const stop = kind === 'null-known' ? f.local.subscribe(reenter) : f.owner.subscribe(reenter);
    f.native.emit({ ...pair, revision: serial, frame: serial + 19, pair: kind === 'null-known' ? null : { ...pair.pair, fixed: { ...pair.pair.fixed, width: 111 } } });
    stop(); const receipt = f.local.placement();
    if (kind === 'known-null') assert.equal(receipt, null); else { assert.equal(receipt.frame.width, 222); assert.equal(receipt.nativeRevision, innerRevision); assert.equal(receipt.nativeFrame, innerFrame); }
    assert.equal(f.reader.hubPlacementCurrent(original, f.scaffold.ticket, original.windowIdentity), false); serial += 3;
  }
});

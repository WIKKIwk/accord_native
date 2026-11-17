const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminRootSheetLifecycleSupport.cjs'), a = s.authorityDomain;
function producer() {
  const source = new Set(), resource = new Set(), stops = [];
  return { source, resource, stops, value: { subscribeSource(changed) { source.add(changed); return () => { stops.push('source'); source.delete(changed); }; }, subscribeResource(changed) { resource.add(changed); return () => { stops.push('resource'); resource.delete(changed); }; } },
    sourceChange: () => { for (const changed of [...source]) changed(); }, resourceChange: () => { for (const changed of [...resource]) changed(); } };
}
const original = () => ({ presentationTicket: 'original-P', parentTicket: 'original-parent', nativeIdentity: {} });
test('issued authority/stamps retain exact originals and passive source/resource revisions never invoke producer callbacks', () => {
  const p = producer(), root = original(), authority = a.createAdminRootSheetAuthority(root, p.value); assert.ok(authority); assert.equal(a.isAdminRootSheetAuthority(authority, root), true);
  assert.equal(a.isAdminRootSheetAuthority({ ...authority }, root), false); assert.equal(a.isAdminRootSheetAuthority(new Proxy(authority, {}), root), false); assert.equal(a.isAdminRootSheetAuthority(authority, { ...root, nativeIdentity: {} }), false);
  const first = authority.capture(); assert.equal(authority.matches(first, 'all'), true); assert.equal(authority.matches({ ...first }, 'all'), false); assert.equal(authority.matches(new Proxy(first, {}), 'source'), false);
  p.resourceChange(); assert.equal(authority.matches(first, 'all'), false); assert.equal(authority.matches(first, 'source'), true);
  const next = authority.capture(); p.sourceChange(); assert.equal(authority.matches(next, 'all'), false); assert.equal(authority.matches(next, 'source'), false);
  const final = authority.capture(); p.value.subscribeSource = () => { throw Error('must never run while comparing'); }; p.value.subscribeResource = () => { throw Error('must never run while comparing'); };
  assert.equal(authority.matches(final, 'all'), true); authority.dispose(); authority.dispose(); assert.deepEqual(p.stops, ['source', 'resource']); assert.equal(authority.capture(), null); assert.equal(authority.matches(final, 'source'), false); assert.equal(a.isAdminRootSheetAuthority(authority, root), false);
});
test('actual subscriptions are mandatory; malformed/async subscription results hold unavailable and release original installed subscriptions', async () => {
  const root = original(); assert.equal(a.createAdminRootSheetAuthority(root, {}), null); assert.throws(() => new a.AdminRootSheetAuthority({}, root), /subscribed original/);
  for (const bad of [undefined, true, Promise.reject(Error('async subscription is not installed authority'))]) {
    const p = producer(); p.value.subscribeResource = () => bad; assert.equal(a.createAdminRootSheetAuthority(root, p.value), null); assert.deepEqual(p.stops, ['source']); assert.equal(p.source.size, 0);
  }
  await s.flush();
});
test('original retirement unsubscribes captured producer methods even when mutable properties change; cleanup failures are idempotent', async () => {
  const root = original(), calls = []; let sourceChanged;
  const value = { subscribeSource: changed => { sourceChanged = changed; return () => { calls.push('original-source'); throw Error('cleanup'); }; }, subscribeResource: () => () => { calls.push('original-resource'); return Promise.reject(Error('async cleanup cannot revive')); } };
  const authority = a.createAdminRootSheetAuthority(root, value), stamp = authority.capture(); value.subscribeSource = () => () => calls.push('foreign-source'); value.subscribeResource = () => () => calls.push('foreign-resource');
  authority.dispose(); authority.dispose(); sourceChanged(); await s.flush(); assert.deepEqual(calls, ['original-source', 'original-resource']); assert.equal(authority.matches(stamp, 'all'), false);
});
test('lifecycle rejects missing/copied/foreign/retired authority and cannot authorize when its original subscribed scope retires', async () => {
  for (const authority of [undefined, {}, { capture: () => ({}), matches: () => true }]) assert.throws(() => s.fixture({ authority }), /subscribed authority/);
  const f = s.fixture(); try {
    assert.throws(() => s.fixture({ authority: f.authority }), /subscribed authority/); f.shown(); const stamp = f.authority.capture(); f.authority.dispose();
    assert.equal(f.owner.canInteract(), false); assert.equal(f.owner.requestClose(), false); assert.equal(f.authority.matches(stamp, 'source'), false); assert.equal(await f.owner.closed, 'retired');
  } finally { f.cleanup(); }
});
test('authority and lifecycle capture original tuple/subscription/callback getters once before validation', () => {
  const p = producer(), root = original(); let identities = 0, sources = 0, resources = 0;
  const input = { ...root, get nativeIdentity() { identities++; return root.nativeIdentity; } }, subscriptions = { get subscribeSource() { sources++; return p.value.subscribeSource; }, get subscribeResource() { resources++; return p.value.subscribeResource; } };
  const authority = a.createAdminRootSheetAuthority(input, subscriptions); assert.ok(authority); assert.deepEqual([identities, sources, resources], [1, 1, 1]); authority.dispose();
  const f = s.fixture(); try {
    let memberReads = 0; const deps = { ...f.options, get isNativeMember() { memberReads++; return () => true; } };
    const second = new s.domain.AdminRootSheetLifecycle(deps), stop = second.attach(); assert.equal(memberReads, 1); deps.isAccountCurrent = () => false;
    assert.equal(second.readCurrent(), true); stop(); second.retire();
  } finally { f.cleanup(); }
});

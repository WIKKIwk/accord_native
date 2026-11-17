const s = require('./adminRootPresentationSupport.cjs');
const protocol = s.load('../modules/accord-admin-presentation/src/AccordAdminOwnedSheet', { expo: {} });
const guards = s.load('shared/profileSessionGuard');
const authorityDomain = s.load('admin/AdminRootSheetAuthority');
const domain = s.load('admin/adminRootSheetLifecycle', { '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet': protocol,
  '../shared/profileSessionGuard': guards, './adminPresentationWindowTicket': s.tickets, './AdminRootSheetAuthority': authorityDomain });
function fixture(overrides = {}) {
  const source = new Set(), resource = new Set(), notifySource = () => { for (const changed of [...source]) changed(); }, notifyResource = () => { for (const changed of [...resource]) changed(); };
  const facts = new Proxy({ account: true, source: true, native: true, parent: true, noChildren: true }, { set(target, key, value) { const old = target[key]; target[key] = value; if (!Object.is(old, value)) (['native', 'parent'].includes(key) ? notifyResource : notifySource)(); return true; } });
  const reserved = new class extends Set { add(value) { const had = this.has(value); super.add(value); if (!had) notifySource(); return this; } delete(value) { const removed = super.delete(value); if (removed) notifySource(); return removed; } clear() { const changed = this.size > 0; super.clear(); if (changed) notifySource(); } }();
  const leases = [], identity = {}; let sequence = 0, onCancel = lease => leases.push(lease);
  const read = key => typeof facts[key] === 'function' ? facts[key]() : facts[key];
  const options = { presentationTicket: 'original-sheet', parentTicket: 'original-parent', nativeIdentity: identity,
    isAccountCurrent: () => read('account'), isSourceCurrent: () => read('source'), isNativeMember: () => read('native'),
    isOriginalParentCurrent: () => read('parent'), hasNoDescendants: () => read('noChildren'), isReservedDescendantCurrent: value => reserved.has(value), onNativeCancel: lease => onCancel(lease), ...overrides };
  const producer = { subscribeSource: changed => { source.add(changed); return () => source.delete(changed); }, subscribeResource: changed => { resource.add(changed); return () => resource.delete(changed); } };
  const authority = authorityDomain.createAdminRootSheetAuthority(options, producer);
  if (!Object.hasOwn(overrides, 'authority')) options.authority = authority;
  const owner = new domain.AdminRootSheetLifecycle(options), stop = owner.attach();
  const wire = (kind, extra = {}) => ({ protocol: 1, kind, sequence: ++sequence, presentationTicket: options.presentationTicket, parentTicket: options.parentTicket,
    transaction: null, acceptedClose: null, reason: null, ...extra });
  const event = (kind, extra = {}) => owner.receive(identity, wire(kind, extra));
  return { ...s, domain, authority, producer, sourceListeners: source, resourceListeners: resource, notifySource, notifyResource, owner, stop, options, identity, facts, reserved, leases, wire, event, onCancel: fn => { onCancel = fn; }, shown: () => event('shown'), cleanup: () => { stop(); owner.retire(); authority.dispose(); } };
}
module.exports = { ...s, rootFixture: s.fixture, protocol, guards, authorityDomain, domain, fixture };

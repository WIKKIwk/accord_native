/* global __dirname */
const path = require('node:path'), s = require('./adminTopNoticeSupport.cjs'), view = require('./adminSupplierDetailViewSupport.cjs');
function bridge(native) {
  return view.compile(path.resolve(__dirname, '../modules/accord-admin-layout/src/AccordAdminScaffoldLayout.ts'), { expo: { NativeModule: class {}, requireOptionalNativeModule: () => native } });
}
const protocol = bridge(null);
const viewport = patch => ({ rect: { x: 0, y: 0, width: 400, height: 800 }, rawImeBottom: 0, viewPaddingBottom: 24, systemGestureBottom: 16, safeTop: 30, safeLeft: 11, safeRight: 23, ...patch });
const event = (kind, handle, ticket, patch = {}) => ({ protocol: 1, guarantee: 'original-window-layout-snapshot', platform: 'android', kind, handle, ticket, windowID: 'window-original',
  viewportHandle: kind === 'viewport' ? handle : 'viewport-1', revision: 1, frame: 1, retired: false, viewport: kind === 'viewport' ? viewport() : null,
  dock: kind === 'dock' ? { viewport: viewport(), dockHeight: 547 / 2.75 } : null,
  pair: kind === 'pair' ? { viewport: viewport(), fixed: { x: 0, y: 0, width: 400, height: 500 }, dockHeight: 547 / 2.75 } : null, ...patch });
const receipt = (kind, ticket, patch = {}) => { const initial = event(kind, `${kind}-1`, ticket, patch); return { handle: initial.handle, ticket, windowID: initial.windowID, initial }; };
function fixture(options = {}) {
  const source = s.fixture(); source.mount(); const calls = [], releases = [], cancellations = [], listeners = new Set(), pending = [], emitted = [];
  let original = true, page = true, fixed = true, serial = 0, frame = 0;
  const native = { capability: { protocol: 1, guarantee: 'original-window-layout-snapshot', platform: 'android', rawIme: true },
    bindViewport: (marker, ticket) => dispatch('viewport', ticket, [marker]), bindDock: (owner, marker, ticket) => dispatch('dock', ticket, [owner, marker]),
    bindParts: (owner, dock, host, ticket) => dispatch('pair', ticket, [owner, dock, host]),
    release: async value => { releases.push(value); return true; }, cancelTicket: async value => { cancellations.push(value); return true; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  function dispatch(kind, ticket, args) {
    const item = { kind, ticket, args, result: null, deferred: s.deferred() }; calls.push(item); pending.push(item);
    const parent = kind === 'viewport' ? null : args[0], initial = event(kind, `${kind}-${++serial}`, ticket, { frame: ++frame,
      ...(parent ? { viewportHandle: parent.handle, windowID: parent.windowID } : {}) });
    item.result = { handle: initial.handle, ticket, windowID: initial.windowID, initial };
    if (options.pending !== true) item.deferred.resolve(item.result); return item.deferred.promise;
  }
  const exports = s.load('admin/adminFixedSnackBarReader', { '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout': protocol,
    '../shared/camera/synchronousGuard': s.strict, './adminPresentationWindowTicket': { createAdminPresentationWindowTicket: () => `unique-test-ticket-${++serial}` } });
  const owner = new exports.AdminFixedSnackBarReaderOwner({ observer: native, messenger: source.target, isCurrent: () => original });
  const register = (marker = { tag: 1, nativeID: 'source-viewport' }) => owner.registerScaffold({ scaffold: source.scaffold, viewportMarker: marker, isCurrent: () => page });
  const pair = receive => owner.reader.observe({ identity: {}, nativeID: 'fixed-marker', nativeTag: 3, scaffold: source.scaffold, sourceLayout: { metrics: null, hostHeight: null }, isCurrent: () => fixed }, receive ?? (value => emitted.push(value)));
  const emit = value => { for (const listener of [...listeners]) listener(value); };
  return { ...source, ...exports, owner, native, calls, releases, cancellations, pending, listeners, emitted, register, pair, emit,
    original: value => { original = value; }, page: value => { page = value; }, fixed: value => { fixed = value; },
    settle: index => { const item = calls[index]; item.deferred.resolve(item.result); }, cleanup: () => { owner.dispose(); source.target.retire(); } };
}
module.exports = { ...s, protocol, bridge, viewport, event, receipt, fixture };

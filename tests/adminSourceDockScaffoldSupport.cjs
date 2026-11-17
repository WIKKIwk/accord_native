const native = require('./adminScaffoldLayoutSupport.cjs');
const views = require('./adminSupplierDetailViewSupport.cjs');
const dock = native.load('admin/adminDockModel', { '../shared/appRoutes': native.routes, '../shared/localization': native.l10n });
const hubModel = native.load('admin/adminCreateHubModel', { './adminDockModel': dock, '../shared/camera/synchronousGuard': native.strict });
const shell = native.load('admin/adminShellLayoutPolicy');
const policy = native.load('admin/adminSourceDockScaffoldPolicy', { './adminCreateHubModel': hubModel, './adminShellLayoutPolicy': shell });
const hubDomain = native.load('admin/adminCreateHubController', { '../shared/camera/synchronousGuard': native.strict });
const primaryDomain = native.load('admin/AdminSourcePrimaryRegistrationOwner', { '../shared/camera/synchronousGuard': native.strict, '../shared/profileSessionGuard': native.load('shared/profileSessionGuard') });
let serial = 0;
const domain = native.load('admin/AdminSourceDockScaffoldOwner', { '../shared/camera/synchronousGuard': native.strict, './adminSourceDockScaffoldPolicy': policy,
  './AdminSourcePrimaryRegistrationOwner': primaryDomain, './adminPresentationWindowTicket': { createAdminPresentationWindowTicket: () => `source-dock-test-${++serial}` } });
function fixture(options = {}) {
  const source = native.fixture(options); let current = true, focused = true, top = true, available = true, host = true, overlayTop = false, own = true;
  const hub = new hubDomain.AdminCreateHubController({ isCurrent: () => current,
    readiness: () => ({ ready: available, missingRoutes: available ? [] : ['/actual'], hasPrimary: true }),
    actions: () => [{ id: 'actual', label: 'Actual fixture action', routeName: '/actual', staggerOrder: 0 }], routeAvailable: () => true, openRoute() {}, nextFrame: () => () => {} }); hub.start();
  const ticket = hub.register({ isCurrent: () => own, isFocused: () => focused, canInteract: () => top });
  const props = { identity: {}, reader: source.owner, scaffold: { messenger: source.target, ticket: source.scaffold }, sourceScaffoldAncestor: null,
    isCurrent: () => current, canInteract: () => typeof top === 'function' ? top() : top, primaryTicket: ticket, thinGestureBottom: true,
    nativeScene: { type: 'ActualCompleteNativeSceneFixture', props: {} }, outlet: { type: 'ActualNativeOutletFixture', props: {} }, renderDock: () => ({ type: 'ActualDockFixture', props: {} }),
    hubNativeHost: { identity: {}, isAvailable: request => typeof host === 'function' ? host(request) : host, ownsOverlayTop: () => overlayTop,
      renderPrimary: request => ({ type: 'ActualPrimaryFixture', props: { request } }), renderOverlay: request => ({ type: 'ActualOverlayFixture', props: { request } }) } };
  const owner = new domain.AdminSourceDockScaffoldOwner(props, hub); owner.start(); owner.source(ticket, true);
  const viewport = () => owner.bindViewport({ tag: 11, nativeID: owner.viewportID });
  const bindDock = () => { const target = owner.getSnapshot().target; owner.bindDock({ tag: 12, nativeID: target.nativeID }, target); return target; };
  const ready = async () => { viewport(); await native.flush(); bindDock(); await native.flush(); };
  return { ...source, hub, ticket, props, scaffoldOwner: owner, viewport, bindDock, ready,
    current: value => { current = value; }, focus: value => { focused = value; }, top: value => { top = value; }, host: value => { host = value; }, overlayTop: value => { overlayTop = value; },
    available: value => { available = value; hub.refreshLocale(); }, own: value => { own = value; }, cleanup: () => { owner.detach(); hub.dispose(); source.cleanup(); } };
}
module.exports = { ...native, views, policy, domain, hubDomain, primaryDomain, fixture };

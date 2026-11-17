/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
const { nodes } = require('./adminSupplierDetailViewSupport.cjs');
function content(platform) {
  const mocks = { '../shared/appRoutes': s.routes, './dartJsonString': s.strings };
  for (const name of ['AdminCustomerDetailWithAssignments', 'AdminOwnedProfileContent', 'AdminOwnedUsersFallback', 'AdminProfileAvatar', 'AdminSupplierDetailRoute', 'AdminSupplierItemsScreen', 'AdminWerkaRoute', 'AdminWorkerDetailScreen', 'AdminWorkerProfileScreen']) mocks[`./${name}.${platform}`] = { [name]: name };
  const component = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedRouteContent.${platform}.tsx`), mocks);
  const opens = [], backs = [], chats = [], current = () => true, interactive = () => true;
  const props = { session: { token: 'original' }, witness: {}, isCurrent: current, canInteract: interactive, profileAction: { type: 'RealProfile' }, footer: { type: 'RealDock' }, backLabel: 'Back',
    onBack: value => backs.push(value), onLogout() {}, onNotice() {}, open: async target => { opens.push(target); return true; },
    providers: { primaryAvailable: () => true, renderPrimaryAction: () => ({ type: 'RealPrimary' }), renderChatAction: value => { chats.push(value); return { type: 'RealChat' }; } } };
  const user = kind => { const item = s.model.adminUserListEntryFromJson({ id: ' raw ref ', name: 'Original name', principal_role: kind === 'worker' ? 'aparatchi' : kind, source: kind });
    return { item, entry: { target: { kind: 'user', ticket: { item, routeName: s.model.adminUserDetailRoute(item) } }, routeName: s.model.adminUserDetailRoute(item) } }; };
  return { props, opens, backs, chats, user, render: entry => component.AdminOwnedRouteContent({ ...props, entry }) };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} source AppRouter four branches preserve exact DTO identity/ref normalization and genuine child ownership`, () => {
    const f = content(platform);
    for (const [kind, expected] of [['werka', 'AdminWerkaRoute'], ['customer', 'AdminCustomerDetailWithAssignments'], ['material_taminotchi', 'AdminCustomerDetailWithAssignments'], ['supplier', 'AdminSupplierDetailRoute'], ['worker', 'AdminWorkerDetailScreen'], ['metalayzer', 'AdminWorkerDetailScreen']]) {
      const { item, entry } = f.user(kind), tree = f.render(entry); assert.equal(tree.type, expected); assert.equal(tree.props.session, f.props.session); assert.equal(tree.props.witness, f.props.witness);
      assert.equal(tree.props.isCurrent, f.props.isCurrent); assert.equal(tree.props.canInteract, f.props.canInteract); assert.equal(tree.props.profileAction, f.props.profileAction); assert.equal(tree.props.footer, f.props.footer);
      if (kind === 'customer' || kind === 'material_taminotchi') { assert.equal(tree.props.customerRef, 'raw ref'); assert.equal(tree.props.entry, item); }
      if (kind === 'supplier') assert.equal(tree.props.supplierRef, 'raw ref'); if (kind === 'worker' || kind === 'metalayzer') assert.equal(tree.props.entry, item);
      if (tree.props.renderAvatar) { const original = { avatarUrl: 'real url', fallbackText: 'ON', displayName: 'ON', size: 92, isCurrent: f.props.isCurrent, canInteract: f.props.canInteract }, avatar = tree.props.renderAvatar(original);
        assert.equal(avatar.type, 'AdminProfileAvatar'); assert.equal(avatar.props.session, f.props.session); assert.equal(avatar.props.witness, f.props.witness); assert.equal(avatar.props.avatarUrl, 'real url'); assert.equal(avatar.props.isCurrent, original.isCurrent); }
    }
  });
  test(`${platform} Supplier Items and Worker Activity use actual child targets and never invent parent reload on awaited return`, async () => {
    const f = content(platform), supplier = f.render(f.user('supplier').entry), worker = f.user('worker'), detail = f.render(worker.entry);
    await supplier.props.onViewItems(' raw widget ref '); await supplier.props.onAddItem(' raw widget ref '); await detail.props.onOpenActivity(worker.item);
    assert.deepEqual(f.opens, [{ kind: 'supplier-items', mode: 'view', supplierRef: ' raw widget ref ' }, { kind: 'supplier-items', mode: 'add', supplierRef: ' raw widget ref ' }, { kind: 'worker-profile', entry: worker.item }]);
    const view = f.render({ target: f.opens[0] }), add = f.render({ target: f.opens[1] }), profile = f.render({ target: f.opens[2] });
    assert.equal(view.type, 'AdminSupplierItemsScreen'); assert.equal(view.props.mode, 'view'); assert.equal(view.props.supplierRef, ' raw widget ref '); assert.equal(add.props.mode, 'add');
    assert.equal(profile.type, 'AdminWorkerProfileScreen'); assert.equal(profile.props.entry, worker.item); view.props.onBack(true); profile.props.onBack(true); assert.deepEqual(f.backs, [false, false]);
  });
  test(`${platform} optional real chat renderer is absent by default and Worker gets only its actual child read/interaction guards`, () => {
    const f = content(platform), worker = f.user('worker'), detail = f.render(worker.entry); assert.equal(f.chats.length, 0);
    const read = () => true, interact = () => false; assert.equal(detail.props.renderChatAction(read, interact).type, 'RealChat'); assert.equal(f.chats[0].entry, worker.item); assert.equal(f.chats[0].isCurrent, read); assert.equal(f.chats[0].canInteract, interact);
    delete f.props.providers.renderChatAction; assert.equal(f.render(worker.entry).props.renderChatAction, undefined); assert.equal(f.render(f.user('supplier').entry).props.chatAction, undefined);
  });
  test(`${platform} source empty Customer/Supplier refs mount genuine Users fallback before any detail/chat renderer`, () => {
    const f = content(platform);
    for (const kind of ['customer', 'supplier']) { const { item, entry } = f.user(kind), fallback = f.render({ ...entry, target: { kind: 'user', ticket: { ...entry.target.ticket, item: { ...item, id: ' \t ' } } } });
      assert.equal(fallback.type, 'AdminOwnedUsersFallback'); assert.equal(fallback.props.isCurrent, f.props.isCurrent); fallback.props.onBack(); }
    assert.deepEqual(f.chats, []); assert.deepEqual(f.backs, [false, false]);
  });
  test(`${platform} real route page holds absent providers and only composes admitted current children with authentic profile/dock/primary callbacks`, () => {
    const f = content(platform), { entry } = f.user('werka'); let valid = true, ready = false, admitted = true, providers = null; const actions = [];
    const page = { context: { current: () => valid, ready: () => ready, get providers() { return providers; } }, entry, current: () => valid, interactive: () => valid,
      get admitted() { return admitted; }, registerBack: () => () => {}, open: async target => actions.push(target), back: value => actions.push(['back', value]) };
    const shell = { session: f.props.session, witness: f.props.witness, onLogout: () => actions.push('logout') }, primary = [];
    const mocks = { 'expo-router': { Redirect: 'Redirect' }, react: { useSyncExternalStore: (_s, get) => get() }, 'react-native': { View: 'View', StyleSheet: { create: value => value } },
      '../shared/appRoutes': s.routes, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminActivityBackLabel': { adminActivityBackLabel: () => 'Back' },
      './AdminOwnedBackContext': { AdminOwnedBackProvider: 'ActualBackProvider' }, [`./AdminOwnedDock.${platform}`]: { AdminOwnedDock: 'ActualDock' },
      [`./AdminOwnedRouteContent.${platform}`]: { AdminOwnedRouteContent: 'ActualContent' }, [`./AdminOwnedRouteNotice.${platform}`]: { AdminOwnedRouteNotice: 'ActualNotice' },
      [`./AdminProfileAction.${platform}`]: { AdminProfileAction: 'ActualProfileAction' }, './AdminShellContext': { useAdminShell: () => shell },
      './useAdminOwnedPage': { useAdminOwnedPage: () => page }, './useAdminOwnedNotice': { useAdminOwnedNotice: () => ({ show() {}, notice: null }) } };
    const { AdminOwnedRoutePage } = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedRoutePage.${platform}.tsx`), mocks);
    assert.equal(AdminOwnedRoutePage().props.href, `/${platform}-admin`); ready = true; assert.equal(AdminOwnedRoutePage().type, 'Redirect');
    providers = { primaryAvailable: () => true, renderPrimaryAction: authority => { primary.push(authority); return { type: 'GenuinePrimary' }; } }; admitted = false; assert.equal(AdminOwnedRoutePage(), null);
    admitted = true; const tree = AdminOwnedRoutePage(), body = nodes(tree, node => node.type === 'ActualContent')[0]; assert.equal(tree.type, 'ActualBackProvider');
    assert.equal(body.props.profileAction.type, 'ActualProfileAction'); assert.equal(body.props.footer.type, 'ActualDock'); assert.equal(body.props.footer.props.active, 'settings'); assert.equal(primary[0].isCurrent, page.current);
    body.props.profileAction.props.onProfile(); assert.deepEqual(actions[0], { kind: 'profile' }); body.props.onLogout(); assert.equal(actions.at(-1), 'logout'); valid = false; body.props.onLogout(); assert.equal(actions.length, 2); assert.equal(AdminOwnedRoutePage(), null);
  });
  test(`${platform} missing-ref Users fallback mounts the actual list owner with controller-issued navigation lifetime`, async () => {
    const r = s.runtime(), requests = [], current = () => true, interactive = () => true, inner = () => true;
    const owner = { registry: { open: async (target, parent) => { requests.push({ target, parent }); return true; } } };
    const shared = s.load('admin/useAdminUsersOwnedOpen', { react: r.react, '../shared/camera/synchronousGuard': s.strict, './AdminOwnedNavigationContext': { useAdminOwnedNavigation: () => ({ owner }) } });
    const { AdminOwnedUsersFallback } = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedUsersFallback.${platform}.tsx`), { [`./AdminUsersRoute.${platform}`]: { AdminUsersRoute: 'ActualUsersRoute' }, './useAdminUsersOwnedOpen': shared });
    const tree = r.render(() => AdminOwnedUsersFallback({ isCurrent: current, canInteract: interactive, onBack() {}, profileAction: 'RealProfile', footer: 'RealDock' }));
    assert.equal(tree.type, 'ActualUsersRoute'); const ticket = { item: s.entry('X'), routeName: s.routes.appRoutes.adminSupplierDetail }; assert.equal(await tree.props.onOpenUser(ticket, { isCurrent: inner, canInteract: inner }), true);
    assert.equal(requests[0].target.ticket, ticket); assert.equal(requests[0].parent.isCurrent(), true); assert.equal(requests[0].parent.canInteract(), true); r.unmount();
  });
  test(`${platform} actual Users file-page composes the original witness, real profile callback and absolute genuine dock only after source readiness`, () => {
    let ready = false, valid = true; const actions = [], primary = [], current = () => valid, interactive = () => valid,
      providers = { primaryAvailable: () => true, renderPrimaryAction: authority => { primary.push(authority); return { type: 'ActualPrimaryRegistration' }; } },
      page = { context: { current, ready: () => ready, providers }, current, interactive, admitted: true, back() {}, openProfile: () => actions.push('profile'), openUser() {} },
      shell = { session: {}, witness: {} };
    const { AdminUsersPage } = s.compile(path.resolve(__dirname, `../src/admin/AdminUsersPage.${platform}.tsx`), {
      'expo-router': { Redirect: 'Redirect' }, react: { useSyncExternalStore: (_subscribe, get) => get() }, 'react-native': { View: 'View', StyleSheet: { create: value => value } },
      '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminActivityBackLabel': { adminActivityBackLabel: () => 'Back' },
      [`./AdminOwnedDock.${platform}`]: { AdminOwnedDock: 'ActualDock' }, [`./AdminProfileAction.${platform}`]: { AdminProfileAction: 'ActualProfileAction' },
      './AdminShellContext': { useAdminShell: () => shell }, [`./AdminUsersRoute.${platform}`]: { AdminUsersRoute: 'ActualUsersRoute' }, './useAdminUsersPage': { useAdminUsersPage: () => page },
    });
    assert.equal(AdminUsersPage().props.href, `/${platform}-admin`); assert.equal(primary.length, 0); ready = true;
    const tree = AdminUsersPage(), list = nodes(tree, node => node.type === 'ActualUsersRoute')[0]; assert.equal(list.props.witness, shell.witness); assert.equal(list.props.isCurrent, current); assert.equal(list.props.canInteract, interactive); assert.equal(list.props.onOpenUser, page.openUser);
    assert.equal(list.props.footer.props.style.position, 'absolute'); assert.equal(list.props.footer.props.children.props.active, 'user'); list.props.profileAction.props.onProfile(); assert.deepEqual(actions, ['profile']); assert.equal(primary[0].isCurrent, current);
    valid = false; assert.equal(AdminUsersPage(), null);
  });
  test(`${platform} owned Profile uses the genuine existing Profile owner, guarded source Back and no direct logout replacement`, () => {
    const calls = [], current = () => true; let interactive = true;
    const { AdminOwnedProfileContent } = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedProfileContent.${platform}.tsx`), {
      react: { useSyncExternalStore: (_subscribe, get) => get() }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
      'react-native': { View: 'View', StyleSheet: { create: value => value }, PlatformColor: value => value }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24 }) },
      '../components/ProfileScreen': { ProfileScreen: 'ActualProfileScreen' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surfaceContainerHigh: '#ddd' } }) },
      '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
      './AdminProfileHeader.android': { AdminProfileHeader: 'AdminProfileHeader' }, './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(),
      '@expo/ui/swift-ui': { Button: 'Button' }, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) }), '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    });
    const props = { session: { profile: { role: 'admin' } }, isCurrent: current, canInteract: () => interactive, onBack: value => calls.push(value), onLogout: () => calls.push('logout'), footer: { type: 'ActualDock' }, backLabel: 'Back' }, tree = AdminOwnedProfileContent(props), profile = nodes(tree, node => node.type === 'ActualProfileScreen')[0];
    assert.equal(profile.props.session, props.session); assert.equal(profile.props.isCurrent, current); assert.equal(profile.props.onLogout, props.onLogout); assert.equal(profile.props.showDirectLogout, false); assert.equal(profile.props.settingsDisabled, true); assert.equal(profile.props.settingsUnavailableMessage, undefined);
    const brigader = AdminOwnedProfileContent({ ...props, session: { profile: { role: 'brigader' } } });
    assert.equal(nodes(brigader, node => node.type === 'ActualProfileScreen')[0].props.settingsDisabled, false);
    const back = platform === 'android' ? nodes(tree, node => node.type === 'AdminProfileHeader')[0].props.onBack : nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerLeft().props.children.props.onPress;
    interactive = false; back(); assert.deepEqual(calls, []); interactive = true; back(); assert.deepEqual(calls, [false]); assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.position === 'absolute').length);
  });
}

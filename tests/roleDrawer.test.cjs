const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${id}.ts`)), mocks);
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const { selectRoleDrawerItem } = load('shared/navigation/roleDrawerModel.ts');
const { workerDrawerItems } = load('components/workerDrawerModel.ts');
const preparation = load('preparation/preparationDrawerModel.ts');

test('one drawer dispatches role-specific IDs after closing, without importing a role router', () => {
  const calls = [];
  const props = { active: 'home', onClose: () => calls.push('close'), onSelect: id => calls.push(id) };
  selectRoleDrawerItem({ id: 'daily', label: 'Kunlik ish' }, props);
  selectRoleDrawerItem({ id: 'formulas', label: 'Formulalar' }, props);
  assert.deepEqual(calls, ['close', 'daily', 'close', 'formulas']);
});

test('disabled items do nothing and the selected destination closes without navigating again', () => {
  const calls = [];
  const props = { active: 'home', onClose: () => calls.push('close'), onSelect: id => calls.push(id) };
  selectRoleDrawerItem({ id: 'chat', label: 'Chat', disabled: true }, props);
  assert.deepEqual(calls, []);
  selectRoleDrawerItem({ id: 'home', label: 'Tayyorlov' }, props);
  assert.deepEqual(calls, ['close']);
});

test('worker configuration keeps its order, transfer permission and account-specific profile text', () => {
  const first = workerDrawerItems('First worker', true);
  const second = workerDrawerItems('Second worker', false);
  assert.deepEqual(first.map(item => item.id), ['queue', 'daily', 'instructions', 'transfer', 'profile']);
  assert.deepEqual(second.map(item => item.id), ['queue', 'daily', 'instructions', 'profile']);
  assert.equal(first.at(-1).supportingText, 'First worker');
  assert.equal(second.at(-1).supportingText, 'Second worker');
  assert.equal(workerDrawerItems('', false).at(-1).supportingText, undefined);
});

test('preparation keeps the V2 destination order and capability-dependent entries on both platforms', () => {
  const items = preparation.preparationDrawerItems({ scale: true, inventory: true }, text => text);
  assert.deepEqual(items.map(item => item.label), ['Tayyorlov', 'Formulalar', 'Ishlab chiqarish', 'Ketma-ketlik', 'Kirim', 'Chat', 'Ishlab chiqarilgan homashyolar', 'Profil']);
  assert.equal(items.find(item => item.id === 'chat').disabled, undefined);
  assert.ok(items.every(item => item.symbol.ios && item.symbol.android));
  const limited = preparation.preparationDrawerItems({ scale: false, inventory: false }, text => `translated:${text}`);
  assert.deepEqual(limited.map(item => item.id), ['home', 'formulas', 'production', 'sequence', 'chat', 'profile']);
  assert.ok(limited.every(item => item.label.startsWith('translated:')));
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: preparation preserves pushed screens, root destinations, tab switching and active state`, () => {
    const base = `/${platform}-preparation`;
    assert.deepEqual(preparation.preparationDrawerRoute('home', platform), { path: base, kind: 'root' });
    assert.deepEqual(preparation.preparationDrawerRoute('formulas', platform), { path: `${base}/${platform === 'ios' ? 'catalog' : 'formulas'}`, kind: 'root' });
    for (const id of ['sequence', 'inventory']) {
      assert.deepEqual(preparation.preparationDrawerRoute(id, platform), { path: `${base}/${id}`, kind: 'push' });
    }
    assert.deepEqual(preparation.preparationDrawerRoute('profile', platform), { path: `${base}/profile`, kind: 'tab' });
    assert.deepEqual(preparation.preparationDrawerRoute('chat', platform), { path: platform === 'ios' ? `${base}/chat` : '/android-chat', kind: platform === 'ios' ? 'tab' : 'push' });
    for (const id of ['scale', 'logout', 'unknown']) assert.equal(preparation.preparationDrawerRoute(id, platform), null);
    assert.equal(preparation.preparationDrawerActive(base), 'home');
    assert.equal(preparation.preparationDrawerActive(`${base}/profile`), 'profile');
    assert.equal(preparation.preparationDrawerActive(`${base}/production-batch`), 'production');
    assert.equal(preparation.preparationDrawerActive(`${base}/warehouse`), '');
  });
}

function nativeDrawerHarness(platform, visible = true) {
  const effects = [], calls = [], removals = [];
  const ui = new Proxy({}, { get: (_, name) => name === 'useMaterialColors' ? () => ({ onSurface: 'text' }) : name });
  const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) });
  const props = { visible, onOpen: () => calls.push('open'), onClose: () => calls.push('close'), onSelect: id => calls.push(id),
    title: 'Another role', closeAccessibilityLabel: 'Close this drawer', active: 'first', children: 'role content',
    items: [{ id: 'first', label: 'Current' }, { id: 'second', label: 'Next' }, { id: 'disabled', label: 'Unavailable', disabled: true }] };
  const api = load(`shared/navigation/RoleDrawer.${platform}.tsx`, {
    '@expo/ui': ui, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' },
    react: { useState: value => [value, () => {}], useEffect: setup => effects.push(setup) },
    'react-native': { Platform: { Version: 26 }, PlatformColor: (...semantic) => ({ semantic }), StyleSheet: { create: styles => styles }, useColorScheme: () => 'light',
      useWindowDimensions: () => ({ width: 400 }), View: 'View', Text: 'NativeText', ScrollView: 'NativeScrollView',
      BackHandler: { addEventListener: (name, handler) => { calls.push({ name, handler }); return { remove: () => removals.push(name) }; } } },
    'react-native-drawer-layout': { Drawer: 'Drawer' },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, useAnimatedStyle: () => ({}) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 12 }) },
    './roleDrawerContext': { RoleDrawerContext: { Provider: 'DrawerContext' } },
  });
  return { render: overrides => api.RoleDrawer({ ...props, ...overrides }), calls, effects, removals };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: native shell presents caller content and optional footer without worker-specific entries`, () => {
    const h = nativeDrawerHarness(platform);
    const tree = h.render();
    const drawer = nodes(tree, 'Drawer')[0];
    assert.equal(drawer.props.open, true);
    assert.equal(drawer.props.overlayAccessibilityLabel, 'Close this drawer');
    if (platform === 'ios') {
      assert.deepEqual(drawer.props.style.backgroundColor, { semantic: ['systemBackground'] });
      assert.deepEqual(drawer.props.drawerStyle.backgroundColor, { semantic: ['systemBackground'] });
    }
    drawer.props.onOpen(); drawer.props.onClose();
    assert.deepEqual(h.calls, ['open', 'close']);
    h.calls.length = 0;
    const content = drawer.props.renderDrawerContent();
    const rows = nodes(content, 'ListItem');
    assert.equal(rows.length, 3);
    rows[1].props.onPress();
    assert.deepEqual(h.calls, ['close', 'second']);
    rows[2].props.onPress?.();
    assert.deepEqual(h.calls, ['close', 'second']);
    assert.equal(nodes(content, 'Button').length, 0);
    const withFooter = nodes(h.render({ footerAction: { id: 'finish', label: 'Finish' } }), 'Drawer')[0];
    const footer = nodes(withFooter.props.renderDrawerContent(), 'Button')[0].props;
    (footer.onPress ?? footer.onClick)();
    assert.deepEqual(h.calls.slice(-2), ['close', 'finish']);
    const context = nodes(tree, 'DrawerContext')[0].props.value;
    context.open(); context.close();
    assert.deepEqual(h.calls.slice(-2), ['open', 'close']);
  });
}

test('Android Back closes an open drawer, cleans up its listener and leaves closed screens alone', () => {
  const open = nativeDrawerHarness('android');
  open.render();
  const cleanup = open.effects[0]();
  const event = open.calls[0];
  assert.equal(event.name, 'hardwareBackPress');
  assert.equal(event.handler(), true);
  assert.equal(open.calls[1], 'close');
  cleanup();
  assert.deepEqual(open.removals, ['hardwareBackPress']);
  const closed = nativeDrawerHarness('android', false);
  closed.render(); closed.effects[0]();
  assert.deepEqual(closed.calls, []);
});

test('drawer logout waits for the V2 confirmation instead of ending the session on tap', () => {
  let alert, logouts = 0;
  const { confirmRoleDrawerLogout } = load('shared/navigation/roleDrawerLogout.ts', {
    'react-native': { Alert: { alert: (...args) => { alert = args; } } },
    '../localization': { localizedGetter: key => ({ logoutTitle: 'Chiqish', logoutPrompt: 'Dasturdan chiqaymi?', no: 'Yo‘q', yes: 'Ha' })[key] },
    '../localization/runtime': { localeController: { locale: 'uz' } },
  });
  confirmRoleDrawerLogout(() => logouts++);
  assert.equal(logouts, 0);
  assert.deepEqual(alert.slice(0, 2), ['Chiqish', 'Dasturdan chiqaymi?']);
  assert.equal(alert[2][0].text, 'Yo‘q');
  assert.equal(alert[2][0].style, 'cancel');
  assert.equal(alert[2][0].onPress, undefined);
  assert.equal(alert[3].cancelable, true);
  alert[2][1].onPress();
  assert.equal(logouts, 1);
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: preparation connects the shared shell to its real navigation and scale context`, () => {
    const calls = [];
    const session = { capabilities: ['gscale'] };
    const api = load(`preparation/PreparationDrawer.${platform}.tsx`, {
      'expo-router': { usePathname: () => `/${platform}-preparation`, router: {
        push: path => calls.push(['push', path]), navigate: path => calls.push(['tab', path]),
        dismissTo: path => calls.push(['root', path]), replace: path => calls.push(['root', path]),
      } },
      '../shared/appRoutes': { appRoutes: { gscaleMode: 'gscale', inventoryMovements: 'inventory' },
        canOpenRoute: (current, capability) => current.capabilities.includes(capability) },
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'SharedRoleDrawer' },
      '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ visible: false, onOpen() {}, onClose() {} }) },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: onLogout => calls.push(['confirm', onLogout]) },
      [platform === 'ios' ? './PreparationContext' : './PreparationContext.android']: {
        usePreparationContext: () => ({ session, home: { warehouse: 'Assigned' }, onLogout: () => calls.push(['logout']) }),
      },
      [platform === 'ios' ? './PreparationUI' : './PreparationUI.android']: { usePreparationText: () => text => text },
      [platform === 'ios' ? './PreparationRoutes' : './preparationNavigation.android']: {
        openPreparationScale: args => calls.push(['scale', args]),
      },
    });
    const tree = api.PreparationDrawer({ children: 'role screens' });
    assert.equal(tree.type, 'SharedRoleDrawer');
    assert.equal(tree.props.title, 'Tayyorlov bo‘limlari');
    assert.equal(tree.props.children, 'role screens');
    assert.equal(tree.props.items.some(item => item.id === 'inventory'), false);
    tree.props.onSelect('sequence');
    tree.props.onSelect('formulas');
    tree.props.onSelect('profile');
    tree.props.onSelect('scale');
    tree.props.onSelect('chat');
    assert.deepEqual(calls, [
      ['push', `/${platform}-preparation/sequence`],
      ['root', `/${platform}-preparation/${platform === 'ios' ? 'catalog' : 'formulas'}`],
      ['tab', `/${platform}-preparation/profile`], ['scale', { warehouse: 'Assigned' }],
      [platform === 'ios' ? 'tab' : 'push', platform === 'ios' ? '/ios-preparation/chat' : '/android-chat'],
    ]);
    tree.props.onSelect('logout');
    assert.equal(calls.at(-1)[0], 'confirm');
    calls.at(-1)[1]();
    assert.deepEqual(calls.at(-1), ['logout']);
  });

  test(`${platform}: existing worker callers now use the shared shell and keep their selection callbacks`, () => {
    const calls = [];
    const api = load(`components/WorkerDrawer.${platform}.tsx`, {
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'SharedRoleDrawer' },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: callback => calls.push(callback) },
    });
    const tree = api.WorkerDrawer({ visible: true, onOpen() {}, onClose() {}, onSelect: id => calls.push(id),
      displayName: 'Worker', canTransfer: true, active: 'queue', children: 'worker screens' });
    assert.equal(tree.type, 'SharedRoleDrawer');
    assert.equal(tree.props.children, 'worker screens');
    tree.props.onSelect('daily');
    assert.deepEqual(calls, ['daily']);
    tree.props.onSelect('logout');
    assert.equal(typeof calls[1], 'function');
    calls[1]();
    assert.equal(calls[2], 'logout');
  });
}

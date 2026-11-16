const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function fixture({ platform = 'android', allowed = true, current = true, focused = true, canPop = true } = {}) {
  const calls = [], cleanups = [], session = {}, witness = { session };
  let active = current, available = allowed;
  const shell = { session, witness, isCurrent: () => active,
    isRouteAvailable: () => available,
    destination: (route, os) => available ? `/${os}-admin${route}` : null };
  const routes = { adminAdditionalSettings: '/additional-settings', adminSettings: '/settings', adminItemGroupCreate: '/item-groups' };
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
      useLayoutEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); }, useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Redirect: 'Redirect', useIsFocused: () => focused, router: {
      canGoBack: () => canPop, back: () => calls.push('back'), push: target => calls.push(['push', target]) } },
    'react-native': { Platform: { OS: platform }, View: 'View' },
    '../shared/appRoutes': { appRoutes: routes },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push('drawer') }) },
    './adminActivityBackLabel': { adminActivityBackLabel: () => 'Orqaga' },
    './AdminShellContext': { useAdminShell: () => shell },
    './AdditionalSettingsRoute': { AdditionalSettingsRoute: 'AdditionalSettings' },
    './AdminSettingsScreen': { AdminSettingsScreen: 'Settings' },
    './ItemGroupsRoute': { ItemGroupsRoute: 'ItemGroups' },
  };
  const filename = path.resolve(__dirname, '../src/admin/AdminManagementRoutes.tsx'), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { shell, calls, render: name => mod.exports[name]({ footer: 'existing-dock' }),
    retire: () => { active = false; }, removeDestination: () => { available = false; }, unmount: () => cleanups.forEach(fn => fn()) };
}
for (const platform of ['ios', 'android']) {
  for (const [name, screen] of [['AdminAdditionalSettingsRoute', 'AdditionalSettings'], ['AdminSettingsRoute', 'Settings'], ['AdminItemGroupsRoute', 'ItemGroups']]) {
    test(`${platform} ${screen} receives original authority and existing navigation/dock`, () => {
      const f = fixture({ platform }), tree = f.render(name);
      assert.equal(tree.type, screen); assert.equal(tree.props.session, f.shell.session); assert.equal(tree.props.witness, f.shell.witness);
      assert.equal(tree.props.isCurrent, f.shell.isCurrent); assert.equal(tree.props.footer, 'existing-dock');
      tree.props.navigation.onPress(true); assert.deepEqual(f.calls, ['back']);
    });
    test(`${platform} ${screen} rejects denied entry and stale or unmounted native navigation`, () => {
      assert.equal(fixture({ platform, allowed: false }).render(name).type, 'Redirect');
      assert.equal(fixture({ platform, current: false }).render(name).type, 'View');
      for (const end of [f => f.retire(), f => f.removeDestination(), f => f.unmount()]) {
        const f = fixture({ platform }), tree = f.render(name); end(f); tree.props.navigation.onPress(false); assert.deepEqual(f.calls, []);
      }
      const background = fixture({ platform, focused: false }), tree = background.render(name);
      tree.props.navigation.onPress(); assert.deepEqual(background.calls, []);
      assert.equal(tree.props.isCurrent(), true, 'blur must not retire background request authority');
    });
  }
  test(`${platform} settings dispatches only still enabled destinations and falls back to the drawer`, () => {
    const f = fixture({ platform, canPop: false }), tree = f.render('AdminSettingsRoute');
    assert.equal(tree.props.isRouteAvailable, f.shell.isRouteAvailable);
    tree.props.navigation.onPress(false); tree.props.onNavigate('/additional-settings');
    assert.deepEqual(f.calls, ['drawer', ['push', `/${platform}-admin/additional-settings`]]);
    f.removeDestination(); tree.props.onNavigate('/additional-settings'); assert.equal(f.calls.length, 2);
  });
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function render({ platform = 'android', allowed = true, current = true, canPop = false } = {}) {
  const effects = [], calls = [], session = {}, witness = { session };
  let active = current;
  const shell = { session, witness, isCurrent: () => active, destination: () => allowed ? `/${platform}-admin/factory-locations` : null };
  const filename = path.resolve(__dirname, '../src/admin/AdminFactoryLocationsRouteCore.tsx'), mod = new Module(filename, module);
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useEffect: effect => effects.push(effect), useRef: value => ({ current: value }), useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Redirect: 'Redirect', router: { canGoBack: () => canPop, back: () => calls.push('back') } },
    'react-native': { Platform: { OS: platform }, View: 'View' },
    '../shared/appRoutes': { appRoutes: { adminFactoryLocations: '/admin-factory-locations' } },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push('drawer') }) },
    './adminActivityBackLabel': { adminActivityBackLabel: () => 'Orqaga' },
    './AdminShellProfileAction': { AdminShellProfileAction: 'AdminShellProfileAction' },
    './FactoryLocationsRoute': { FactoryLocationsRoute: 'FactoryLocationsRoute' },
    './AdminShellContext': { useAdminShell: () => shell },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.AdminFactoryLocationsRoute({ footer: 'existing-dock' });
  return { tree, shell, calls, effects, retire: () => { active = false; } };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} factory route passes the original shell witness to the real screen`, () => {
    const f = render({ platform });
    assert.equal(f.tree.type, 'FactoryLocationsRoute');
    assert.equal(f.tree.props.session, f.shell.session);
    assert.equal(f.tree.props.witness, f.shell.witness);
    assert.equal(f.tree.props.isCurrent, f.shell.isCurrent);
    assert.equal(f.tree.props.footer, 'existing-dock');
    assert.equal(f.tree.props.navigation.icon, 'menu');
    f.tree.props.navigation.onPress(); assert.deepEqual(f.calls, ['drawer']);
  });
  test(`${platform} factory deep link cannot mount without shell admission and capability destination`, () => {
    assert.equal(render({ platform, allowed: false }).tree.type, 'Redirect');
    assert.equal(render({ platform, current: false }).tree.type, 'View');
  });
  test(`${platform} factory leading action pops only while its original route is mounted and current`, () => {
    const f = render({ platform, canPop: true });
    assert.equal(f.tree.props.navigation.icon, 'back');
    const cleanup = f.effects.map(effect => effect()).filter(fn => typeof fn === 'function');
    f.tree.props.navigation.onPress(); assert.deepEqual(f.calls, ['back']);
    cleanup.forEach(fn => fn());
    f.tree.props.navigation.onPress(); assert.deepEqual(f.calls, ['back']);
    const stale = render({ platform, canPop: true }); stale.retire(); stale.tree.props.navigation.onPress();
    assert.deepEqual(stale.calls, []);
  });
}

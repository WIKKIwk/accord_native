const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const react = { useCallback: fn => fn, useRef: value => ({ current: value }), useState: value => [value, () => {}] };
const nativeListItem = Object.assign(function NativeListItem() {}, { HeadlineContent: 'ListItem.HeadlineContent' });
function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

function setup(platform, options = {}) {
  const calls = [], router = options.router ?? { push: route => calls.push(['push', route]), replace: route => calls.push(['replace', route]) };
  let focus = () => {}, reads = 0, marked = false;
  const controller = {
    reload() { reads++; }, refresh() { reads++; }, loadForPage() { reads++; }, getSnapshot: () => ({ saving: false }),
    markReloadOnReturn() { marked = true; },
    refreshOnReturn() { if (marked) { marked = false; reads++; } },
  };
  const home = { controller, snapshot: options.noSnapshot ? null : { assigned_warehouses: options.noWarehouse ? [] : ['Own'], material_warehouses: ['Own'], materials: [] },
    warehouse: options.noSnapshot ? null : 'Own', loading: !!options.loading, refreshing: false, saving: false,
    error: options.error ?? null, pending: options.pending ?? null, locked: !!options.loading };
  const ui = { PreparationList: 'PreparationList', PreparationStatus: 'PreparationStatus', PreparationPage: 'PreparationPage',
    PreparationRow: 'PreparationRow', PreparationText: 'PreparationText', PreparationButton: 'PreparationButton',
    usePreparationText: () => value => value, usePreparationDialogs: () => ({}) };
  const context = { usePreparationContext: () => ({ home, session: {} }) };
  const mocks = {
    '@expo/ui/jetpack-compose': { Column: 'Column', Host: 'ComposeHost', ListItem: nativeListItem, Text: 'ComposeText',
      useMaterialColors: () => ({ surface: options.dark ? 'dark-surface' : 'light-surface' }) },
    '@expo/ui/jetpack-compose/modifiers': { clickable: onClick => ({ kind: 'clickable', onClick }),
      clip: shape => ({ kind: 'clip', shape }), fillMaxWidth: () => ({ kind: 'fillMaxWidth' }),
      Shapes: { RoundedCorner: radii => radii } },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', Menu: 'Menu', ProgressView: 'ProgressView', Section: 'Section', Text: 'Text' },
    '@expo/ui/swift-ui/modifiers': { disabled: value => value },
    'expo-router': { router, Stack: { Screen: 'Stack.Screen' }, useFocusEffect: callback => { focus = callback; } },
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
    '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'gscale' }, canOpenRoute: () => options.scaleAllowed !== false },
    './PreparationUI': ui, './PreparationUI.android': ui, './PreparationContext': context, './PreparationContext.android': context,
    './preparationLogic': { preparationReceiptMode: () => options.receiptMode ?? 'warehouse', preparationVisibleMaterials: () => [] },
    './preparationHomePresentation': { preparationPendingLabel: () => 'pending' },
    './PreparationRoutes': { openPreparationScale: () => calls.push(['scale']) },
    './preparationNavigation.android': { openPreparationScale: () => calls.push(['scale']) },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
  };
  const filename = path.resolve(__dirname, `../src/preparation/PreparationHome.${platform}.tsx`);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : id === 'react' ? react
    : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const render = () => platform === 'ios' ? mod.exports.PreparationHome() : mod.exports.PreparationHomeScreen();
  return { home, render, focus: () => focus(), calls, reads: () => reads };
}

const labels = ['Ombor', 'Homashyolar', 'Mahsulot formulasi', 'Buyurtmalar', 'Ishlab chiqarish', 'Ishlab chiqarilgan homashyolar', 'Tarix'];
function menuRows(page, platform) {
  return platform === 'ios'
    ? findAll(page, node => node.type === 'Button' && node.props.systemImage)
    : findAll(page, node => node.type === nativeListItem).map(row => ({
      ...row, props: { ...row.props, title: findAll(row, node => node.type === 'ComposeText')[0].props.children,
        onPress: row.props.modifiers.find(modifier => modifier.kind === 'clickable').onClick },
    }));
}

test('android: home menu uses a grouped native list with worker-style corners', () => {
  for (const dark of [false, true]) {
    const page = setup('android', { dark }).render();
    const group = findAll(page, node => node.type === 'Column')[0];
    const host = findAll(page, node => node.type === 'ComposeHost')[0];
    const rows = menuRows(page, 'android');
    assert.deepEqual(host.props.matchContents, { vertical: true });
    assert.deepEqual(group.props.verticalArrangement, { spacedBy: 2 });
    assert.deepEqual(rows.map(row => row.props.title), labels);
    for (const [index, row] of rows.entries()) {
      const top = index === 0 ? 16 : 4, bottom = index === rows.length - 1 ? 16 : 4;
      assert.deepEqual(row.props.modifiers.find(modifier => modifier.kind === 'clip').shape,
        { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom });
      assert.equal(row.props.colors.containerColor, dark ? 'dark-surface' : 'light-surface');
      assert.equal(typeof row.props.onPress, 'function');
    }
  }
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: menu is immediately visible and enabled regardless of snapshot and loading`, () => {
    for (const options of [{ noSnapshot: true, loading: true }, { noSnapshot: true, error: 'offline' },
      { noWarehouse: true }, { loading: true }, {}]) {
      const page = setup(platform, options).render();
      const rows = menuRows(page, platform);
      assert.deepEqual(rows.map(row => row.props.label ?? row.props.title), labels);
      assert.ok(rows.every(row => !row.props.disabled && !row.props.modifiers?.includes(true)));
      assert.equal(findAll(page, node => node.type === 'ProgressView' || node.type === 'ActivityIndicator').length, 0);
      const container = findAll(page, node => node.type === (platform === 'ios' ? 'PreparationList' : 'PreparationPage'))[0];
      assert.equal(container.props.refresh ?? container.props.onRefresh, undefined);
      assert.ok(platform === 'ios' ? findAll(page, node => node.type === 'Menu' && node.props.label === 'Amallar').length
        : typeof container.props.onFabSelect === 'function' && container.props.fabActions.length > 0);
    }
  });

  test(`${platform}: returning from any menu page never reloads home data`, () => {
    const view = setup(platform, { noSnapshot: true, loading: true });
    const page = view.render();
    const routes = [
      ['push', `/${platform}-preparation/warehouse`], ['push', `/${platform}-preparation/materials`],
      ['push', `/${platform}-preparation/sets`], ['push', `/${platform}-preparation/sequence`],
      [platform === 'ios' ? 'replace' : 'push', `/${platform}-preparation/production`], ['push', `/${platform}-preparation/inventory`],
      ['push', `/${platform}-preparation/history`],
    ];
    for (const [index, row] of menuRows(page, platform).entries()) {
      row.props.onPress();
      assert.deepEqual(view.calls.at(-1), routes[index]);
      view.focus(); view.render(); view.focus();
      assert.equal(view.reads(), 0);
    }
  });

  test(`${platform}: actions remain available before the background snapshot completes`, async () => {
    const view = setup(platform, { noSnapshot: true, loading: true });
    const page = view.render();
    if (platform === 'ios') {
      const menu = findAll(page, node => node.type === 'Menu' && node.props.label === 'Amallar')[0];
      for (const label of ['Mahsulot formulasi', 'Homashyolar', 'Ombor', 'Tarozi kirimi', 'Kirim', 'Buyurtmalar', 'Tarix']) {
        assert.ok(findAll(menu, node => node.type === 'Button' && node.props.label === label).length, label);
      }
      findAll(menu, node => node.type === 'Button' && node.props.label === 'Kirim')[0].props.onPress();
      assert.deepEqual(view.calls.at(-1), ['push', '/ios-preparation/warehouse']);
      findAll(menu, node => node.type === 'Button' && node.props.label === 'Tarozi kirimi')[0].props.onPress();
    } else {
      const { fabActions, onFabSelect } = findAll(page, node => node.type === 'PreparationPage')[0].props;
      assert.deepEqual(fabActions.map(action => action.label), ['Mahsulot formulasi', 'Homashyolar', 'Ombor', 'Tarozi kirimi', 'Kirim', 'Buyurtmalar', 'Tarix']);
      assert.ok(fabActions.every(action => action.icon));
      onFabSelect('receive');
      assert.deepEqual(view.calls.at(-1), ['push', '/android-preparation/warehouse']);
      onFabSelect('scale');
    }
    assert.deepEqual(view.calls.at(-1), ['scale']);
    view.focus(); view.render();
    assert.equal(view.reads(), 0);
  });
}

test('android: FAB preserves each action route and capability-dependent choices', () => {
  const view = setup('android');
  const { fabActions, onFabSelect } = findAll(view.render(), node => node.type === 'PreparationPage')[0].props;
  const routes = [
    ['sets', ['push', '/android-preparation/sets']], ['materials', ['push', '/android-preparation/materials']],
    ['warehouse', ['push', '/android-preparation/warehouse']], ['scale', ['scale']],
    ['receive', ['push', '/android-preparation/warehouse']], ['sequence', ['push', '/android-preparation/sequence']],
    ['history', ['push', '/android-preparation/history']],
  ];
  assert.deepEqual(fabActions.map(action => action.id), routes.map(([id]) => id));
  for (const [id, expected] of routes) { onFabSelect(id); assert.deepEqual(view.calls.at(-1), expected); }
  const limited = setup('android', { scaleAllowed: false, receiptMode: 'scale' });
  const limitedActions = findAll(limited.render(), node => node.type === 'PreparationPage')[0].props.fabActions;
  assert.ok(limitedActions.every(action => action.id !== 'scale' && action.id !== 'receive'));
});

test('android: opening orders and production keeps the original home route for back navigation', () => {
  const { StackActions, StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const routeNames = ['index', 'sequence', 'production'];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const stack = StackRouter({ initialRouteName: 'index' });
  const home = { name: 'index', key: 'existing-preparation-home' };
  let state = { stale: false, type: 'stack', key: 'preparation-stack', index: 0, routeNames, routes: [home] };
  const apply = action => { const result = stack.getStateForAction(state, action, options); assert.ok(result?.state); state = result.state; };
  const screen = route => route.split('/').at(-1);
  const router = { push: route => apply(StackActions.push(screen(route))),
    replace: route => apply(StackActions.replace(screen(route))), back: () => apply({ type: 'GO_BACK' }) };
  const view = setup('android', { router });
  const rows = menuRows(view.render(), 'android');
  for (const [index, name] of [[3, 'sequence'], [4, 'production']]) {
    rows[index].props.onPress();
    assert.equal(state.routes[0], home);
    assert.equal(state.routes[state.index].name, name);
    router.back();
    assert.equal(state.routes[state.index], home);
  }
});

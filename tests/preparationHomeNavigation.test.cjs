const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const react = { useCallback: fn => fn, useRef: value => ({ current: value }), useState: value => [value, () => {}] };
function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

function setup(platform, options = {}) {
  const calls = [], router = { push: route => calls.push(['push', route]), replace: route => calls.push(['replace', route]) };
  let focus, marked = false, reloads = 0, chosen;
  const controller = {
    reload() {}, refresh() {}, getSnapshot: () => ({ saving: false }),
    markReloadOnReturn() { marked = true; },
    refreshOnReturn() { if (marked) { marked = false; reloads++; } },
  };
  const home = { controller, snapshot: options.noSnapshot ? null : { assigned_warehouses: ['Own'], material_warehouses: ['Own'], materials: [] },
    warehouse: 'Own', loading: !!options.loading, refreshing: !!options.refreshing, saving: false, error: null, pending: null, locked: false };
  const ui = { PreparationList: 'PreparationList', PreparationStatus: 'PreparationStatus', PreparationPage: 'PreparationPage',
    PreparationRow: 'PreparationRow', PreparationText: 'PreparationText', PreparationButton: 'PreparationButton',
    usePreparationText: () => value => value, usePreparationDialogs: () => ({ choose: async () => chosen }) };
  const context = { usePreparationContext: () => ({ home, session: {} }) };
  const mocks = {
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', Menu: 'Menu', ProgressView: 'ProgressView', Section: 'Section', Text: 'Text' },
    '@expo/ui/swift-ui/modifiers': { disabled: value => value },
    'expo-router': { router, Stack: { Screen: 'Stack.Screen' }, useFocusEffect: callback => { focus = callback; } },
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
    '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'gscale' }, canOpenRoute: () => true },
    './PreparationUI': ui, './PreparationUI.android': ui, './PreparationContext': context, './PreparationContext.android': context,
    './preparationLogic': { preparationReceiptMode: () => 'warehouse', preparationVisibleMaterials: () => [] },
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
  return { home, render, focus: () => focus(), calls, reloads: () => reloads, choose: value => { chosen = value; } };
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: tab returns keep data, while home child returns reload once`, () => {
    const view = setup(platform), page = view.render();
    view.focus(); view.focus();
    assert.equal(view.reloads(), 0);
    const items = platform === 'ios'
      ? [['building.2', '/ios-preparation/warehouse'], ['shippingbox', '/ios-preparation/materials'],
        ['list.bullet.rectangle', '/ios-preparation/sets'], ['clock.arrow.circlepath', '/ios-preparation/history']]
      : [['Ombor', '/android-preparation/warehouse'], ['Homashyolar', '/android-preparation/materials'],
        ['Mahsulot formulasi', '/android-preparation/sets'], ['Tarix', '/android-preparation/history']];
    for (const [label, route] of items) {
      const row = findAll(page, node => platform === 'ios' ? node.type === 'Button' && node.props.systemImage === label
        : node.type === 'PreparationRow' && node.props.title === label)[0];
      assert.ok(row, `missing ${label}`);
      row.props.onPress();
      assert.deepEqual(view.calls.at(-1), ['push', route]);
      const before = view.reloads();
      view.focus(); view.focus();
      assert.equal(view.reloads(), before + 1);
    }
    const inventory = findAll(page, node => platform === 'ios'
      ? node.type === 'Button' && node.props.label === 'Ishlab chiqarilgan homashyolar'
      : node.type === 'PreparationRow' && node.props.title === 'Ishlab chiqarilgan homashyolar')[0];
    inventory.props.onPress();
    const before = view.reloads(); view.focus();
    assert.equal(view.reloads(), before);
  });
}

test('iOS shows initial loading centrally without inserting a row during refresh', () => {
  const initial = setup('ios', { noSnapshot: true, loading: true }).render();
  assert.equal(findAll(initial, node => node.type === 'ProgressView').length, 1);
  assert.equal(findAll(initial, node => node.type === 'PreparationList').length, 0);
  const refresh = setup('ios', { loading: true }).render();
  assert.equal(findAll(refresh, node => node.type === 'ProgressView').length, 0);
  assert.equal(findAll(refresh, node => node.type === 'PreparationStatus')[0].props.loading, false);
  assert.equal(findAll(refresh, node => node.type === 'PreparationList').length, 1);
});

test('Android only displays the refresh indicator for a manual refresh', () => {
  const automatic = setup('android', { loading: true }).render();
  assert.equal(findAll(automatic, node => node.type === 'PreparationPage')[0].props.refreshing, false);
  const manual = setup('android', { loading: true, refreshing: true }).render();
  assert.equal(findAll(manual, node => node.type === 'PreparationPage')[0].props.refreshing, true);
  const initial = setup('android', { noSnapshot: true, loading: true }).render();
  assert.equal(findAll(initial, node => node.type === 'ActivityIndicator').length, 1);
  assert.equal(findAll(initial, node => node.type === 'PreparationRow').length, 0);
});

test('scale launched from home requests a reload on return', async () => {
  const ios = setup('ios'), iosPage = ios.render();
  findAll(iosPage, node => node.type === 'Button' && node.props.label === 'Tarozi kirimi')[0].props.onPress();
  ios.focus(); assert.equal(ios.reloads(), 1);
  const android = setup('android'), androidPage = android.render();
  android.choose('scale');
  findAll(androidPage, node => node.type === 'PreparationPage')[0].props.actions();
  await Promise.resolve();
  android.focus(); assert.equal(android.reloads(), 1);
});

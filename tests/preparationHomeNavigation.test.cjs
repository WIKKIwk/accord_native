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
  let focus = () => {}, reads = 0, marked = false, chosen, choices;
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
    usePreparationText: () => value => value, usePreparationDialogs: () => ({ choose: async (_title, items) => { choices = items; return chosen; } }) };
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
  return { home, render, focus: () => focus(), calls, reads: () => reads, choose: value => { chosen = value; }, choices: () => choices };
}

const labels = ['Ombor', 'Homashyolar', 'Mahsulot formulasi', 'Buyurtmalar', 'Ishlab chiqarish', 'Ishlab chiqarilgan homashyolar', 'Tarix'];
function menuRows(page, platform) {
  return platform === 'ios'
    ? findAll(page, node => node.type === 'Button' && node.props.systemImage)
    : findAll(page, node => node.type === 'PreparationRow' && labels.includes(node.props.title));
}

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
        : typeof container.props.actions === 'function');
    }
  });

  test(`${platform}: returning from any menu page never reloads home data`, () => {
    const view = setup(platform, { noSnapshot: true, loading: true });
    const page = view.render();
    const routes = [
      ['push', `/${platform}-preparation/warehouse`], ['push', `/${platform}-preparation/materials`],
      ['push', `/${platform}-preparation/sets`], [platform === 'ios' ? 'push' : 'replace', `/${platform}-preparation/sequence`],
      ['replace', `/${platform}-preparation/production`], ['push', `/${platform}-preparation/inventory`],
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
      const actions = findAll(page, node => node.type === 'PreparationPage')[0].props.actions;
      view.choose('receive'); actions(); await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(view.choices().map(choice => choice.label), ['Mahsulot formulasi', 'Homashyolar', 'Ombor', 'Tarozi kirimi', 'Kirim', 'Buyurtmalar', 'Tarix']);
      assert.deepEqual(view.calls.at(-1), ['push', '/android-preparation/warehouse']);
      view.choose('scale'); actions(); await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepEqual(view.calls.at(-1), ['scale']);
    view.focus(); view.render();
    assert.equal(view.reads(), 0);
  });
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const catalog = require('../src/shared/localization/catalog.json');
function setup(platform) {
  const calls = [], state = { values: { duplicateLabels: false, includeBobina: false, standardPrintSide: true },
    pending: null, saving: false, needsReopen: false, error: null };
  const visibility = { showPrintSide: true, showWorkOptions: true }, controller = {};
  const text = { admin: key => catalog.admin[`admin.${key}`].uz, production: key => catalog.production[key].uz,
    error: () => 'Noaniq natija', title: () => 'Tasdiqlash', confirmation: () => 'Savol' };
  const elements = new Proxy({ useMaterialColors: () => ({ error: 'red' }) }, { get: (target, key) => target[key] ?? key });
  const modifiers = new Proxy({}, { get: (_target, key) => (...args) => ({ name: key, args }) });
  const filename = path.resolve(__dirname, `../src/rezka/RezkaOrderQuickSettings.${platform}.tsx`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': elements, '@expo/ui/jetpack-compose': elements,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': { View: 'View', PlatformColor: value => value },
    './rezkaOrderQuickSettingsCommon': { quickSettingsVisibility: () => visibility,
      showRezkaOrderConfirmation: (_controller, option, value) => calls.push([option, value]) },
    './useRezkaOrderSettings': { useRezkaOrderSettings: () => ({ controller, state }), useRezkaOrderText: () => text } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const render = () => { const outer = mod.exports.RezkaOrderQuickSettings({ snapshot: {}, map: {}, entry: {}, onSaved() {} });
    return outer && typeof outer.type === 'function' ? outer.type(outer.props) : outer; };
  return { render, state, visibility, calls };
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: quick settings use the three V2 switches and confirmation handlers`, () => {
    const t = setup(platform), page = t.render(), serialized = JSON.stringify(page);
    assert.ok(serialized.includes('Rezka sozlamalari')); assert.ok(serialized.includes('Har bir rulonga 2 ta yorliq'));
    assert.ok(serialized.includes('Babina bilan sotiladi')); assert.ok(serialized.includes('Standart'));
    if (platform === 'ios') {
      const switches = nodes(page, n => n.type === 'Toggle'); assert.equal(switches.length, 3);
      switches[0].props.onIsOnChange(true); switches[1].props.onIsOnChange(true); switches[2].props.onIsOnChange(false);
    } else {
      const options = nodes(page, n => typeof n.type === 'function' && n.type.name === 'Option'); assert.equal(options.length, 3);
      options[0].props.change(true); options[1].props.change(true); options[2].props.change(false);
      const row = options[0].type(options[0].props), toggler = row.props.modifiers.find(item => item.name === 'toggleable');
      assert.equal(toggler.args[2].role, 'switch'); toggler.args[1]();
    }
    assert.deepEqual(t.calls.slice(0, 3), [['duplicateLabels', true], ['includeBobina', true], ['printSide', false]]);
  });
  test(`${platform}: completed orders show print side only; stale or busy state cannot enable edits`, () => {
    const t = setup(platform); t.visibility.showWorkOptions = false; t.state.saving = true;
    let page = t.render(), serialized = JSON.stringify(page); assert.ok(serialized.includes('Taraf')); assert.ok(!serialized.includes('Babina bilan sotiladi'));
    if (platform === 'ios') {
      const toggle = nodes(page, n => n.type === 'Toggle')[0];
      assert.equal(toggle.props.modifiers.find(x => x.name === 'disabled').args[0], true);
      toggle.props.onIsOnChange(false);
    } else {
      const option = nodes(page, n => typeof n.type === 'function' && n.type.name === 'Option')[0];
      assert.equal(option.props.enabled, false); option.props.change(false);
    }
    assert.deepEqual(t.calls, [], 'a queued callback from a disabled control cannot open confirmation');
    t.visibility.showPrintSide = false; page = t.render(); assert.equal(page, null);
  });
}

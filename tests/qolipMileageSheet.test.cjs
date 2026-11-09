const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}, jsx = false) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: jsx ? ts.JsxEmit.ReactJSX : undefined, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const formatting = load('qolip/qolipMileageFormatting.ts', { './qolipApiCommon': common });
function screen(platform, supplied = {}) {
  const captures = {}, calls = [];
  const state = { loading: false, error: false, mileage: null, controller: { load: async () => calls.push('reload') }, ...supplied };
  const component = name => function Stub(props) { (captures[name] ??= []).push(props);
    return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'HStack', 'Image', 'List', 'ProgressView', 'Text', 'VStack', 'Column', 'TextButton',
    'ActivityIndicator', 'ScrollView', 'NativeText', 'View', 'SymbolView'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)]));
  const ui = { ...nodes, useMaterialColors: () => ({ onSurface: 'black', onSurfaceVariant: 'gray' }) };
  const words = { mileage: 'Probeg tarixi', current: 'Joriy probeg: {meter} m', not_started: 'Probeg hisobi hali boshlanmagan',
    cycle: '{meter} m', active_cycle: 'Joriy davr' };
  const interpolate = (value, values = {}) => value.replace('{meter}', values.meter ?? '');
  const deps = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui,
    '@expo/ui/swift-ui/modifiers': { textSelection: () => ({}) }, '@expo/ui/jetpack-compose/modifiers': { testID: () => ({}) },
    'expo-symbols': { SymbolView: nodes.SymbolView }, 'react-native': { View: nodes.View, Text: nodes.NativeText,
      ScrollView: nodes.ScrollView, ActivityIndicator: nodes.ActivityIndicator, useWindowDimensions: () => ({ height: 800 }) },
    '../shared/localization': { extensionText: (_method, key, _locale, values) => interpolate(words[key] ?? key, values),
      localizedGetter: key => key === 'retry' ? 'Qayta urinish' : 'Server bilan aloqa uzildi' },
    './qolipMileageFormatting': formatting, './useQolipMileage': { useQolipMileage: () => state },
    './useQolipText': { useQolipText: () => ({ locale: 'uz' }) } };
  const { QolipMileageSheet } = load(`qolip/QolipMileageSheet.${platform}.tsx`, deps, true);
  const render = () => renderToStaticMarkup(React.createElement(QolipMileageSheet, { session: {}, code: 'Q-ONE' }));
  return { state, captures, calls, render };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} mileage sheet shows loading or retry rather than inventing a value`, async () => {
    let h = screen(platform, { loading: true }); h.render(); assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    h = screen(platform, { error: true }); const html = h.render(); assert.match(html, /Server bilan aloqa uzildi/); assert.doesNotMatch(html, /Joriy probeg/);
    const retry = platform === 'ios' ? h.captures.Button[0].onPress : h.captures.TextButton[0].onClick;
    retry(); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(h.calls, ['reload']);
  });
  test(`${platform} mileage sheet distinguishes an unknown baseline and reverses cycle order`, () => {
    const old = process.env.TZ; process.env.TZ = 'UTC';
    try {
      const mileage = { qolip_code: 'Q-ONE', tracking_enabled: false, current_meter: null, cycles: [
        { id: 'old', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-02T00:00:00Z', meter: 12.5 },
        { id: 'new', started_at: '2026-02-01T00:00:00Z', ended_at: null, meter: 3 },
      ] };
      let html = screen(platform, { mileage }).render(); assert.match(html, /Q-ONE/); assert.match(html, /Probeg hisobi hali boshlanmagan/);
      assert.ok(html.indexOf('3 m') < html.indexOf('12.5 m')); assert.match(html, /Joriy davr/); assert.doesNotMatch(html, /Joriy probeg: 0 m/);
      html = screen(platform, { mileage: { ...mileage, tracking_enabled: true, current_meter: 0 } }).render();
      assert.match(html, /Joriy probeg: 0 m/);
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  });
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
const item = { qolip_code: 'Q1', code: 'I1', name: 'Test', size: 40, has_qolip_spec: true };
const target = { block: { name: 'Blok A', warehouse: 'W' }, rowLetter: 'C', columnNumber: 3 };
const prepared = { target, products: [item], scope: 'one' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function hook({ pending = null, result = null } = {}) {
  const calls = [], sheet = { open: (content, options) => calls.push(['open', content, options]),
    close: () => calls.push(['close']), isOpen: () => false };
  const controller = { getSnapshot: () => ({ saving: false }), selectProduct: value => calls.push(['select', value]),
    prepareMulti: values => { calls.push(['prepare', values]); return prepared; }, saveSelected: async () => result,
    confirmMulti: async value => { calls.push(['confirmed', value]); return result; } };
  const state = { selected: [], controller, saving: false }, notice = { message: '', show: message => calls.push(['notice', message]) };
  const { useQolipCellAttach } = load('qolip/useQolipCellAttach.ts', {
    react: { createElement: React.createElement, useRef: current => ({ current }), useState: () => [pending, value => calls.push(['pending', value])] },
    '../nativeSheet': { useNativeSheet: () => sheet }, '../shared/localization': { extensionText: () => 'Sessiya o‘zgardi' },
    './qolipErrorMessage': { qolipErrorMessage: (_error, _locale, fallback) => fallback },
    './useQolipCellPlacement': { useQolipCellPlacement: () => state }, './useQolipNotice': { useQolipNotice: () => notice },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values = {}) => `${key}:${JSON.stringify(values)}` }) },
  });
  const props = { session: {}, blocks: [], saved: value => calls.push(['saved', value]) }, view = useQolipCellAttach(props, () => null);
  return { view, calls, controller };
}

test('picker closes before selecting a single product or preparing a multi confirmation', () => {
  const h = hook(); h.view.openPicker(); const opened = h.calls[0]; assert.equal(opened[0], 'open');
  opened[1].props.single(item); assert.deepEqual(h.calls.slice(1), [['close']]); opened[2].onDismiss();
  assert.deepEqual(h.calls.slice(1), [['close'], ['select', item]]);
  const m = hook(); m.view.openPicker(); const modal = m.calls[0]; modal[1].props.multiple([item]);
  assert.deepEqual(m.calls.slice(1), [['close']]); modal[2].onDismiss();
  assert.deepEqual(m.calls.slice(1), [['close'], ['prepare', [item]], ['pending', prepared]]);
  assert.equal(m.calls.some(call => call[0] === 'confirmed'), false);
});

test('confirmation sends once and reports success, partial, first-error and session reset distinctly', async () => {
  const full = { kind: 'saved', target, products: [item] }, h = hook({ pending: prepared, result: full }); h.view.confirm(); await tick();
  assert.deepEqual(h.calls, [['pending', null], ['confirmed', prepared], ['saved', full]]);
  for (const [result, expected] of [[{ kind: 'partial', saved: 1, failed: 2 }, 'home.place_partial:{"success":1,"failed":2}'],
    [{ kind: 'failed', error: Error('offline') }, 'home.place_all_failed:{}'], [{ kind: 'session_changed', saved: 1 }, 'Sessiya o‘zgardi']]) {
    const attempt = hook({ result }); attempt.view.save(); await tick(); assert.deepEqual(attempt.calls, [['notice', expected]]);
  }
});

function screen(platform, supplied = {}) {
  const captures = {}, calls = [], effects = [];
  const component = name => function Stub(props) { (captures[name] ??= []).push(props); return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'HStack', 'Image', 'ProgressView', 'Spacer', 'Text', 'VStack', 'Column', 'CircularProgressIndicator',
    'OutlinedButton', 'TextButton', 'View', 'PreparationNotice', 'QolipCellPicker'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)]));
  const dialog = component('AlertDialog'); for (const key of ['Title', 'Text', 'DismissButton', 'ConfirmButton']) dialog[key] = component(`AlertDialog.${key}`);
  const ui = { ...nodes, AlertDialog: dialog };
  const mod = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['buttonStyle', 'disabled', 'frame', 'fillMaxWidth', 'size', 'testID'].map(name => [name, mod(name)]));
  const words = { 'home.cell_attach': 'Qolipni joyga qo‘shish', 'home.location': 'Joy', 'home.code_or_product': 'Qolip code / mahsulot',
    'home.mold_code_or_product_hint': 'Qolip code yoki mahsulot nomi', 'home.mold_label': 'Qolip', 'action.save': 'Saqlash',
    'home.place_confirm_title': 'Qoliplarni joylaysizmi?', 'home.place_confirm_message': '{count} ta tanlangan qolipni {block} • {cell} yachaykaga joylaysizmi?',
    'action.cancel': 'Bekor qilish', 'action.place': 'Joylash', 'products.mold_count': '{count} ta qolip' };
  const text = (key, values = {}) => Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), words[key] ?? key);
  const state = { selected: [], block: target.block, rowLetter: 'C', columnNumber: 3, saving: false, canSave: false,
    showMold: false, notice: '', pending: null, text, openPicker: () => calls.push(['picker']), save: () => calls.push(['save']),
    confirm: () => calls.push(['confirm']), cancelConfirm: () => calls.push(['cancel']), ...supplied };
  const deps = { react: { ...React, useRef: value => ({ current: value }), useEffect: fn => { effects.push(fn); } },
    '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'react-native': { View: nodes.View, useWindowDimensions: () => ({ width: 400, height: 800 }), Alert: { alert: (...args) => calls.push(['alert', ...args]) } },
    '../preparation/PreparationNotice': { PreparationNotice: nodes.PreparationNotice }, './QolipCellPicker': { QolipCellPicker: nodes.QolipCellPicker },
    './qolipCellPlacement': { qolipPlacementFormProductLabel: value => `${value.name} • ${value.qolip_code} • ${value.size}` },
    './useQolipCellAttach': { useQolipCellAttach: () => state } };
  const { QolipCellAttachSheet } = load(`qolip/QolipCellAttachSheet.${platform}.tsx`, deps);
  const render = () => renderToStaticMarkup(React.createElement(QolipCellAttachSheet, { session: {}, blocks: [], saved() {} }));
  return { render, captures, calls, effects, state };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} attach sheet shows target and product picker while invalid save is disabled`, () => {
    const h = screen(platform); const output = h.render(); assert.match(output, /Qolipni joyga qo‘shish/); assert.match(output, /Blok A • C3/);
    const picker = platform === 'ios' ? h.captures.Button.find(x => x.label == null).onPress : h.captures.OutlinedButton[0].onClick; picker();
    const save = platform === 'ios' ? h.captures.Button.find(x => x.label === 'Saqlash') : h.captures.Button[0];
    if (platform === 'ios') assert.ok(save.modifiers.some(x => x.name === 'disabled' && x.args[0])); else assert.equal(save.enabled, false);
    assert.deepEqual(h.calls, [['picker']]);
  });
  test(`${platform} attach confirmation requires the explicit place action`, () => {
    const h = screen(platform, { pending: prepared, selected: [item], canSave: true, showMold: true }); h.render();
    if (platform === 'ios') {
      h.effects.forEach(effect => effect()); const alert = h.calls.find(call => call[0] === 'alert');
      assert.match(alert[2], /1 ta tanlangan qolipni Blok A • C3/); assert.equal(h.calls.some(call => call[0] === 'confirm'), false);
      alert[3].find(action => action.text === 'Joylash').onPress();
    } else {
      const button = h.captures.TextButton.find(x => x.modifiers?.some(m => m.name === 'testID' && m.args[0] === 'qolip-attach-confirm'));
      assert.equal(h.calls.some(call => call[0] === 'confirm'), false); button.onClick();
    }
    assert.ok(h.calls.some(call => call[0] === 'confirm'));
  });
}

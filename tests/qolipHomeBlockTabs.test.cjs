const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return m.exports;
}
const drag = load('qolipBlockTabDrag.ts');
const tabs = ['a', 'b', 'c'].map((key, index) => ({ key, block: { name: key.toUpperCase(), warehouse: 'W' }, index, selected: index === 1, matchCount: index === 0 ? 5 : 0 }));
function harness() {
  const calls = [], captures = {}, hookValues = [], cleanups = []; let hookIndex = 0, effects = [];
  const react = { ...React,
    useRef: initial => { const index = hookIndex++; return hookValues[index] ??= { current: initial }; },
    useState: initial => { const index = hookIndex++; if (!(index in hookValues)) hookValues[index] = initial;
      return [hookValues[index], value => { hookValues[index] = typeof value === 'function' ? value(hookValues[index]) : value; }]; },
    useCallback: callback => callback,
    useEffect: effect => { effects.push(effect); },
    useLayoutEffect: effect => { effects.push(effect); },
  };
  const component = name => function Node(props) { (captures[name] ??= []).push(props); return React.createElement('div', null, props.children); };
  const deps = { react, './qolipBlockTabDrag': drag,
    'react-native': { View: component('View'), ScrollView: component('ScrollView'), StyleSheet: { create: value => value } },
    'react-native-gesture-handler': { GestureDetector: component('GestureDetector'),
      usePanGesture: config => { (captures.Pan ??= []).push(config); return { config, kind: 'pan' }; },
      useTapGesture: config => { (captures.Tap ??= []).push(config); return { config, kind: 'tap' }; },
      useExclusiveGestures: (...gestures) => ({ kind: 'exclusive', gestures }),
    },
  };
  const { QolipHomeBlockTabs } = load('QolipHomeBlockTabs.tsx', deps);
  const props = { tabs, onSelect: index => calls.push(['select', index]), onReorder: (from, to) => calls.push(['reorder', from, to]),
    label: tab => tab.block.name, renderLabel: tab => tab.block.name,
    colors: { surface: 'surface', selected: 'selected', dragging: 'drag', underline: 'line', match: 'green' } };
  const render = () => {
    hookIndex = 0; effects = []; for (const key of Object.keys(captures)) delete captures[key];
    const html = renderToStaticMarkup(React.createElement(QolipHomeBlockTabs, props));
    for (const effect of effects) { const cleanup = effect(); if (typeof cleanup === 'function') cleanups.push(cleanup); }
    return html;
  };
  const measure = () => captures.View.filter(view => view.onLayout).forEach((view, index) => view.onLayout({ nativeEvent: { layout: { x: index * 100, width: 100 } } }));
  return { calls, captures, props, render, measure, unmount: () => cleanups.forEach(cleanup => cleanup()) };
}
test('tab gestures are exclusive native tap/long-press-pan with no swipe pager', () => {
  const h = harness(); h.render();
  assert.equal(h.captures.ScrollView.length, 1); assert.equal(h.captures.ScrollView[0].horizontal, true);
  assert.equal(h.captures.ScrollView[0].pagingEnabled, undefined); assert.equal(h.captures.ScrollView[0].scrollEnabled, true);
  assert.ok(h.captures.Pan.every(pan => pan.activateAfterLongPress === 500 && pan.runOnJS && pan.minDistance === 0));
  assert.ok(h.captures.GestureDetector.every(view => view.gesture.kind === 'exclusive'));
  h.captures.Tap[2].onActivate(); assert.deepEqual(h.calls, [['select', 2]]);
  const b = h.captures.View.find(view => view.testID === 'qolip-home-tab-b');
  assert.deepEqual(b.accessibilityState, { selected: true }); b.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
  assert.deepEqual(h.calls.at(-1), ['select', 1]);
});
test('drag previews without a write, disables strip scrolling and commits exactly once on release', () => {
  const h = harness(); h.render(); h.measure(); const pan = h.captures.Pan[0];
  pan.onActivate({ absoluteX: 50, x: 50 }); pan.onUpdate({ absoluteX: 250 });
  assert.deepEqual(h.calls, []); h.render(); assert.equal(h.captures.ScrollView[0].scrollEnabled, false);
  assert.deepEqual(h.captures.View.filter(view => view.testID).map(view => view.testID), ['qolip-home-tab-b', 'qolip-home-tab-c', 'qolip-home-tab-a']);
  pan.onDeactivate({ absoluteX: 250, canceled: false }); pan.onFinalize({ canceled: false });
  assert.deepEqual(h.calls, [['reorder', 0, 2]]); h.render(); assert.equal(h.captures.ScrollView[0].scrollEnabled, true);
});
test('cancellation restores the original order without selecting or persisting', () => {
  const h = harness(); h.render(); h.measure(); const pan = h.captures.Pan[0];
  pan.onActivate({ absoluteX: 50, x: 50 }); pan.onUpdate({ absoluteX: 250 });
  pan.onDeactivate({ absoluteX: 250, canceled: true }); pan.onFinalize({ canceled: true }); h.render();
  assert.deepEqual(h.calls, []); assert.equal(h.captures.ScrollView[0].scrollEnabled, true);
  assert.deepEqual(h.captures.View.filter(view => view.testID).map(view => view.testID), tabs.map(tab => `qolip-home-tab-${tab.key}`));
});
test('a removed source, missing measurement and unmounted strip cannot commit an old gesture', () => {
  let h = harness(); h.render(); h.measure(); let pan = h.captures.Pan[0]; pan.onActivate({ absoluteX: 50, x: 50 });
  h.props.tabs = tabs.slice(1); h.render(); pan.onDeactivate({ absoluteX: 250, canceled: false }); assert.deepEqual(h.calls, []);
  h = harness(); h.render(); pan = h.captures.Pan[0]; pan.onActivate({ absoluteX: 50, x: 50 });
  pan.onDeactivate({ absoluteX: 250, canceled: false }); assert.deepEqual(h.calls, []);
  h = harness(); h.render(); h.measure(); pan = h.captures.Pan[0]; pan.onActivate({ absoluteX: 50, x: 50 }); h.unmount();
  pan.onDeactivate({ absoluteX: 250, canceled: false }); h.captures.Tap[0].onActivate(); assert.deepEqual(h.calls, []);
});
test('late tap callbacks use the current block index and ignore removed tabs', () => {
  const h = harness(); h.render(); const oldTap = h.captures.Tap[0];
  h.props.tabs = [tabs[1], tabs[0], tabs[2]].map((tab, index) => ({ ...tab, index })); h.render();
  oldTap.onActivate(); assert.deepEqual(h.calls, [['select', 1]]);
  h.props.tabs = h.props.tabs.filter(tab => tab.key !== 'a'); h.render(); oldTap.onActivate(); assert.equal(h.calls.length, 1);
});

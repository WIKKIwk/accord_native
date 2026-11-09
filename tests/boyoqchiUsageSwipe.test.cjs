const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function fixture(direction = 'leftToRight') {
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiUsageSwipe.tsx'), loaded = new Module(filename, module);
  const hooks = [], queued = [], selections = []; let cursor = 0, config;
  const same = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
  const react = { useRef: value => { const i = cursor++; return hooks[i] ??= { current: value }; },
    useCallback: fn => { cursor++; return fn; },
    useEffect: (effect, deps) => { const i = cursor++, prior = hooks[i]; if (prior && same(prior.deps, deps)) return;
      prior?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; },
    useLayoutEffect: (effect, deps) => { const i = cursor++, prior = hooks[i]; if (prior && same(prior.deps, deps)) return;
      prior?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; } };
  const mocks = { 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, react,
    'react-native': { View: 'View', useWindowDimensions: () => ({ width: 320 }) },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView',
      usePanGesture: value => { config = value; return value; } },
    'react-native-worklets': { scheduleOnRN: (fn, ...args) => queued.push(() => fn(...args)) },
    '../components/useBaseTheme': { useBaseTheme: () => ({ direction }) } };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const render = (usage = 'rasxot', disabled = false) => { cursor = 0;
    return loaded.exports.BoyoqchiUsageSwipe({ usage, disabled, onUsage: value => selections.push(value), children: 'existing palette' }); };
  return { render, event: value => config.onDeactivate(value), config: () => config, selections,
    flush: () => { while (queued.length) queued.shift()(); }, queued: () => queued.length,
    unmount: () => { for (const hook of hooks) hook?.cleanup?.(); } };
}
const event = (translationX, velocityX = 0, canceled = false) => ({ translationX, velocityX, canceled });

test('palette swipe changes only the adjacent usage and leaves the existing palette as its child', () => {
  const f = fixture(), tree = f.render();
  assert.equal(tree.type, 'GestureHandlerRootView');
  assert.equal(tree.props.children.props.children.props.children, 'existing palette');
  assert.deepEqual(f.config().activeOffsetX, [-16, 16]); assert.deepEqual(f.config().failOffsetY, [-10, 10]);
  f.event(event(-40)); f.flush(); assert.deepEqual(f.selections, []);
  f.event(event(-110)); f.flush(); assert.deepEqual(f.selections, ['astatka']);
  f.render('astatka'); f.event(event(-110)); f.flush(); assert.deepEqual(f.selections, ['astatka']);
  f.event(event(30, 550)); f.flush(); assert.deepEqual(f.selections, ['astatka', 'rasxot']);
  f.event(event(-110, 0, true)); f.flush(); assert.equal(f.selections.length, 2); f.unmount();
});

test('RTL reverses swipe direction to follow the app layout', () => {
  const f = fixture('rightToLeft'); f.render(); f.event(event(110)); f.flush(); assert.deepEqual(f.selections, ['astatka']);
  f.render('astatka'); f.event(event(-110)); f.flush(); assert.deepEqual(f.selections, ['astatka', 'rasxot']); f.unmount();
});

test('a queued swipe is dropped when saving starts or the palette unmounts', () => {
  const f = fixture(); f.render(); f.event(event(-110)); assert.equal(f.queued(), 1);
  f.render('rasxot', true); assert.equal(f.config().enabled, false); f.flush(); assert.deepEqual(f.selections, []);
  f.render('rasxot', false); f.event(event(-110)); f.unmount(); f.flush(); assert.deepEqual(f.selections, []);
});

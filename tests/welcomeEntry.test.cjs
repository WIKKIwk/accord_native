const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function hooks() {
  const slots = [], pending = [];
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const api = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
    },
    useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }); },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (same(slots[i]?.deps, deps)) return;
      const previous = slots[i];
      slots[i] = { deps };
      pending.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
    },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  return { api, render(fn) { cursor = 0; const result = fn(); pending.splice(0).forEach(run => run()); return result; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
function transitionHarness() {
  const react = hooks(), started = [];
  let reduceMotionChanged, removed = false;
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
  function animation(kind, children = [], config) {
    return { kind, children, config, stopped: false,
      start(done) { this.done = done; started.push(this); },
      finish() {
        if (this.stopped) return;
        if (kind === 'timing') config.value.setValue(config.toValue);
        children.forEach(child => child.finish()); this.done?.({ finished: true });
      },
      stop() { this.stopped = true; children.forEach(child => child.stop()); this.done?.({ finished: false }); },
    };
  }
  const { useWelcomeTransition } = load('components/useWelcomeTransition.ts', {
    react: react.api,
    'react-native': {
      Animated: { Value, timing: (value, config) => animation('timing', [], { ...config, value }),
        parallel: children => animation('parallel', children), sequence: children => animation('sequence', children), delay: duration => animation('delay', [], { duration }) },
      Easing: { cubic: 'cubic', out: value => value },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false,
        addEventListener: (_name, listener) => { reduceMotionChanged = listener; return { remove() { removed = true; } }; } },
    },
  });
  return { started, render: copy => react.render(() => useWelcomeTransition(copy)),
    reduce: value => reduceMotionChanged(value), unmount: () => react.unmount(), removed: () => removed };
}
const copy = language => ({ headline: `${language}:welcome`, languageLabel: `${language}:language`, languageValue: `${language}:unselected`,
  themeLabel: `${language}:theme`, themeValue: `${language}:classic`, startLabel: `${language}:start` });

test('welcome replaces every translated label only after the old text has faded out', () => {
  const h = transitionHarness(), uz = copy('uz'), en = copy('en');
  assert.deepEqual(h.render(uz).copy, uz);
  assert.equal(h.started.length, 0);
  assert.deepEqual(h.render(en).copy, uz);
  const exit = h.started[0];
  assert.equal(exit.children[0].config.duration, 300);
  exit.finish();
  const entering = h.render(en);
  assert.deepEqual(entering.copy, en);
  assert.equal(entering.opacity.value, 0);
  assert.equal(entering.translateX.value, -24);
  const enter = h.started[1];
  assert.equal(enter.children[0].config.duration, 70);
  assert.equal(enter.children[1].children[0].config.duration, 420);
  enter.finish();
  assert.equal(entering.opacity.value, 1);
  assert.equal(entering.translateX.value, 0);
  h.unmount();
});

test('a newer selection cancels an unfinished transition and cannot restore stale text', () => {
  const h = transitionHarness(); h.render(copy('uz')); h.render(copy('en'));
  const oldExit = h.started[0]; h.render(copy('ru'));
  assert.equal(oldExit.stopped, true);
  oldExit.finish();
  assert.equal(h.render(copy('ru')).copy.headline, 'uz:welcome');
  h.started[1].finish();
  assert.equal(h.render(copy('ru')).copy.headline, 'ru:welcome');
  h.unmount(); assert.equal(h.removed(), true);
  assert.equal(h.started.at(-1).stopped, true);
});

test('reduced motion switches text immediately and stops an animation already in flight', () => {
  const h = transitionHarness(); h.render(copy('uz')); h.render(copy('en'));
  h.reduce(true);
  const result = h.render(copy('ru'));
  assert.equal(h.started[0].stopped, true);
  assert.equal(h.render(copy('ru')).copy.headline, 'ru:welcome');
  assert.equal(result.opacity.value, 1); assert.equal(result.translateX.value, 0);
  assert.equal(h.started.length, 1); h.unmount();
});

test('welcome cycles all labels, opens the original sheets and pins an explicit language', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const react = hooks();
  const locale = { locale: 'uz', hasExplicitSelection: false, setLocale: async value => { locale.locale = value; locale.hasExplicitSelection = true; } };
  const theme = { variant: 'classic', setVariant: async value => { theme.variant = value; } };
  const ui = { BottomSheet: 'BottomSheet', RNHostView: 'RNHostView', Button: 'Button', FieldGroup: Object.assign(() => {}, { Section: 'Section' }),
    ListItem: 'ListItem', Text: 'Text', TextInput: 'TextInput', useNativeState: value => ({ value, set() {} }) };
  const { AppEntry } = load('components/AppEntry.tsx', {
    react: react.api, '@expo/ui': ui,
    'react-native': { View: 'View', ActivityIndicator: 'Spinner', Platform: { OS: 'android' }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../auth': {}, '../LoginScreen': { LoginScreen: 'LoginScreen' },
    '../mobileApi': { MobileApi: { instance: { baseUrl: 'https://example.test' } } },
    '../savedAccountRuntime': { initializeSavedAccounts: async () => ({ accountsForEndpoint: () => [], activeAccountId: null }) },
    '../shared/localization': { localizedGetter: (key, lang) => `${lang}:${key}` },
    '../shared/localization/runtime': { localeController: locale }, '../shared/switchPinRuntime': { switchPinStore: {} },
    '../shared/themeRuntime': { themeController: theme }, '../shared/accountEntryLogic': {}, './BaseHost': { BaseHost: 'Host' },
    './WelcomeScreen': { WelcomeScreen: 'WelcomeScreen' }, './useBaseTheme': { useBaseTheme: () => ({ colors: {} }) },
  });
  const render = () => react.render(() => AppEntry({ onLogin() {} }));
  const welcome = () => nodes(render(), node => node.type === 'WelcomeScreen')[0];
  render(); await Promise.resolve();
  assert.equal(welcome().props.headline, 'uz:welcomeToAccord');
  t.mock.timers.tick(5000);
  assert.equal(welcome().props.headline, 'en:welcomeToAccord');
  assert.equal(welcome().props.startLabel, 'en:getStarted');
  t.mock.timers.tick(5790);
  assert.equal(welcome().props.languageLabel, 'ru:languageTitle');
  welcome().props.onStart();
  const login = nodes(render(), node => node.type === 'LoginScreen')[0];
  assert.ok(login); login.props.onBack();
  welcome().props.onLanguage();
  let tree = render(); assert.equal(nodes(tree, node => node.type === 'BottomSheet')[0].props.isPresented, true);
  const languageSheet = nodes(tree, node => node.type === 'BottomSheet')[0];
  assert.equal(languageSheet.props.children.type, 'RNHostView', 'native sheet content must bridge before nesting a React Native Host');
  assert.deepEqual(languageSheet.props.children.props.matchContents, { vertical: true });
  assert.equal(languageSheet.props.children.props.children.type, 'Host');
  assert.equal(languageSheet.props.children.props.children.props.style.width, '100%');
  assert.equal(nodes(languageSheet, node => node.type === 'Button').length, 5);
  nodes(tree, node => node.type === 'Button' && node.props.label.startsWith('uz:english'))[0].props.onPress();
  assert.equal(welcome().props.languageValue, 'en:english');
  t.mock.timers.tick(30000);
  assert.equal(welcome().props.headline, 'en:welcomeToAccord');
  welcome().props.onTheme(); tree = render();
  const themeSheet = nodes(tree, node => node.type === 'BottomSheet')[0];
  assert.equal(themeSheet.props.children.type, 'RNHostView');
  assert.equal(nodes(themeSheet, node => node.type === 'Button').length, 8);
  nodes(tree, node => node.type === 'Button' && node.props.label.startsWith('en:themeMossLabel'))[0].props.onPress();
  assert.equal(theme.variant, 'moss'); assert.equal(welcome().props.themeValue, 'en:themeMossLabel');
  react.unmount();
});

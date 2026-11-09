const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
function setup() {
  let active = null, epoch = 1, generation = 1;
  const issued = new WeakSet();
  const { sessionReadScope } = load('sessionReadScope.ts');
  const witness = session => {
    const value = { session, epoch, generation, scope: sessionReadScope(session) }; issued.add(value); return value;
  };
  const auth = { isSessionWitnessCurrent: value => {
    const current = !!value && issued.has(value) && active === value.session && value.epoch === epoch &&
      value.generation === generation && value.scope === sessionReadScope(value.session);
    if (!current && value) issued.delete(value);
    return current;
  } };
  const { createBoyoqchiProfileSettingsSlot } = load('boyoqchi/boyoqchiProfileSettingsSlot.ts', { '../auth': auth });
  const actual = createBoyoqchiProfileSettingsSlot(), slot = { ...actual, register: (session, open) => actual.register(witness(session), open) };
  const session = () => ({ token: 'token', baseUrl: 'https://one.invalid', profile: { role: 'boyoqchi', ref: 'ref' },
    capabilities: ['boyoqchi.access'], assigned_apparatus: [] });
  return { slot, session, setActive: value => { if (active !== value) generation++; active = value; },
    advanceEpoch: () => { epoch++; }, transition: () => { generation++; } };
}

test('registration is focus-scoped and old handles cannot open a superseding screen or session', () => {
  const f = setup(), a = f.session(), b = f.session(); f.setActive(a);
  let callsA = 0, callsB = 0, changes = 0;
  const unsubscribe = f.slot.subscribe(() => changes++);
  const stopA = f.slot.register(a, () => callsA++), handleA = f.slot.getSnapshot();
  handleA.open(); assert.equal(callsA, 1);
  const stopB = f.slot.register(a, () => callsB++), handleB = f.slot.getSnapshot();
  stopA(); handleA.open(); assert.equal(callsA, 1); handleB.open(); assert.equal(callsB, 1);
  f.setActive(b); handleB.open(); assert.equal(callsB, 1);
  const stopC = f.slot.register(b, () => callsB++), handleC = f.slot.getSnapshot();
  handleB.open(); handleC.open(); assert.equal(callsB, 2);
  stopB(); assert.equal(f.slot.getSnapshot(), handleC);
  stopC(); assert.equal(f.slot.getSnapshot(), null); handleC.open(); assert.equal(callsB, 2);
  assert.equal(changes, 4); unsubscribe();
});

test('failed-login rollback and same-object scope changes invalidate old openers but token refresh does not', () => {
  const f = setup(), a = f.session(), b = f.session(); let calls = 0; f.setActive(a);
  const stop = f.slot.register(a, () => calls++), old = f.slot.getSnapshot();
  f.advanceEpoch(); f.setActive(b); f.setActive(a); old.open(); assert.equal(calls, 0);
  stop(); f.slot.register(a, () => calls++); const current = f.slot.getSnapshot(); current.open(); assert.equal(calls, 1);
  a.token = 'new-token'; current.open(); assert.equal(calls, 2, 'same-session token refresh remains valid');
  a.capabilities.push('other.access'); current.open(); assert.equal(calls, 2);
  a.capabilities.pop(); a.assigned_apparatus.push('machine'); current.open(); assert.equal(calls, 2);
  a.assigned_apparatus.pop(); current.open(); assert.equal(calls, 2, 'an observed invalid opener cannot revive');
});

test('header button opens the actual shared Settings once and a blurred header cannot open it again', () => {
  const f = setup(), session = f.session(); f.setActive(session);
  const hooks = []; let cursor = 0, focusEffect, writes = 0;
  const react = { createContext: () => ({ Provider: 'Provider' }), useContext: () => f.slot,
    useRef: value => ({ current: value }), useSyncExternalStore: (_subscribe, get) => get(), useCallback: fn => fn,
    useState: initial => { const i = cursor++; if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = value; if (i === 0 && value === true) writes++; }]; } };
  const ui = new Proxy({}, { get: (_target, name) => String(name) });
  const modifiers = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}), capsule: () => ({}) } },
    { get: (target, name) => target[name] ?? (() => ({})) });
  const { ProfileView } = load('components/ProfileView.ios.tsx', {
    react, 'expo-router': { useFocusEffect: fn => { focusEffect = fn; } }, '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { PlatformColor: value => value },
    '../profileModel': { profileDisplay: () => ({ name: 'Name', role: 'Role', phone: '', legalName: '', apparatusLabels: [] }) },
    '../shared/themeRuntime': { themeController: { setThemeMode: async () => {} } }, './BaseHost': { BaseHost: 'BaseHost' },
    './ProfileSettings.ios': { ProfileSettings: 'ProfileSettings' }, './useBaseLocale.ios': { useBaseLocale: () => ({ text: key => key }) },
    './useSwitchPinSetup.ios': { useSwitchPinSetup: () => ({ busy: false, close() {} }) },
  });
  const { BoyoqchiProfileSettingsButton } = load('boyoqchi/BoyoqchiProfileSettings.ios.tsx', {
    react, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    './boyoqchiProfileSettingsSlot': { createBoyoqchiProfileSettingsSlot: () => f.slot },
    './useBoyoqchiText': { useBoyoqchiGetter: () => key => key },
  });
  const props = { session, snapshot: { profile: {} }, editing: false, busy: false, onRefresh: async () => {}, onOpenEditor() {},
    onCloseEditor() {}, onLogout() {}, registerSettingsOpener: open => f.slot.register(session, open) };
  const render = () => {
    cursor = 0; const tree = ProfileView(props);
    const child = tree.props.children.find(node => typeof node?.type === 'function' && node.type.name === 'SettingsOpenerRegistration');
    if (child) child.type(child.props);
    return tree;
  };
  render(); assert.equal(BoyoqchiProfileSettingsButton(), null);
  const blur = focusEffect(), button = BoyoqchiProfileSettingsButton().props.children;
  assert.equal(button.props.label, 'profileSettingsTitle'); assert.equal(button.props.systemImage, 'slider.horizontal.3');
  button.props.onPress(); assert.equal(writes, 1); render(); assert.equal(hooks[0].value, true);
  blur(); assert.equal(BoyoqchiProfileSettingsButton(), null); button.props.onPress(); assert.equal(writes, 1);
});


test('a transition invalidates a retained Profile opener before focus cleanup runs', () => {
  const f = setup(), a = f.session(); f.setActive(a); let calls = 0;
  f.slot.register(a, () => calls++); const opener = f.slot.getSnapshot(); f.transition(); opener.open();
  assert.equal(calls, 0);
});

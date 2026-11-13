/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('retained Profile screens refresh on focus and resume only while visible', async () => {
  const effects = [], listeners = new Set(); let focusEffect, reads = 0;
  const react = { useCallback: fn => fn, useEffect: fn => effects.push(fn), useRef: value => ({ current: value }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { useFocusEffect: fn => { focusEffect = fn; } },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert() {} }, AppState: { addEventListener: (_name, callback) => {
      listeners.add(callback); return { remove: () => listeners.delete(callback) };
    } } },
    '../auth': { activeSessionToken: () => 'token' },
    '../profileAvatarUpload': { AvatarUploadError: class extends Error {} },
    '../profileModel': { initialProfileSnapshot: session => ({ profile: session.profile }), profileSnapshotFromResponse: session => ({ profile: session.profile }) },
    '../profileNameUpdate': {}, '../profileApi': { profile: async () => { reads++; return {}; } },
    '../shared/profileEditing': {}, '../shared/profileAvatarRuntime': { cachedProfileAvatar: () => null, ensureProfileAvatar: async () => null, refreshProfileAvatar: async () => null },
    '../shared/profileSessionGuard': { isProfileSessionCurrent: () => true }, '../shared/localization': {},
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './ProfileView': { ProfileView: 'ProfileView' },
  };
  const filename = path.resolve(__dirname, '../src/components/ProfileScreen.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const wrapper = mod.exports.ProfileScreen({ session: { imageCacheScope: 'account', profile: {} }, onLogout() {} });
  wrapper.type(wrapper.props); const cleanups = effects.map(effect => effect()).filter(Boolean);
  let blur = focusEffect(); await tick(); assert.equal(reads, 1); assert.equal(listeners.size, 1);
  for (const listener of listeners) listener('active'); await tick(); assert.equal(reads, 2);
  blur(); assert.equal(listeners.size, 0);
  for (const listener of listeners) listener('active'); await tick(); assert.equal(reads, 2, 'app resume must not reload a hidden Profile');
  blur = focusEffect(); await tick(); assert.equal(reads, 3, 'reentering Profile still refreshes it');
  blur(); cleanups.forEach(cleanup => cleanup()); assert.equal(listeners.size, 0);
});

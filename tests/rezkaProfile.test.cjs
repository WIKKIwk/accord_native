const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
test('master Profile reuses the shared guarded page and hides unguarded settings', () => {
  const calls = []; let current = true, locale = 'uz';
  const filename = path.resolve(__dirname, '../src/rezka/RezkaProfile.tsx'), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn }, '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    './rezkaSessionGuard': { isRezkaSessionCurrent: (_snapshot, access) => current && access === 'master' }, './useRezkaShell': { useRezkaLocale: () => locale } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const snapshot = { session: { profile: { role: 'rezka_master' } } };
  const props = { snapshot, onLogout: () => calls.push('logout'), onDailyWork: () => calls.push('daily') };
  const view = mod.exports.RezkaProfile(props); assert.equal(view.type, 'ProfileScreen'); assert.equal(view.props.session, snapshot.session);
  assert.equal(view.props.isCurrent(), true); assert.equal(view.props.settingsUnavailableMessage, 'Profil sozlamalari hozircha mavjud emas.');
  view.props.onDailyWork(); view.props.onLogout(); assert.deepEqual(calls, ['daily', 'logout']);
  current = false; assert.equal(view.props.isCurrent(), false); view.props.onDailyWork(); view.props.onLogout(); assert.deepEqual(calls, ['daily', 'logout']);
  assert.equal(mod.exports.RezkaProfile(props), null); current = true; locale = 'en';
  assert.equal(mod.exports.RezkaProfile(props).props.settingsUnavailableMessage, 'Profile settings are not available yet.');
});

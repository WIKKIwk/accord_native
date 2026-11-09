const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await tick();
  assert.ok(predicate(), 'expected asynchronous step');
}
function loadTs(file, mocks = {}) {
  const filename = path.join(root, 'src', file), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name]
    : name === 'expo/fetch' ? require('./expoFetch.cjs') : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
function authHarness() {
  const filename = path.join(root, 'tests/authLoginRollback.test.cjs'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded._compile(fs.readFileSync(filename, 'utf8').split("test('failed login retains")[0]
    + '\nmodule.exports = { auth };', filename);
  return loaded.exports.auth({});
}
function mountLive(auth, transport = loadTs('authorizedFetch.ts', { './auth': auth })) {
  const listeners = new Set(), nativeListeners = new Set(), opens = [], stops = [], sent = [];
  const app = { currentState: 'active', addEventListener: (_type, listener) => {
    listeners.add(listener); return { remove: () => listeners.delete(listener) };
  } };
  const native = {
    addListener: (_type, listener) => { nativeListeners.add(listener); return { remove: () => nativeListeners.delete(listener) }; },
    open: (origin, ticket) => { const id = String(opens.length + 1); opens.push({ id, origin, ticket }); return id; },
    send: (id, value) => { sent.push({ id, value }); return true; }, stop: id => stops.push(id),
  };
  const socket = loadTs('shared/chat/chatSecureSocket.ts', {
    '../../../modules/accord-chat-secure/src/AccordChatSecureModule': { chatSecureNativeModule: () => native },
    '../../auth': auth,
  });
  const live = loadTs('chatLive.ts', { './auth': auth, './authorizedFetch': transport,
    './shared/chat/chatSecureSocket': socket, 'react-native': { AppState: app } });
  return { ...live, opens, stops, sent,
    state(value) { app.currentState = value; for (const listener of [...listeners]) listener(value); },
    event(id, type, value = '') { for (const listener of [...nativeListeners]) listener({ session: id, type, value }); },
  };
}
module.exports = { authHarness, loadTs, mountLive, tick, until };

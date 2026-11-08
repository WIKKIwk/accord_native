const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(runtime = null, role = 'customer', policy = 'legacy', nativeAvailable = true) {
  let focusEffect, appStateListener, liveInvalidation, runtimeInvalidation;
  const calls = [];
  const appState = { currentState: 'active', addEventListener: (_, callback) => {
    appStateListener = callback;
    return { remove: () => { appStateListener = undefined; } };
  } };
  const react = {
    useState: initial => [typeof initial === 'function' ? initial() : initial, value => calls.push(['setState', value])],
    useRef: initial => ({ current: initial }), useCallback: callback => callback,
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  if (runtime) runtime.subscribeInvalidation = callback => {
    calls.push(['runtimeSubscribe']); runtimeInvalidation = callback;
    return () => { calls.push(['runtimeUnsubscribe']); runtimeInvalidation = undefined; };
  };
  const filename = path.resolve(__dirname, '../src/shared/chat/useChatConversations.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const mocks = {
    react, 'expo-router': { useFocusEffect: callback => { focusEffect = callback; } }, 'react-native': { AppState: appState },
    '../../auth': { activeSessionToken: () => 'token' },
    '../../chatApi': { loadChatConversations: async () => { calls.push(['load']); return { items: [], hasMore: false }; } },
    '../../chatLive': { subscribeChatLive: (_session, callback) => {
      calls.push(['existingLive']); liveInvalidation = callback;
      return () => { calls.push(['stopExistingLive']); liveInvalidation = undefined; };
    } },
    '../../components/ChatMetadata': { useChatMetadata: () => ({ remember: () => {} }) },
    './chatUnreadRuntime': { existingChatUnreadRuntimeFor: () => runtime, subscribeChatUnreadRuntimeChanges: () => () => {} },
    './ChatLivePolicy': { useChatLivePolicy: () => policy },
    './chatSecureSocket': { SECURE_CHAT_UNAVAILABLE: 'development build required' },
    './secureChatLive': { subscribeSecureChatLive: (_session, callback) => {
      if (!nativeAvailable) throw new Error('development build required');
      calls.push(['secureLive']); liveInvalidation = callback;
      return () => { calls.push(['stopSecureLive']); liveInvalidation = undefined; };
    } },
  };
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  loaded.exports.useChatConversations({ token: 'token', profile: { role, ref: 'one' } });
  let cleanup;
  return { calls, focus: () => { cleanup = focusEffect(); }, blur: () => cleanup?.(),
    invalidate: () => (runtime ? runtimeInvalidation : liveInvalidation)?.(),
    state: value => { appState.currentState = value; appStateListener?.(value); } };
}

test('non-opted worker and preparation list paths retain their existing live subscription', async () => {
  for (const role of ['aparatchi', 'tayyorlov_masteri']) {
    const f = fixture(null, role);
    f.focus();
    try {
      await tick();
      f.invalidate();
      await tick();
      assert.equal(f.calls.filter(call => call[0] === 'load').length, 2);
      assert.ok(f.calls.some(call => call[0] === 'existingLive'));
      assert.ok(!f.calls.some(call => call[0] === 'runtimeSubscribe'));
    } finally { f.blur(); }
    assert.ok(f.calls.some(call => call[0] === 'stopExistingLive'));
  }
});

test('a secure list never starts the legacy socket before its runtime exists or in Expo Go', async () => {
  for (const available of [true, false]) {
    const f = fixture(null, 'customer', 'secure', available);
    f.focus();
    try {
      await tick();
      assert.ok(!f.calls.some(call => call[0] === 'existingLive'));
      assert.equal(f.calls.some(call => call[0] === 'secureLive'), available);
      if (!available) assert.ok(f.calls.some(call => call[0] === 'setState' && call[1] === 'development build required'));
    } finally { f.blur(); }
    if (available) assert.ok(f.calls.some(call => call[0] === 'stopSecureLive'));
  }
});

test('an opted-in list shares runtime invalidations and unsubscribes on blur', async () => {
  const f = fixture({});
  f.focus();
  try {
    await tick();
    f.invalidate();
    await tick();
    assert.equal(f.calls.filter(call => call[0] === 'load').length, 2);
    assert.ok(f.calls.some(call => call[0] === 'runtimeSubscribe'));
    assert.ok(!f.calls.some(call => call[0] === 'existingLive'));
    f.state('background');
    f.invalidate();
    await tick();
    assert.equal(f.calls.filter(call => call[0] === 'load').length, 2);
    f.state('active');
    await tick();
    assert.equal(f.calls.filter(call => call[0] === 'load').length, 3);
  } finally { f.blur(); }
  assert.ok(f.calls.some(call => call[0] === 'runtimeUnsubscribe'));
  f.invalidate();
  await tick();
  assert.equal(f.calls.filter(call => call[0] === 'load').length, 3);
});

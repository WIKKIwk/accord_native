const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const guard = load('shared/profileSessionGuard.ts');
const parser = load('authenticateAccount.ts', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
const scope = load('sessionReadScope.ts');
function fixture(onRefresh = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'one', display_name: 'Old' },
    capabilities: ['admin.access'], assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: 'scope' };
  let allowed = true, active = session, saves = 0;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; onRefresh(() => { allowed = false; }, () => { active = { ...value }; }); return true; },
    saveSession: async () => { saves++; } };
  const transport = load('authorizedFetch.ts', { './auth': auth });
  const shared = load('shared/profileApi.ts', { '../auth': auth, '../authorizedFetch': transport, '../authenticateAccount': parser, './profileSessionGuard': guard });
  const reader = load('profileApi.ts', { './auth': auth, './authorizedFetch': transport, './sessionReadScope': scope,
    './workerControlsApi': { WorkerControlException: class extends Error {} }, './authenticateAccount': parser, './shared/profileSessionGuard': guard });
  return { session, shared, reader, isCurrent: () => allowed, deny: () => { allowed = false; }, saves: () => saves };
}
const payload = () => ({ role: 'admin', ref: 'one', display_name: 'New', capabilities: ['admin.access'], assigned_apparatus: [],
  assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [] });
test('optional profile guard accepts only synchronous true and fails closed on async, thrown and reentrant checks', async () => {
  assert.equal(guard.isProfileSessionCurrent(), true); assert.equal(guard.isProfileSessionCurrent(() => true), true);
  for (const value of [() => false, () => null, () => undefined, () => 1, () => { throw Error('stale'); }, async () => true, () => Promise.reject(Error('no')),
    () => ({ then(_resolve, reject) { reject(Error('no')); } })]) assert.equal(guard.isProfileSessionCurrent(value), false);
  const inner = () => true, outer = () => { guard.isProfileSessionCurrent(inner); return true; };
  assert.equal(guard.isProfileSessionCurrent(outer), false); await new Promise(resolve => setImmediate(resolve));
});
for (const method of ['nickname', 'avatar']) test(`${method} guard blocks initial send and 401 retry after a witness transition`, async () => {
  const f = fixture(deny => deny()), original = global.fetch; let sends = 0;
  const call = () => method === 'nickname' ? f.shared.updateNickname(f.session, 'New', undefined, f.isCurrent)
    : f.shared.uploadAvatar(f.session, Uint8Array.of(1, 2), 'a.jpg', undefined, f.isCurrent);
  f.deny(); global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  try { await assert.rejects(call(), /Profile session changed/); assert.equal(sends, 0); } finally { global.fetch = original; }
  const g = fixture(deny => deny()); sends = 0;
  global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify(payload()), { status: 200 }); };
  try {
    const result = method === 'nickname' ? g.shared.updateNickname(g.session, 'New', undefined, g.isCurrent)
      : g.shared.uploadAvatar(g.session, Uint8Array.of(1, 2), 'a.jpg', undefined, g.isCurrent);
    await assert.rejects(result, /Profile session changed/); assert.equal(sends, 1);
    assert.equal(g.session.profile.display_name, 'Old'); assert.equal(g.saves(), 0);
  } finally { global.fetch = original; }
});
for (const method of ['nickname', 'avatar', 'read']) test(`${method} rejects a transition while decoding the response before updating session`, async () => {
  const f = fixture(), original = global.fetch;
  global.fetch = async () => ({ status: 200, headers: new Headers(), clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    json: async () => { f.deny(); return payload(); } });
  try {
    const result = method === 'nickname' ? f.shared.updateNickname(f.session, 'New', undefined, f.isCurrent)
      : method === 'avatar' ? f.shared.uploadAvatar(f.session, Uint8Array.of(1), 'a.jpg', undefined, f.isCurrent)
        : f.reader.profile(f.session, false, f.isCurrent);
    await assert.rejects(result); assert.equal(f.session.profile.display_name, 'Old'); assert.equal(f.saves(), 0);
  } finally { global.fetch = original; }
});
test('a token-only 401 refresh preserves an unchanged witness and saves the server response', async () => {
  const f = fixture(), original = global.fetch; let sends = 0;
  global.fetch = async () => ++sends === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify(payload()), { status: 200 });
  try { await f.shared.updateNickname(f.session, 'New', undefined, f.isCurrent); assert.equal(sends, 2);
    assert.equal(f.session.profile.display_name, 'New'); assert.equal(f.saves(), 1); }
  finally { global.fetch = original; }
});
test('avatar cache refuses a late download after the witness changes', async () => {
  const { ProfileAvatarCache } = load('shared/profileAvatarCache.ts', { './profileSessionGuard': guard });
  const cache = new ProfileAvatarCache(), account = { baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one', avatar_url: 'https://cdn.example/a' } };
  let allowed = true, finish; const pending = cache.refresh(account, () => new Promise(resolve => { finish = resolve; }), () => allowed);
  allowed = false; finish({ bytes: Uint8Array.of(1, 2, 3) }); assert.equal(await pending, null); assert.equal(cache.get(account), null);
});
test('guarded avatar download neither sends bearer credentials nor caches after a transition', async () => {
  const original = global.fetch, requests = []; let allowed = true;
  global.fetch = async (url, init) => { requests.push({ url, init }); return { status: 200, headers: new Headers(),
    arrayBuffer: async () => { allowed = false; return Uint8Array.of(1, 2).buffer; } }; };
  try {
    const cache = load('shared/profileAvatarCache.ts', { './profileSessionGuard': guard });
    const runtime = load('shared/profileAvatarRuntime.ts', { '../auth': { activeSessionToken: () => 'token', registerSessionResetHook: () => {} },
      '../profileModel': load('profileModel.ts'), './profileAvatarCache': cache, './profileSessionGuard': guard });
    const profile = { role: 'admin', ref: 'one', avatar_url: 'https://cdn.example/image' }, session = { baseUrl: 'https://server.example', profile, imageCacheScope: 'x' };
    assert.equal(await runtime.ensureProfileAvatar(session, profile, () => allowed), null);
    assert.equal(requests.length, 1); assert.equal(requests[0].init.headers, undefined); assert.equal(requests[0].init.credentials, 'omit');
    assert.equal(runtime.cachedProfileAvatar(session, profile), null);
  } finally { global.fetch = original; }
});
function profileViewFixture(initialCurrent = true) {
  let current = initialCurrent, picker = 0, camera = 0, saves = 0, profileReads = 0; const writes = [];
  const react = { useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }),
    useState: value => [typeof value === 'function' ? value() : value, next => writes.push(next)], useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { react, 'expo-document-picker': { getDocumentAsync: async () => { picker++; return { canceled: true }; } },
    'expo-image-picker': { requestCameraPermissionsAsync: async () => { current = false; return { granted: true }; },
      launchCameraAsync: async () => { camera++; return { canceled: true }; }, MediaTypeOptions: {}, MediaType: {},
      MediaTypes: {}, Media: {}, MediaTypeSpecifier: {}, MediaTypeOptionsValue: {}, MediaTypeValue: {},
      ImagePickerPreferredAssetRepresentationMode: { Current: 'current' } },
    'expo-router': { useFocusEffect: fn => { void fn(); } }, 'react-native': { Alert: { alert() {} },
      AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' } },
    '../auth': { activeSessionToken: () => 'token' }, '../profileModel': { initialProfileSnapshot: () => ({ profile: {} }), profileDisplay: () => ({ name: 'Old' }),
      profileSnapshotFromResponse: () => null }, '../profileNameUpdate': { updateProfileName: async () => { saves++; } },
    '../profileAvatarUpload': { AvatarUploadError: class extends Error {}, uploadProfileAvatar: async () => { saves++; } },
    '../profileApi': { profile: async () => { profileReads++; return {}; } }, '../shared/profileEditing': { profileNickname: x => x, saveProfileChanges: async () => null },
    '../shared/profileAvatarRuntime': { cachedProfileAvatar: () => null, ensureProfileAvatar: async () => null, refreshProfileAvatar: async () => null },
    '../shared/profileSessionGuard': guard, '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } }, './ProfileView': { ProfileView: 'ProfileView' } };
  const Screen = load('components/ProfileScreen.tsx', mocks).ProfileScreen;
  const wrapper = Screen({ session: { token: 'token', imageCacheScope: 'x', profile: {} }, onLogout() {}, isCurrent: () => current });
  return { view: wrapper.type(wrapper.props), writes, counts: () => ({ picker, camera, saves, profileReads }), setCurrent: value => { current = value; } };
}
test('stale Profile callbacks do not start edits, picker or saves', async () => {
  const f = profileViewFixture(true), before = f.counts(); f.writes.length = 0; f.setCurrent(false);
  f.view.props.onOpenEditor(); f.view.props.onChangeName('New'); await f.view.props.onChoosePhoto('file'); await f.view.props.onSave();
  assert.deepEqual(f.counts(), before); assert.deepEqual(f.writes, []);
});
test('an already invalid witness renders no Profile view or avatar', () => {
  const f = profileViewFixture(false); assert.equal(f.view, null); assert.equal(f.counts().profileReads, 0);
});
test('camera permission completion rechecks witness before launching the picker', async () => {
  const f = profileViewFixture(true); await f.view.props.onChoosePhoto('camera'); assert.equal(f.counts().camera, 0);
});
for (const platform of ['ios', 'android', 'web']) test(`${platform} opt-in hides Settings/PIN entry while leaving existing defaults intact`, () => {
  const hooks = { useCallback: fn => fn, useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }),
    useState: value => [typeof value === 'function' ? value() : value, () => {}], useSyncExternalStore: (_s, get) => get() };
  const ui = new Proxy({}, { get: (_target, name) => name === 'FieldGroup' ? Object.assign(() => {}, { Section: 'FieldSection' })
    : name === 'useNativeState' ? value => value : String(name) });
  const mods = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}), capsule: () => ({}) } }, { get: (target, name) => target[name] ?? (() => ({})) });
  const sheet = { isOpen: () => false, open() { throw Error('must not open'); }, close() {}, update() {} };
  const mocks = { react: hooks, 'expo-router': { useFocusEffect() {} }, '@expo/ui': ui, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: () => ({}) },
    'react-native': { Alert: { alert() {} }, useColorScheme: () => 'light', PlatformColor: value => value },
    '../profileModel': { profileDisplay: () => ({ name: 'Name', role: 'Role', phone: '', legalName: '', apparatusLabels: [] }) },
    '../nativeSheet': { useNativeSheet: () => sheet }, '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    '../shared/themeRuntime': { themeController: { setThemeMode: async () => {} } }, './BaseHost': { BaseHost: 'BaseHost' },
    './useBaseTheme': { useBaseTheme: () => ({ colors: {} }) }, './useBaseLocale.ios': { useBaseLocale: () => ({ text: key => key }) },
    './useSwitchPinSetup.ios': { useSwitchPinSetup: () => ({ busy: false, close() {} }) },
    './ProfileSettings': { ProfileSettings: 'ProfileSettings' }, './ProfileSettings.ios': { ProfileSettings: 'ProfileSettings' } };
  const file = platform === 'web' ? 'ProfileView.tsx' : `ProfileView.${platform}.tsx`;
  const View = load(`components/${file}`, mocks).ProfileView;
  const tree = View({ session: { profile: { role: 'admin' } }, snapshot: { profile: {} }, editing: false, busy: false,
    onRefresh: async () => {}, onOpenEditor() {}, onCloseEditor() {}, onLogout() {}, settingsUnavailableMessage: 'Settings unavailable',
    registerSettingsOpener: () => { throw Error('must not register'); } });
  assert.equal(nodes(tree, n => n.props?.children === 'Settings unavailable').length, 1);
  assert.equal(nodes(tree, n => n.type === 'ProfileSettings' || n.props?.testID === 'profile-settings' ||
    (typeof n.type === 'function' && n.type.name === 'SettingsOpenerRegistration')).length, 0);
});

for (const method of ['read', 'nickname', 'avatar']) test(`${method} opt-in refuses a different response identity before applying it`, async () => {
  const f = fixture(), original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ ...payload(), ref: 'other' }), { status: 200 });
  try {
    const result = method === 'read' ? f.reader.profile(f.session, false, f.isCurrent)
      : method === 'nickname' ? f.shared.updateNickname(f.session, 'Name', undefined, f.isCurrent)
        : f.shared.uploadAvatar(f.session, Uint8Array.of(1), 'a.jpg', undefined, f.isCurrent);
    await assert.rejects(result, /Profile identity changed/);
    assert.equal(f.session.profile.ref, 'one'); assert.equal(f.session.profile.display_name, 'Old'); assert.equal(f.saves(), 0);
  } finally { global.fetch = original; }
});
test('guarded avatar preparation aborts after a transition without uploading', async () => {
  let allowed = true, uploads = 0, released = 0;
  class File { constructor(uri) { this.uri = uri; this.name = 'photo.jpg'; } async bytes() { return Uint8Array.of(1); } delete() {} }
  const api = load('profileAvatarUpload.ts', { 'expo-file-system': { File }, 'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: () => ({ async renderAsync() { allowed = false; return { async saveAsync() { return { uri: 'file:///tmp.jpg' }; }, release() { released++; } }; },
      release() { released++; } }) } }, 'react-native': { Platform: { OS: 'ios' } }, './auth': { activeSessionToken: () => 'token' },
    './profileModel': load('profileModel.ts'), './shared/profileApi': { uploadAvatar: async () => { uploads++; } },
    './shared/profileAvatarRuntime': { cacheProfileAvatarBytes() {} }, './shared/profileSessionGuard': guard });
  await assert.rejects(api.uploadProfileAvatar({ profile: {}, assigned_apparatus_labels: [] }, 'file:///photo.jpg', new AbortController().signal, 'photo.jpg', () => allowed));
  assert.equal(uploads, 0); assert.equal(released, 2);
});

test('real witness blocks a queued Profile write while failed login retains the old active token', async () => {
  let rejectLogin, authenticationStarted; const started = new Promise(resolve => { authenticationStarted = resolve; });
  const chunks = load('chunkedStorage.ts');
  const auth = load('auth.ts', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': chunks,
    './serverEndpointRuntime': { initializeServerEndpoints: async () => ({ setBaseUrl: async value => value }) },
    './authenticateAccount': { authenticateAccount: () => { authenticationStarted(); return new Promise((_resolve, reject) => { rejectLogin = reject; }); } } });
  const session = { baseUrl: 'https://server.example', token: 'old', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access'],
    assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: 'one' };
  await auth.saveSession(session); const witness = auth.captureSessionWitness(session); assert.ok(witness);
  const login = auth.login('https://server.example', 'mock', 'mock'); await started;
  assert.equal(auth.activeSessionToken(session), 'old'); assert.equal(auth.isSessionWitnessCurrent(witness), false);
  const transport = load('authorizedFetch.ts', { './auth': auth }), shared = load('shared/profileApi.ts', { '../auth': auth,
    '../authorizedFetch': transport, '../authenticateAccount': parser, './profileSessionGuard': guard });
  const original = global.fetch; let sends = 0; global.fetch = async () => { sends++; return new Response('{}'); };
  try { await assert.rejects(shared.updateNickname(session, 'New', undefined, () => auth.isSessionWitnessCurrent(witness)), /Profile session changed/); assert.equal(sends, 0); }
  finally { global.fetch = original; }
  rejectLogin(Error('mock failed')); await assert.rejects(login, /mock failed/);
  assert.equal(auth.activeSessionToken(session), 'old'); assert.equal(auth.isSessionWitnessCurrent(witness), false);
});

test('disabling Profile settings skips the iOS switch-PIN read and cannot show its failure alert', async () => {
  let effect, reads = 0, alerts = 0;
  const react = { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: fn => { effect = fn; } };
  const core = load('components/useSwitchPinSetupCore.ts', { react, 'react-native': { Alert: { alert: () => { alerts++; } } },
    '../shared/switchPinRuntime': { switchPinStore: { has: async () => { reads++; throw Error('unavailable'); } } } });
  core.useSwitchPinSetupCore({ profile: {} }, { set() {} }, key => key, false); const cleanup = effect();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(cleanup, undefined); assert.equal(reads, 0); assert.equal(alerts, 0);
});
test('a genuine Profile scope update invalidates the original witness even when the old session object remains active', async () => {
  const chunks = load('chunkedStorage.ts'), auth = load('auth.ts', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': chunks });
  const session = { baseUrl: 'https://server.example', token: 'old', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access'],
    assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: 'one' };
  await auth.saveSession(session); const witness = auth.captureSessionWitness(session); assert.ok(witness);
  const shared = load('shared/profileApi.ts', { '../auth': auth, '../authorizedFetch': { authorizedFetch: async (_session, _path, _init, beforeSend) => {
    beforeSend(); return { status: 200, json: async () => ({ ...payload(), capabilities: ['admin.access', 'catalog.item.read'] }) };
  } }, '../authenticateAccount': parser, './profileSessionGuard': guard });
  await assert.rejects(shared.updateNickname(session, 'New', undefined, () => auth.isSessionWitnessCurrent(witness)), /Profile session changed/);
  assert.equal(auth.activeSessionToken(session), 'old'); assert.equal(auth.isSessionWitnessCurrent(witness), false);
  assert.deepEqual(session.capabilities, ['admin.access', 'catalog.item.read']);
});

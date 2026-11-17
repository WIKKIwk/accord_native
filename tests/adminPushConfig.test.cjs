const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === 'expo-document-picker') return { getDocumentAsync: async () => ({ canceled: true }) };
      if (id === 'expo-file-system') return { File: class { async bytes() { return new Uint8Array(); } } };
      if (id.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), id);
        for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(target + suffix)) return load(path.relative(path.resolve(__dirname, '../src'), target + suffix));
      }
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
    return mod.exports;
  }
  return load;
}
const load = loader(), model = load('admin/adminPushConfigModel.ts'), files = load('admin/adminPushConfigFiles.ts');
const { MobileApiException } = load('shared/mobileApiException.ts');
const account = { type: 'service_account', project_id: 'demo-project', client_email: 'push@example.test', private_key: 'synthetic-key' };
const status = (configured = true, extra = {}) => model.adminPushConfigFromJson({ configured, project_id: configured ? 'demo-project' : '', ...extra });
const encoded = (raw, name = 'service-account.json') => ({ name, size: new TextEncoder().encode(raw).length, bytes: new TextEncoder().encode(raw) });
const androidRaw = () => JSON.stringify({ project_info: { project_id: 'demo-project', project_number: '123' }, client: [
  { client_info: { android_client_info: { package_name: 'unrelated' } } },
  { client_info: { mobilesdk_app_id: '1:123:android:abc', android_client_info: { package_name: files.adminPushConfigApplication.android } }, api_key: [{ current_key: 'AIzaPublicTestKey' }] },
] });
const iosRaw = () => `<?xml version="1.0"?><plist version="1.0"><dict>
<key>PROJECT_ID</key><string>demo-project</string><key>GOOGLE_APP_ID</key><string>1:123:ios:abc</string>
<key>API_KEY</key><string>AIzaPublicTestKey</string><key>GCM_SENDER_ID</key><string>123</string>
<key>BUNDLE_ID</key><string>${files.adminPushConfigApplication.ios}</string><key>IS_ADS_ENABLED</key><false/></dict></plist>`;

// @v2-test test/admin_push_config_test.dart
test('service account entry rejects device tokens, preserves the full account and enforces UTF-8 byte limits', () => {
  assert.deepEqual(model.parseAdminPushConfigAccount(JSON.stringify(account)), account);
  assert.throws(() => model.parseAdminPushConfigAccount('fcm-device-token'), error => error.code === 'push_config_invalid_credentials');
  for (const value of [null, [], {}, { ...account, private_key: '  ' }, { ...account, type: 'token' }]) {
    assert.throws(() => model.parseAdminPushConfigAccount(JSON.stringify(value)), error => error.code === 'push_config_invalid_credentials');
  }
  assert.deepEqual(model.parseAdminPushConfigAccount(JSON.stringify({ ...account, project_id: 42 })), { ...account, project_id: 42 });
  assert.throws(() => model.parseAdminPushConfigAccount(JSON.stringify({ ...account, extra: 'é'.repeat(17000) })), error => error.code === 'push_config_invalid_credentials');
  assert.equal(model.readAdminPushConfigAccountFile(encoded(JSON.stringify(account), 'KEY.JSON')), JSON.stringify(account));
  assert.throws(() => model.readAdminPushConfigAccountFile(encoded(JSON.stringify(account), 'wrong.txt')), error => error.code === 'push_config_invalid_credentials');
  assert.throws(() => model.readAdminPushConfigAccountFile({ name: 'key.json', size: 1, bytes: new Uint8Array([255]) }));
});

test('server status retains only source metadata and decodes nested public mobile options without validating their identity', () => {
  const client = { project_id: 'old', app_id: 'old', api_key: 'old', messaging_sender_id: 'old', application_id: 'old' };
  const parsed = model.adminPushConfigFromJson({ configured: 1, project_id: 42, client_email: null, last_verified_at: 1.9,
    mobile: { android: client }, service_account: account });
  assert.equal(parsed.configured, false); assert.equal(parsed.project_id, '42'); assert.equal(parsed.last_verified_at, 1);
  assert.deepEqual(parsed.android, client); assert.equal(parsed.ios, null); assert.equal('service_account' in parsed, false);
  assert.throws(() => model.adminPushConfigFromJson({ last_verified_at: '1' }), TypeError);
  assert.throws(() => model.adminPushConfigFromJson({ mobile: { ios: {} } }), TypeError);
});

test('unknown Push status/error codes including object prototype names use the source failed fallback', () => {
  for (const code of ['unknown', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(model.adminPushConfigErrorKey(code), 'failed');
  assert.equal(model.adminPushConfigErrorKey('device_registered'), 'device_registered');
  assert.equal(model.adminPushConfigErrorKey('push_config_apns_unavailable'), 'apns_unavailable');
});

// @v2-test test/firebase_client_config_test.dart
test('Firebase Android files select the original application from several clients; iOS uses ordered XML element pairs', () => {
  const android = files.parseAdminPushConfigClientFile(androidRaw(), 'android');
  assert.equal(android.app_id, '1:123:android:abc'); assert.equal(android.project_id, 'demo-project');
  assert.equal('private_key' in android, false);
  const ios = files.parseAdminPushConfigClientFile(iosRaw(), 'ios');
  assert.equal(ios.app_id, '1:123:ios:abc'); assert.equal(ios.application_id, files.adminPushConfigApplication.ios);
  assert.throws(() => files.parseAdminPushConfigClientFile(iosRaw().replace('1:123:ios', '1:456:ios'), 'ios'));
  assert.throws(() => files.parseAdminPushConfigClientFile(iosRaw().replace('mirsaid', 'other'), 'ios'));
  assert.throws(() => files.parseAdminPushConfigClientFile(iosRaw().replace('</dict>', '</wrong>'), 'ios'));
  assert.throws(() => files.parseAdminPushConfigClientFile(JSON.stringify(account), 'android'));
  const mixed = iosRaw().replace('<key>PROJECT_ID</key><string>demo-project</string>', '<key>PROJECT_ID</key><!-- comment --><string>demo&#45;project</string>');
  assert.equal(files.parseAdminPushConfigClientFile(mixed, 'ios').project_id, 'demo-project');
  assert.throws(() => files.readAdminPushConfigClientFile({ ...encoded(iosRaw()), size: 131073 }, 'ios'), error => error.code === 'push_config_invalid_client_config');
});

test('admin Push API preserves source methods, bodies, content headers and the 40-second operation deadlines', async () => {
  const calls = []; let body = { configured: true }, statusCode = 200, current = true;
  const guard = () => { assert.equal(current, true); };
  const api = loader({ '../authorizedFetch': { authorizedFetch: async (_session, endpoint, init, beforeSend, timeout, options) => {
    beforeSend(); options?.readWitness(); calls.push({ endpoint, init, timeout }); return { status: statusCode, json: async () => body };
  } } })('admin/adminPushConfigApi.ts');
  const session = { token: 'synthetic-token' };
  await api.adminPushConfig(session, guard); await api.saveAdminPushConfig(session, account, guard);
  const client = files.parseAdminPushConfigClientFile(androidRaw(), 'android');
  await api.saveMobilePushConfig(session, 'android', client, guard); await api.checkAdminPushConfig(session, guard);
  body = { accepted_by_fcm: true }; await api.testAdminPushConfig(session, 'this-device-token', guard);
  assert.deepEqual(calls.map(call => [call.endpoint, call.init.method, call.timeout]), [
    ['/v1/mobile/admin/push-config', 'GET', 10000], ['/v1/mobile/admin/push-config', 'PUT', 40000],
    ['/v1/mobile/admin/push-config/mobile', 'PUT', 40000], ['/v1/mobile/admin/push-config/check', 'POST', 40000], ['/v1/mobile/admin/push-config/test', 'POST', 40000],
  ]);
  assert.ok(calls.every(call => call.init.headers['Content-Type'] === 'application/json'));
  assert.deepEqual(JSON.parse(calls[1].init.body), { service_account: account }); assert.deepEqual(JSON.parse(calls[2].init.body), { platform: 'android', config: client });
  assert.deepEqual(JSON.parse(calls[3].init.body), {}); assert.deepEqual(JSON.parse(calls[4].init.body), { token: 'this-device-token' });
  body = { accepted_by_fcm: false }; await assert.rejects(api.testAdminPushConfig(session, 'token', guard), error => error.code === 'push_config_test_failed');
  statusCode = 502; body = { error: 'push_config_google_rejected' };
  await assert.rejects(api.checkAdminPushConfig(session, guard), error => error.code === 'push_config_google_rejected' && error.statusCode === 502);
  current = false; const before = calls.length; await assert.rejects(api.adminPushConfig(session, guard)); assert.equal(calls.length, before);
  current = true; await assert.rejects(api.adminPushConfig({ token: 'test-mode-token' }, guard), error => error.code === 'push_config_test_mode');
});

test('API body-time account loss cannot publish a decoded configuration or success', async () => {
  let current = true;
  const guard = () => { if (!current) throw new Error('retired'); };
  const api = loader({ '../authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => { current = false; return { configured: true }; } }) } })('admin/adminPushConfigApi.ts');
  await assert.rejects(api.adminPushConfig({ token: 'x' }, guard), /retired/);
});

const tick = () => new Promise(resolve => setImmediate(resolve));
function controllerFixture() {
  let current = true, nextConfig = status(), deviceSnapshot = { status: 'device_not_checked', errorDetail: null }, chosen = null;
  const listeners = new Set(), calls = [], failures = {};
  const device = { getSnapshot: () => deviceSnapshot, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    async initialize(guard) { guard(); calls.push(['device']); }, async prepareConfigurationTest(guard) { guard(); calls.push(['token']); return 'phone-token'; } };
  const { AdminPushConfigController } = load('admin/adminPushConfigController.ts');
  const call = async (name, values, guard) => { guard(); calls.push([name, ...values]); if (failures[name]) throw failures[name]; return nextConfig; };
  const deps = { isCurrent: () => current, device, read: guard => call('read', [], guard), save: (value, guard) => call('save', [value], guard),
    check: guard => call('check', [], guard), test: (token, guard) => call('test', [token], guard), saveMobile: (platform, client, guard) => call('mobile', [platform, client], guard),
    pick: async (kind, guard) => { guard(); calls.push(['pick', kind]); return chosen; } };
  const controller = new AdminPushConfigController(deps); controller.start();
  return { controller, calls, deps, failures, choose: value => { chosen = value; }, configure: value => { nextConfig = value; }, retire: () => { current = false; },
    device: (status, errorDetail = null) => { deviceSnapshot = { status, errorDetail }; [...listeners].forEach(listener => listener()); } };
}
test('Push state separates server/device readiness, saves pasted and selected credentials, preserves failures and clears successful secrets', async () => {
  const f = controllerFixture(); await tick();
  assert.deepEqual(f.calls.slice(0, 2), [['read'], ['device']]); assert.equal(f.controller.getSnapshot().busy, false);
  f.controller.changeJson(JSON.stringify(account)); f.failures.save = new MobileApiException({ code: 'push_config_google_rejected', message: 'rejected' });
  await f.controller.save(); assert.equal(f.controller.getSnapshot().error, 'push_config_google_rejected');
  assert.ok(f.controller.getSnapshot().json.includes('synthetic-key')); assert.equal(f.controller.getSnapshot().config.configured, true);
  delete f.failures.save; await f.controller.save(); assert.equal(f.controller.getSnapshot().json, ''); assert.equal(f.controller.getSnapshot().notice, 'saved');
  f.choose(encoded(JSON.stringify(account))); await f.controller.pick();
  assert.equal(f.controller.getSnapshot().fileName, 'service-account.json'); assert.equal(f.calls.filter(call => call[0] === 'save').length, 2);
  await f.controller.save(); assert.equal(f.controller.getSnapshot().fileName, null);
  await f.controller.test(); assert.deepEqual(f.calls.slice(-2), [['token'], ['test', 'phone-token']]); assert.equal(f.controller.getSnapshot().notice, 'test_sent');
  f.failures.test = new MobileApiException({ code: 'push_config_apns_unavailable', message: 'pending' }); await f.controller.test();
  assert.equal(f.controller.getSnapshot().error, 'push_config_apns_unavailable'); f.device('device_registered'); assert.equal(f.controller.getSnapshot().error, null);
  f.controller.dispose();
});

test('mobile uploads send parsed public client fields and initialize the same device; canceled pick does not upload', async () => {
  const f = controllerFixture(); await tick(); const before = f.calls.length;
  await f.controller.pickMobile('android'); assert.deepEqual(f.calls.slice(before), [['pick', 'android']]);
  f.choose(encoded(androidRaw(), 'google-services.json')); await f.controller.pickMobile('android');
  const saved = f.calls.find(call => call[0] === 'mobile'); assert.equal(saved[1], 'android'); assert.equal(saved[2].application_id, files.adminPushConfigApplication.android);
  assert.equal('private_key' in saved[2], false); assert.equal(f.controller.getSnapshot().notice, 'mobile_saved'); assert.deepEqual(f.calls.at(-1), ['device']);
  f.controller.dispose();
});

test('unconfigured status disables check/test/client upload, and invalid credentials never send a save', async () => {
  const f = controllerFixture(); await tick(); f.configure(status(false)); await f.controller.reload(); const before = f.calls.length;
  await f.controller.check(); await f.controller.test(); await f.controller.pickMobile('ios'); assert.equal(f.calls.length, before);
  f.controller.changeJson('device-token'); await f.controller.save(); assert.equal(f.calls.length, before); assert.equal(f.controller.getSnapshot().error, 'push_config_invalid_credentials');
  f.controller.dispose();
});

test('account retirement while a native picker is open drops credentials and suppresses every subsequent request', async () => {
  const f = controllerFixture(); await tick(); let finish;
  f.deps.pick = () => new Promise(resolve => { finish = resolve; }); const picking = f.controller.pick();
  f.retire(); finish(encoded(JSON.stringify(account))); await picking;
  assert.equal(f.controller.getSnapshot().invalidated, true); assert.equal(f.controller.getSnapshot().json, '');
  const before = f.calls.length; await f.controller.reload(); await f.controller.save(); await f.controller.test(); assert.equal(f.calls.length, before);
});

test('effect cleanup and reattachment starts a fresh controller operation while old results remain retired', async () => {
  const f = controllerFixture(); await tick(); f.controller.changeJson(JSON.stringify(account));
  f.controller.dispose(); assert.equal(f.controller.getSnapshot().json, ''); f.controller.start(); await tick();
  assert.equal(f.controller.getSnapshot().invalidated, false); assert.equal(f.controller.getSnapshot().busy, false);
  assert.equal(f.calls.filter(call => call[0] === 'read').length, 2); f.controller.dispose();
});

test('original Push account scope and permissions gate every operation without capturing a replacement session', () => {
  let epoch = 1, token = 'token', scope = 'one', witnessCurrent = true;
  const session = { token: 'token', profile: { role: 'admin' } }, witness = { session };
  const ownerFactory = loader({ '../authorizedFetch': { authorizedFetch: async () => { throw new Error('must not send'); } },
    '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => token, isSessionWitnessCurrent: () => witnessCurrent },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminPushConfig: '/push' }, canOpenRoute: value => value.profile.role === 'admin' } })('admin/adminPushConfigSession.ts').adminPushConfigSession;
  const device = { subscribe: () => () => {}, getSnapshot: () => ({ status: 'device_not_checked', errorDetail: null }), async initialize() {}, async prepareConfigurationTest() { return 'token'; } };
  const owner = ownerFactory({ session, witness, isCurrent: () => true, device });
  assert.equal(owner.allowed(), true); token = 'refreshed'; assert.equal(owner.allowed(), true);
  scope = 'other'; assert.equal(owner.allowed(), false); scope = 'one'; assert.equal(owner.allowed(), false);
  const next = ownerFactory({ session, witness, isCurrent: () => true, device }); epoch++; assert.equal(next.current(), false);
  const nonAdmin = { token: 'token', profile: { role: 'aparatchi' } }, denied = ownerFactory({ session: nonAdmin, witness: { session: nonAdmin }, isCurrent: () => true, device });
  assert.equal(denied.current(), true); assert.equal(denied.allowed(), false);
  const asyncParent = ownerFactory({ session, witness, isCurrent: async () => true, device }); assert.equal(asyncParent.current(), false);
  witnessCurrent = false; assert.equal(ownerFactory({ session, witness, isCurrent: () => true, device }).current(), false);
});

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function render(node) {
  if (Array.isArray(node)) return node.map(render);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? [node.props?.label, text(node.props?.children)].filter(Boolean).join(' ') : '';
}
function viewFixture(platform, { busy = false, configured = true, allowed = true, current = true } = {}) {
  const calls = [], config = status(configured, { client_email: 'push@example.test', last_verified_at: 1 });
  const native = (name, slots = []) => { const fn = props => ({ type: name, props }); slots.forEach(slot => { fn[slot] = `${name}.${slot}`; }); return fn; };
  const field = native('OutlinedTextField', ['Label']), topBar = native('TopAppBar', ['NavigationIcon', 'Title']);
  const controls = new Proxy({ useNativeState: value => ({ get: () => value, set() {} }), TopAppBar: topBar,
    Shape: { RoundedCorner: value => value } }, { get: (obj, key) => obj[key] ?? String(key) });
  const modifiers = new Proxy({}, { get: (_obj, name) => (...args) => ({ name, args }) });
  const colors = { onSurface: 'text', onSurfaceVariant: 'secondary', surface: 'surface', primary: 'primary', onPrimary: 'white', error: 'error' };
  const value = { current, allowed, state: { config, busy, json: 'typed', fillVersion: 0, fileName: null, error: 'push_config_apns_unavailable', notice: 'verified' },
    deviceState: { status: 'device_not_checked', errorDetail: 'real-native-detail' }, enabled: allowed && !busy, configuredEnabled: allowed && !busy && configured,
    backLabel: 'Back', t: key => key, errorKey: model.adminPushConfigErrorKey, changeJson: value => calls.push(['json', value]),
    back: () => calls.push('back'), pick: () => calls.push('pick'), save: () => calls.push('save'), check: () => calls.push('check'), test: () => calls.push('test'),
    reload: () => calls.push('reload'), applyDevice: () => calls.push('apply'), pickMobile: platform => calls.push(['mobile', platform]) };
  const View = loader({ react: { useEffect() {}, useRef: current => ({ current }) }, 'react/jsx-runtime': jsx,
    'react-native': { View: 'View', Text: 'NativeText', StyleSheet: { create: value => value } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/ui/jetpack-compose': controls, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': controls, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, './AdminTypography.android': { AdminText: 'Text' },
    './AdminTextFields.android': { AdminOutlinedTextField: field }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    './useAdminPushConfig': { useAdminPushConfig: () => value } })(`admin/AdminPushConfigScreen.${platform}.tsx`).AdminPushConfigScreen;
  return { tree: render(View({})), calls };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Push form keeps source order, separate server/device status and real owner actions`, () => {
    const f = viewFixture(platform), words = text(f.tree);
    const order = ['device_title', 'instructions', 'pick', 'json', 'save', 'check', 'test', 'refresh', 'apns_unavailable', 'mobile_title', 'Android', 'google-services.json', 'iPhone', 'GoogleService-Info.plist', 'ios_hint'];
    let position = -1;
    for (const value of order) { const next = words.indexOf(value, position + 1); assert.ok(next > position, `${value}: ${words}`); position = next; }
    assert.ok(words.includes('configured')); assert.ok(words.includes('device_not_checked')); assert.ok(words.includes('real-native-detail'));
    const field = nodes(f.tree, node => node.type === (platform === 'android' ? 'OutlinedTextField' : 'TextField'))[0];
    if (platform === 'android') { assert.equal(field.props.minLines, 3); assert.equal(field.props.maxLines, 6); field.props.onValueChange('new'); }
    else { assert.equal(field.props.axis, 'vertical'); field.props.onTextChange('new'); }
    assert.deepEqual(f.calls, [['json', 'new']]);
    const button = nodes(f.tree, node => node.type === 'Button' && node.props.modifiers?.some(mod => mod.name === (platform === 'android' ? 'testID' : 'accessibilityIdentifier') && mod.args[0] === 'push-config-save'))[0];
    button.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.equal(f.calls.at(-1), 'save');
    assert.equal(words.includes('synthetic-key'), false);
  });
  test(`${platform} Push busy/unconfigured and forbidden states preserve V2 controls without enabling unavailable commands`, () => {
    const idName = platform === 'android' ? 'testID' : 'accessibilityIdentifier';
    const button = (tree, id) => nodes(tree, node => node.props.modifiers?.some(mod => mod.name === idName && mod.args[0] === id))[0];
    const enabled = node => platform === 'android' ? node.props.enabled : !node.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0] === true);
    for (const options of [{ busy: true }, { configured: false }]) {
      const f = viewFixture(platform, options);
      for (const id of ['push-config-check', 'push-config-test', 'push-config-android', 'push-config-ios']) assert.equal(enabled(button(f.tree, id)), false);
      if (options.busy) assert.equal(enabled(button(f.tree, 'push-config-save')), false);
    }
    for (const options of [{ allowed: false }, { current: false }]) {
      const f = viewFixture(platform, options); assert.equal(nodes(f.tree, node => node.type === 'TextField' || node.type === 'OutlinedTextField').length, 0);
      if (options.allowed === false) assert.ok(text(f.tree).includes('admin_only'));
    }
  });
}

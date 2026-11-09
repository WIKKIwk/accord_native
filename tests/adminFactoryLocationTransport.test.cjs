const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString'), scope = load('sessionReadScope');
function fixture(change = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'example' }, capabilities: ['factory.location.manage'] };
  let active = session, generation = 1;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { value.token = 'second'; change(value, () => { active = { ...value }; }, () => { generation++; }); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/factoryLocationApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception,
    './dartJsonString': dart, './adminApiError': { adminApiError: async () => new Error('response error') },
    './factoryLocationModel': { adminFactoryLocationFromJson: value => value } });
  const capturedScope = scope.sessionReadScope(session), capturedGeneration = generation;
  const guard = () => { if (!auth.activeSessionToken(session) || scope.sessionReadScope(session) !== capturedScope || generation !== capturedGeneration) throw new Error('scope changed'); };
  return { api, session, guard, isCurrent: () => !!auth.activeSessionToken(session), generation: () => generation };
}
const calls = [
  f => f.api.adminFactoryLocations(f.session, f.guard),
  f => f.api.adminCreateFactoryLocation(f.session, 'New', ['id'], f.guard),
  f => f.api.adminUpdateFactoryLocation(f.session, 'id', { name: 'New' }, f.guard),
  f => f.api.adminReplaceFactoryLocationApparatus(f.session, 'id', ['item'], f.guard),
];
for (const [index, action] of calls.entries()) {
  test(`factory operation ${index + 1} blocks a 401 retry after role, capability, account or generation changes`, async () => {
    for (const change of [(s) => { s.profile.role = 'brigader'; }, s => { s.capabilities = []; },
      (_s, switchAccount) => switchAccount(), (_s, _switchAccount, advance) => advance()]) {
      const f = fixture(change), original = global.fetch; let sends = 0;
      global.fetch = async () => { sends++; return sends === 1 ? new Response('', { status: 401 }) : new Response(index ? '{}' : '[]', { status: 200 }); };
      try { await assert.rejects(action(f)); assert.equal(sends, 1); } finally { global.fetch = original; }
    }
  });
}
test('factory mutation retries after a token-only refresh when scope and generation remain unchanged', async () => {
  const f = fixture(), original = global.fetch, tokens = [];
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization'));
    return tokens.length === 1 ? new Response('', { status: 401 }) : new Response('{"id":"new"}', { status: 200 }); };
  try { assert.deepEqual(await calls[1](f), { id: 'new' }); assert.deepEqual(tokens, ['Bearer first', 'Bearer second']); }
  finally { global.fetch = original; }
});

test('factory controller passes its generation guard through the real API and 401 retry', async () => {
  const f = fixture((_session, _switchAccount, advance) => advance()), original = global.fetch; let sends = 0;
  const editor = load('admin/factoryLocationEditorModel', { './dartJsonString': dart });
  const { FactoryLocationController } = load('admin/factoryLocationController', { '../shared/mobileApiException': exception,
    './dartJsonString': dart, './factoryLocationEditorModel': editor });
  const location = { id: 'id', name: 'State', active: true, apparatus: [], created_at_unix: 0, updated_at_unix: 0 };
  const controller = new FactoryLocationController({ isCurrent: f.isCurrent, generation: f.generation,
    scope: () => scope.sessionReadScope(f.session), canManage: () => f.session.capabilities.includes('factory.location.manage'),
    readLocations: async guard => { guard(); return [location]; }, readApparatus: async guard => { guard(); return []; },
    create: (name, ids, guard) => f.api.adminCreateFactoryLocation(f.session, name, ids, guard),
    replaceApparatus: (id, ids, guard) => f.api.adminReplaceFactoryLocationApparatus(f.session, id, ids, guard),
    update: (id, change, guard) => f.api.adminUpdateFactoryLocation(f.session, id, change, guard) });
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  try {
    controller.start(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(await controller.setActive('id', false), 'cancelled'); assert.equal(sends, 1);
    assert.equal(controller.getSnapshot().status, 'forbidden'); assert.deepEqual(controller.getSnapshot().locations, []);
  } finally { global.fetch = original; }
});

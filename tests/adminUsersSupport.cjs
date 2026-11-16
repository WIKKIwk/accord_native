const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const strings = load('admin/dartJsonString'), routes = load('shared/appRoutes');
const l10n = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const checked = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
const model = load('admin/adminUsersModel', { '../shared/localization': l10n, '../shared/appRoutes': routes,
  '../workerControlsApi': controls, './dartJsonString': strings });
const roleStore = load('admin/adminUsersRoleStore', { './adminProductionRequest': checked, './adminUsersModel': model, './dartJsonString': strings });
const cache = load('admin/adminUsersCache');
const controller = load('admin/adminUsersController', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  './adminUsersModel': model, './adminUsersRoleStore': roleStore, './adminUsersCache': cache, './dartJsonString': strings });
function api(fetch) { return load('admin/adminUsersApi', { '../authorizedFetch': { authorizedFetch: fetch }, './adminProductionRequest': checked,
  './adminUsersModel': model, './dartJsonString': strings }); }
const entry = (id, name = id, role = 'supplier', source = role) => model.adminUserListEntryFromJson({ id, name, principal_role: role, source });
const tick = () => new Promise(resolve => setImmediate(resolve));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function memoryStorage() {
  const values = new Map(), calls = [];
  return { values, calls, async getItem(key) { calls.push(['get', key]); return values.get(key) ?? null; },
    async setItem(key, value) { calls.push(['set', key, value]); values.set(key, value); }, async removeItem(key) { values.delete(key); } };
}
function scheduler() {
  let now = 0, serial = 0; const timers = new Map();
  return { set(callback, delay) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; },
    clear(id) { timers.delete(id); }, advance(delay) { now += delay;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } }, size: () => timers.size };
}
module.exports = { load, strings, routes, l10n, checked, model, roleStore, cache, controller, api, entry, tick, flush, deferred, memoryStorage, scheduler };

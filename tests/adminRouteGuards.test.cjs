const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/admin_home_route_guards.json');
const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { appRoutes, canOpenRoute } = mod.exports;
const admin = capabilities => ({ token: 'test', profile: { role: 'admin', ref: 'test' }, capabilities });

test('source-derived f119 Admin route paths and capability alternatives match the reused shared guard', () => {
  assert.equal(fixture.baseline, fs.readFileSync(path.resolve(__dirname, '../docs/port/V2_BASELINE'), 'utf8').trim());
  const allCodes = new Set(Object.values(fixture.routes).flatMap(entry => entry.capabilities));
  allCodes.add('__unrelated_capability__');
  for (const [name, { path: routePath, capabilities }] of Object.entries(fixture.routes)) {
    assert.equal(appRoutes[name], routePath, name);
    for (const capability of allCodes) {
      assert.equal(canOpenRoute(admin([capability]), routePath), capabilities.includes(capability), `${name}: ${capability}`);
    }
  }
});

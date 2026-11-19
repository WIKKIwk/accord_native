const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element, Fragment: 'Fragment' };

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../../src/shared/navigation', file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

const metrics = load('roleNavigationMetrics.ts');
const header = { RoleHeaderRow: 'RoleHeaderRow', RoleHeaderSearchField: 'RoleHeaderSearchField' };
const tabs = NativeTabs => load('RoleTabs.ios.tsx', { 'expo-router/native-tabs': { NativeTabs } });

module.exports = { load, metrics, header, tabs };

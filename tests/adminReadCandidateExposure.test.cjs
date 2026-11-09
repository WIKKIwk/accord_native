const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
test('read-only Admin candidate has no reachable app route or home target', () => {
  const root = path.resolve(__dirname, '../src');
  for (const platform of ['ios', 'android']) {
    const filename = path.join(root, `app/${platform}-admin/_layout.tsx`), mod = new Module(filename, module);
    mod.require = id => {
      if (id === 'expo-router') return { Redirect: 'Redirect' };
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      throw new Error(`Held Admin root must not initialize ${id}`);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    const rootLayout = mod.exports.default();
    assert.equal(rootLayout.type, 'Redirect');
    assert.equal(rootLayout.props.href, '/');
    assert.equal(rootLayout.props.children, undefined);
  }
  const routes = fs.readFileSync(path.join(root, 'shared/appRoutes.ts'), 'utf8');
  const targets = routes.slice(routes.indexOf('const homeTargets:'), routes.indexOf('export function homeTarget'));
  assert.doesNotMatch(targets, /ios-admin|android-admin/);
});

/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function compile(relative, mocks) {
  const filename = path.resolve(__dirname, '../src/admin', relative), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const policy = compile('adminShellLayoutPolicy.ts', {});
const metrics = (patch = {}) => ({ platform: 'android', width: 390, height: 844, viewPaddingBottom: 24, systemGestureInsetsBottom: 32, viewInsetsBottom: 0, ...patch });

/** Render the real frame; only the already independently tested native-facts hook is replaced. */
function frameModule(colors = { surfaceContainerLow: '#dddddd' }, facts = () => ({ metrics: metrics(), thinGestureBottom: false })) {
  return compile('AdminShellBodyFrame.tsx', {
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, './adminShellLayoutPolicy': policy,
    './useAdminShellLayout': { useAdminShellLayout: hasFooter => {
      const state = facts(); return { ...policy.adminShellFrameLayout(state.metrics, hasFooter, state.thinGestureBottom), metricsReady: state.metricsReady ?? state.metrics !== null, sourceWindow: state.sourceWindow, safeInsets: state.safeInsets };
    } },
  });
}
const flattenStyle = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
module.exports = { compile, frameModule, metrics, policy, flattenStyle };

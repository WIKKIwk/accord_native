const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const presentation = load('customerPresentation.ts', { './customerLogic': load('customerLogic.ts') });
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function loadCustomerStates(platform, { width = 390, text = key => key } = {}) {
  const modifier = name => (...values) => [name, ...values];
  return load(`CustomerStates.${platform}.tsx`, {
    'react/jsx-runtime': jsx,
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', ProgressView: 'ProgressView', Text: 'Text', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityLabel', 'background', 'buttonStyle', 'fixedSize', 'font',
      'foregroundStyle', 'frame', 'lineLimit', 'multilineTextAlignment', 'padding'].map(name => [name, modifier(name)]).concat([
      ['shapes', { roundedRectangle: modifier('roundedRectangle') }],
    ])),
    '@expo/ui/jetpack-compose': { Card: 'Card', Column: 'Column', Host: 'Host', LoadingIndicator: 'LoadingIndicator', Text: 'Text', TextButton: 'TextButton',
      useMaterialColors: () => ({ primary: 'primary', onSurface: 'fg', onSurfaceVariant: 'muted', surfaceContainerLow: 'bg' }) },
    '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['fillMaxWidth', 'paddingAll', 'semantics', 'size', 'testID'].map(name => [name, modifier(name)])),
    'react-native': { PlatformColor: value => value, useWindowDimensions: () => ({ width, height: 844 }), View: 'View' },
    './CustomerContext': { useCustomerText: () => ({ text }) }, './customerPresentation': presentation,
  });
}

module.exports = { loadCustomerStates, nodes, presentation };

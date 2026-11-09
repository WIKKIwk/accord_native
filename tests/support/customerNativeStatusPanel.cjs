const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { presentation, nodes } = require('./customerNativeStates.cjs');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function Overlay() {}
Overlay.Content = 'Overlay.Content';
const kind = node => typeof node.type === 'function' ? node.type.name : node.type;

function loadCustomerStatusPanel(platform, { locale = 'uz', text = key => key } = {}) {
  const filename = path.resolve(__dirname, '../../src/customer', `CustomerStatusPanel.${platform}.tsx`), mod = new Module(filename, module);
  const modifier = name => (...values) => [name, ...values];
  const mocks = {
    'react/jsx-runtime': jsx,
    '@expo/ui/swift-ui': { Button: 'Button', HStack: 'HStack', Image: 'Image', Overlay, RoundedRectangle: 'RoundedRectangle', Section: 'Section', Spacer: 'Spacer', Text: 'Text' },
    '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityHidden', 'background', 'buttonStyle', 'contentShape', 'fixedSize', 'font', 'foregroundStyle',
      'frame', 'lineLimit', 'listRowBackground', 'listRowInsets', 'opacity', 'padding'].map(name => [name, modifier(name)]).concat([
      ['shapes', { rectangle: modifier('rectangle'), roundedRectangle: modifier('roundedRectangle') }],
    ])),
    '@expo/ui/jetpack-compose': { Box: 'Box', Column: 'Column', FilledTonalButton: 'FilledTonalButton', HorizontalDivider: 'HorizontalDivider', Host: 'Host',
      RNHostView: 'RNHostView', Row: 'Row', Shape: { RoundedCorner: props => ({ type: 'NativeShape', props: { ...props, type: 'roundedCorner' } }) }, Spacer: 'Spacer', Surface: 'Surface', Text: 'Text',
      useMaterialColors: () => ({ primary: 'primary', onPrimary: 'on-primary', surfaceContainer: 'pending-bg', surfaceContainerLow: 'bg', onSurface: 'fg', onSurfaceVariant: 'muted', outlineVariant: 'outline' }) },
    '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['alpha', 'background', 'clip', 'defaultMinSize', 'fillMaxWidth', 'padding', 'size', 'testID', 'weight', 'width']
      .map(name => [name, modifier(name)]).concat([['Shapes', { RoundedCorner: modifier('RoundedCorner') }]])),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { PlatformColor: value => value, View: 'View' },
    './CustomerContext': { useCustomerText: () => ({ locale, text }) }, './customerPresentation': presentation,
  };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}

module.exports = { loadCustomerStatusPanel, nodes, kind, presentation };

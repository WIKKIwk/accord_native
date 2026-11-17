const fs = require('node:fs'), Module = require('node:module');
const base = require('./adminItemDetailViewsSupport.cjs'), s = require('./adminRootRouterSupport.cjs');
function loadSDK(relative, mocks) { const file = require.resolve('../node_modules/expo-router/build/' + relative), mod = new Module(file, module); mod.filename = file; mod.paths = module.paths; const original = mod.require.bind(mod); mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id); mod._compile(fs.readFileSync(file, 'utf8'), file); return mod.exports; }
function fixture(platform = 'ios', options = {}) {
  const f = s.fixture(platform, options), r = base.runtime(), { react, jsx } = r, calls = [];
  react.createContext = initial => { const context = { value: initial }; context.Provider = function Provider(props) { context.value = props.value; return jsx.jsx('ActualRootAuthorityProvider', props); }; return context; };
  react.useContext = context => context.value;
  const context = base.compile('AdminRootRouterContext.tsx', { react, 'react/jsx-runtime': jsx });
  function NativeStackView(props) { calls.push(['native-stack', props]); return props.state.routes.map(route => props.descriptors[route.key].render()); }
  const scene = base.compile(`AdminRootRouterScene.${platform}.tsx`, { react, 'react/jsx-runtime': jsx, 'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'expo-router': { NativeStackView }, './AdminRootRouterContext': context }).AdminRootRouterScene;
  let binding, page, native, state;
  function render() { const parent = page?.native ?? f.chain.root; state = { interactive: f.chain.canInteract(parent), retained: page ? f.chain.retained(page.native) : false, retired: f.chain.isRetired(parent),
    isCurrent: () => f.owner.readCurrent(binding), canInteract: () => f.owner.canInteract(binding) };
    return r.render(jsx.jsx(scene, { controller: f.owner, binding, state, outlet: jsx.jsx('ActualOriginalOutletFixture', { parent }) })); }
  function bindPage(request = {}) { f.rootReady(); page = f.open(request); binding = f.bind(page); return page; }
  function ready() { native = f.shown(page); return native; }
  return { ...f, ...r, calls, bindPage, ready, render, renderElement: element => r.render(element), binding: () => binding, page: () => page, native: () => native, state: () => state, context,
    renderRoot: () => { f.rootReady(); binding = f.owner.rootScene().binding; return render(); }, compile: (file, mocks) => base.compile(file, { react, 'react/jsx-runtime': jsx, ...mocks }) };
}
module.exports = { ...base, ...s, fixture, loadSDK };

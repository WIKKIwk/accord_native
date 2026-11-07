const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/app/android-preparation/chat', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

test('preparation chat reuses the shared pages, session and role drawer', () => {
  const session = { imageCacheScope: 'preparation-user' };
  const openDrawer = () => {};
  const mocks = {
    '../../../preparation/PreparationContext.android': { usePreparationContext: () => ({ session }) },
    '../../../shared/chat/ChatPages': { ChatRouteStack: 'ChatRouteStack', ChatListPage: 'ChatListPage',
      ChatDirectoryPage: 'ChatDirectoryPage', ChatThreadPage: 'ChatThreadPage' },
    '../../../shared/chat/ChatRouteContext': { ChatRouteProvider: 'ChatRouteProvider' },
    '../../../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: openDrawer }) },
    '../../../preparation/PreparationUI.android': { PreparationDock: 'PreparationDock' },
    'react-native': { View: 'View' },
  };
  const layout = load('_layout.tsx', mocks).default();
  assert.equal(layout.type, 'ChatRouteProvider');
  assert.equal(layout.props.session, session);
  assert.equal(layout.props.basePath, '/android-preparation/chat');
  assert.equal(layout.props.onOpenDrawer, openDrawer);
  assert.equal(layout.props.children.type, 'ChatRouteStack');
  const page = load('index.tsx', mocks).default();
  assert.equal(page.props.children[0].props.children.type, 'ChatListPage');
  assert.equal(page.props.children[1].type, 'PreparationDock');
  assert.equal(page.props.children[1].props.chat, true);
  assert.equal(load('new.tsx', mocks).default, 'ChatDirectoryPage');
  assert.equal(load('[conversationId].tsx', mocks).default, 'ChatThreadPage');
});

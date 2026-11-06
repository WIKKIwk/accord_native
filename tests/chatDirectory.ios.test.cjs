const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const ali = { role: 'worker', ref: 'ali', displayName: 'Ali' };
const vali = { role: 'worker', ref: 'vali', displayName: 'Vali' };
const page = items => ({ items, count: items.length, hasMore: false });
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) { const match = find(child, predicate); if (match) return match; }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

function fixture() {
  const slots = [], reads = [], opens = [], remembered = [], navigated = [], alerts = [];
  let cursor = 0, focus, cleanup, closed = 0;
  const react = {
    useRef: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      const cell = slots[index];
      cell.update ??= value => { cell.value = typeof value === 'function' ? value(cell.value) : value; };
      return [cell.value, cell.update];
    },
    useCallback: (callback, deps) => {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { callback, deps };
      return slots[index].callback;
    },
  };
  const remember = items => remembered.push(items), onOpenConversation = conversation => navigated.push(conversation);
  const { useChatDirectory } = load('shared/chat/useChatDirectory.ts', {
    react, 'expo-router': { useFocusEffect: callback => { focus = callback; } },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '../../auth': { activeSessionToken: () => 'token' },
    '../../chatApi': {
      loadChatDirectory: (_session, query, offset, signal) => { const request = { query, offset, signal, ...deferred() }; reads.push(request); return request.promise; },
      openChatConversation: (_session, peer, signal) => { const request = { peer, signal, ...deferred() }; opens.push(request); return request.promise; },
    },
    '../../components/ChatMetadata': { useChatMetadata: () => ({ remember }) },
  });
  const toolbar = function Toolbar() {}; toolbar.Content = 'Toolbar.Content';
  const nativeQuery = { value: '' };
  const ui = new Proxy({ Toolbar: toolbar, useNativeState: () => nativeQuery }, { get: (target, name) => target[name] ?? name });
  const modifiers = new Proxy({ shapes: { rectangle: () => ({}) }, searchable: (text, options) => ({ name: 'searchable', text, options }) },
    { get: (target, name) => target[name] ?? ((...args) => ({ name, args })) });
  let state;
  const { ChatDirectoryScreen } = load('components/ChatDirectoryScreen.ios.tsx', {
    'react/jsx-runtime': { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { back: () => { closed++; } } },
    'react-native': { StyleSheet: { create: styles => styles } },
    '../profileModel': { profileRoleLabel: role => role }, './ChatAvatar': { ChatAvatar: 'Avatar' },
    './useWorkerColors': { useWorkerColors: () => ({ background: 'background' }) },
    '../shared/chat/useChatDirectory': { useChatDirectory: () => state },
  });
  const session = {};
  const render = () => {
    cursor = 0; state = useChatDirectory(session, onOpenConversation);
    return ChatDirectoryScreen({ session, onOpenConversation });
  };
  render();
  return { ui, render, reads, opens, remembered, navigated, alerts, get state() { return state; }, get closed() { return closed; },
    focus: () => { cleanup = focus(); }, blur: () => cleanup(),
    edit: value => {
      const tree = render();
      const search = find(tree, node => node.type === toolbar).props.modifiers.find(modifier => modifier.name === 'searchable');
      search.text.value = value; search.options.onChange(value);
    },
    select: peer => {
      const row = find(render(), node => node.type?.name === 'DirectoryRow' && node.props.peer.ref === peer.ref);
      assert.ok(row, 'contact row is rendered');
      const button = row.type(row.props);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'disabled').args[0], false);
      button.props.onPress();
    },
  };
}

test('contact search, clear, close and selection work through one native screen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const app = fixture(); app.focus(); t.after(() => app.blur());
  app.reads[0].resolve(page([ali, vali])); await settle();
  const tree = app.render();
  const options = find(tree, node => node.type === 'Stack.Screen').props.options;
  assert.equal(options.headerShown, false);
  assert.equal(options.headerSearchBarOptions, undefined);
  assert.ok(find(find(tree, node => node.type === 'NavigationStack'), node => node.type === 'List'));
  const originalSearch = app.state.search;
  app.edit('Ali'); t.mock.timers.tick(300);
  assert.equal(find(app.render(), node => node.type === 'Stack.Screen').props.options, options);
  assert.equal(app.reads.at(-1).query, 'Ali');
  const staleSearch = app.reads.at(-1);
  app.edit(''); t.mock.timers.tick(0);
  assert.equal(staleSearch.signal.aborted, true);
  assert.equal(app.reads.at(-1).query, '');
  app.reads.at(-1).resolve(page([ali, vali])); await settle();
  staleSearch.resolve(page([ali])); await settle(); app.render();
  assert.equal(app.state.search, originalSearch);
  assert.equal(app.state.query, '');
  assert.deepEqual(app.state.items, [ali, vali]);
  app.select(vali);
  assert.deepEqual(app.opens[0].peer, vali);
  const conversation = { id: 'dm', title: 'Vali', peer: vali };
  app.opens[0].resolve(conversation); await settle();
  assert.deepEqual(app.navigated, [conversation]);
  assert.deepEqual(app.remembered, [[conversation]]);
  find(app.render(), node => node.type === 'Button' && node.props.label === 'Yopish').props.onPress();
  assert.equal(app.closed, 1);
});

test('leaving during a contact request does not leave every contact disabled on return', async t => {
  const app = fixture(); app.focus(); t.after(() => app.blur());
  app.reads[0].resolve(page([ali, vali])); await settle(); app.render();
  app.select(ali); app.render();
  assert.notEqual(app.state.openingKey, '');
  app.blur();
  assert.equal(app.opens[0].signal.aborted, true);
  app.focus(); app.render();
  assert.equal(app.state.openingKey, '');
  app.select(vali);
  app.opens[0].resolve({ id: 'old', peer: ali }); await settle();
  assert.deepEqual(app.navigated, []);
  app.opens[1].reject(new Error('Suhbatni ochib bo‘lmadi.')); await settle(); app.render();
  assert.equal(app.state.openingKey, '');
  assert.equal(app.alerts.length, 1);
  app.select(vali);
  assert.equal(app.opens.length, 3);
});

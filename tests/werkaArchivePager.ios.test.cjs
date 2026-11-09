// Mocked React Native events and handles exercise the adapter, not a device or native layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const slots = [], deps = [], calls = [], requests = [], errors = []; let cursor = 0, effects = [];
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(callback, dependency) { const i = cursor++;
      if (!(i in deps) || dependency.some((value, index) => !Object.is(value, deps[i][index]))) {
        deps[i] = dependency; slots[i] = callback;
      }
      return slots[i]; },
    useLayoutEffect(effect) { cursor++; effects.push(effect); },
    useImperativeHandle(ref, create) { cursor++; effects.push(() => { ref.current = create(); }); },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const filename = path.resolve(__dirname, '../src/werka/WerkaArchivePager.ios.tsx');
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  const mocks = { react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { FlatList: 'FlatList', View: 'View' },
    '@expo/ui/swift-ui': { Host: 'Host' } };
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  let props = { ref: { current: null }, initialPage: 12, pageCount: 36, enabled: true,
    renderPage: page => `page ${page}`, onPageChanged: page => calls.push(page), onPagerError: error => errors.push(error) };
  const render = (update = {}) => {
    props = { ...props, ...update }; cursor = 0; effects = [];
    const tree = loaded.exports.WerkaArchivePager(props); effects.forEach(effect => effect()); return tree;
  };
  const attach = list => { list.props.ref.current = { scrollToIndex: request => requests.push(request) }; };
  return { render, attach, calls, requests, errors, handle: () => props.ref.current };
}
const scroll = (list, x, width) => list.props.onScroll({ nativeEvent: { contentOffset: { x }, layoutMeasurement: { width } } });
const visible = (list, index) => list.props.onViewableItemsChanged({ viewableItems: [{ isViewable: true, index }] });

test('initial layout waits for the actual anchor, arrows request scrolling and only native offsets emit changes', () => {
  const instance = setup(); let tree = instance.render();
  assert.equal(tree.props.children, null); assert.throws(() => instance.handle().scrollToPage(13));
  tree.props.onLayout({ nativeEvent: { layout: { width: 320 } } }); tree = instance.render();
  const list = tree.props.children; instance.attach(list);
  assert.equal(list.props.initialScrollIndex, 12); assert.equal(list.props.pagingEnabled, true);
  assert.deepEqual(list.props.getItemLayout(null, 13), { length: 320, offset: 4160, index: 13 });
  assert.equal(list.props.renderItem({ item: 13 }).props.children, 'page 13');
  scroll(list, 0, 320); visible(list, 0); assert.deepEqual(instance.calls, []);
  assert.throws(() => instance.handle().scrollToPage(13));
  visible(list, 12); instance.handle().scrollToPage(13);
  assert.deepEqual(instance.requests, [{ index: 13, animated: true }]); assert.deepEqual(instance.calls, []);
  scroll(list, 12.49 * 320, 320); assert.deepEqual(instance.calls, []);
  scroll(list, 12.51 * 320.25, 320.25); scroll(list, 13 * 320, 320);
  assert.deepEqual(instance.calls, [13]);
  list.props.onScrollToIndexFailed({ index: 14 }); assert.equal(instance.errors[0].page, 14);
});

test('size changes re-anchor the retained page without inventing a month event', () => {
  const instance = setup(); let tree = instance.render();
  tree.props.onLayout({ nativeEvent: { layout: { width: 320 } } }); tree = instance.render();
  let list = tree.props.children; instance.attach(list); visible(list, 12); scroll(list, 13 * 320, 320);
  assert.deepEqual(instance.calls, [13]); const config = list.props.viewabilityConfig;
  tree.props.onLayout({ nativeEvent: { layout: { width: 400 } } }); tree = instance.render();
  const resized = tree.props.children; instance.attach(resized);
  assert.notEqual(resized.key, list.key); assert.equal(resized.props.initialScrollIndex, 13);
  assert.equal(resized.props.viewabilityConfig, config);
  visible(list, 13); scroll(list, 14 * 400, 400); scroll(resized, 0, 400); assert.deepEqual(instance.calls, [13]);
  scroll(resized, 13 * 400, 400); scroll(resized, 14 * 400, 400); assert.deepEqual(instance.calls, [13, 14]);
});

test('invalid offsets and disabled or out-of-range actions do not emit a month', () => {
  const instance = setup(); let tree = instance.render();
  tree.props.onLayout({ nativeEvent: { layout: { width: 320 } } }); tree = instance.render();
  let list = tree.props.children; instance.attach(list); visible(list, 12);
  for (const offset of [NaN, Infinity]) scroll(list, offset, 320);
  scroll(list, 13 * 320, 0); scroll(list, 13 * 320, 321); assert.deepEqual(instance.calls, []);
  assert.throws(() => instance.handle().scrollToPage(36));
  tree = instance.render({ enabled: false }); list = tree.props.children; instance.attach(list);
  scroll(list, 13 * 320, 320); assert.throws(() => instance.handle().scrollToPage(13));
  assert.deepEqual(instance.calls, []); assert.deepEqual(instance.requests, []);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const catalog = require('../src/shared/localization/catalog.json');
const localization = load('shared/localization/index.ts', { './catalog.json': catalog });
const orderText = load('workerOrderText.ts', { './shared/localization/catalog.json': catalog, './shared/localization': localization });
const detail = { map: { base_length: 25601, order_kg: 100, roll_count: 6, width_mm: 375, standard_print_side: false },
  stages: ['Start', 'shashogcha', '8 ta rangli bosma aparat', 'Laminatsiya 1', 'Rezka', 'shashogcha'].map((title, index) => ({
    id: `stage-${index}`, apparatusId: [2, 3, 4].includes(index) ? `machine-${index}` : '', title,
    state: index === 2 ? 'in_progress' : 'pending',
  })) };

function harness(initial = detail) {
  const slots = [], opened = [];
  let cursor = 0, locale = 'uz';
  const props = { session: { imageCacheScope: 'worker', profile: { ref: 'worker' } }, orderId: 'order', code: '0337',
    title: 'Tea', imageId: 'image', detail: initial };
  const close = () => {};
  const { useWorkerOrderOverview } = load('components/useWorkerOrderOverview.ts', {
    react: { createElement: React.createElement,
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
        return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    '../nativeSheet': { useNativeSheet: () => ({ open: (element, options) => opened.push({ element, options }), close }) },
    '../shared/localization': localization,
    '../workerOrderText': orderText,
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() {} } },
    './WorkerWipHistory': { WorkerWipHistory: 'History' },
  });
  return { props, opened, close, setLocale: value => { locale = value; },
    render: () => { cursor = 0; return useWorkerOrderOverview(props); } };
}

test('planned meters retain 500m rounding and print-side/shaft details retain V2 values', () => {
  const h = harness(), model = h.render();
  assert.deepEqual(model.metrics.map(row => [row.id, row.value, row.unit]), [['length', '26000', 'm'], ['weight', '100', 'kg']]);
  assert.deepEqual(model.facts.map(row => row.value), ['6 ta 375 mm eniga ega bo‘lgan val ishlatiladi', 'Nostandart']);
  for (const [value, expected] of [[0.1, '500'], [500, '500'], [500.1, '1000']]) {
    h.props.detail = { ...detail, map: { base_length: value } };
    assert.equal(h.render().metrics[0].value, expected);
  }
});

test('invalid or unavailable numeric metadata stays hidden; missing width keeps the existing dash', () => {
  const h = harness();
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity, '100']) {
    h.props.detail = { ...detail, map: { base_length: invalid, order_kg: invalid, roll_count: invalid } };
    const model = h.render(); assert.deepEqual(model.metrics, []); assert.equal(model.facts.length, 1);
  }
  h.props.detail = { ...detail, map: { roll_count: 2 } };
  assert.equal(h.render().facts[0].value, '2 ta — mm eniga ega bo‘lgan val ishlatiladi');
  const pending = harness(null), model = pending.render(); model.toggle();
  assert.equal(pending.render().expanded, false); assert.equal(model.enabled, false);
});

test('stage history retains the current order, identity, apparatus labels and native-sheet dismissal', () => {
  const h = harness(), model = h.render(); model.openStage(''); assert.equal(h.opened.length, 0);
  model.openStage('machine-2');
  assert.equal(h.opened.length, 1);
  const { element, options } = h.opened[0];
  assert.equal(element.props.session, h.props.session);
  assert.deepEqual(element.props.order, { id: 'order', code: '0337', title: 'Tea', imageId: 'image', apparatusId: 'machine-2' });
  assert.deepEqual(element.props.apparatusNames, { 'machine-2': '8 ta rangli bosma aparat', 'machine-3': 'Laminatsiya 1', 'machine-4': 'Rezka' });
  assert.equal(element.props.stageHistory, true); assert.equal(element.props.onClose, h.close);
  assert.deepEqual(options, { dismissible: true });
  h.props.orderId = 'next'; h.render().openStage('machine-4');
  assert.equal(h.opened[1].element.props.order.id, 'next');
});

const native = new Proxy({}, { get: (_target, key) => String(key) });
const modifiers = new Proxy({}, { get: (_target, key) => key === 'shapes'
  ? { rectangle: () => ({ type: 'rectangle' }) } : (...args) => ({ name: String(key), args }) });
const mocks = { '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  'react-native': { Platform: { Version: '26.1.1' }, PlatformColor: name => name, View: 'View' }, './BaseHost': { BaseHost: 'Host' } };
const byId = (tree, id) => nodes(tree, item => item.props.modifiers?.some(modifier => modifier.name === 'accessibilityIdentifier' && modifier.args[0] === id))[0];

test('native iOS summary expands all metrics and six production stages, keeping apparatus rows actionable', () => {
  const h = harness();
  const { WorkerOrderOverview } = load('components/WorkerOrderOverview.ios.tsx', { ...mocks,
    './useWorkerOrderOverview': { useWorkerOrderOverview: () => h.render() } });
  let tree = WorkerOrderOverview(h.props);
  assert.equal(nodes(tree, item => item.type === 'ListItem').length, 0);
  assert.equal(byId(tree, 'worker-order-metric-length'), undefined);
  byId(tree, 'worker-order-summary').props.onPress(); tree = WorkerOrderOverview(h.props);
  assert.equal(text(byId(tree, 'worker-order-metric-length')).includes('26000'), true);
  assert.equal(text(tree).includes('6 ta 375 mm eniga ega bo‘lgan val ishlatiladi'), true);
  for (const stage of detail.stages) assert.equal(text(tree).includes(stage.title), true);
  const stages = nodes(tree, item => item.type === 'Button' && item.props.modifiers?.some(modifier => modifier.args[0]?.startsWith?.('worker-order-stage-')));
  assert.equal(stages.length, 3); stages.forEach(row => row.props.onPress());
  assert.deepEqual(h.opened.map(entry => entry.element.props.order.apparatusId), ['machine-2', 'machine-3', 'machine-4']);
  byId(tree, 'worker-order-summary').props.onPress(); tree = WorkerOrderOverview(h.props);
  assert.equal(byId(tree, 'worker-order-metric-length'), undefined);
});

test('overview metadata uses the active locale without changing the order values', () => {
  const h = harness();
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    h.setLocale(locale); const model = h.render();
    assert.equal(model.title, catalog.production['worker.summary.expected.result_title'][locale]);
    assert.equal(model.facts[1].value, catalog.production['order.print_side.nonstandard'][locale]);
    assert.equal(model.metrics[0].value, '26000');
  }
});

test('native order controls retain callbacks and busy state, with completion before pause on iOS', () => {
  const calls = [];
  const { WorkerOrderButton, WorkerOrderActionGroup } = load('components/WorkerOrderControls.ios.tsx', mocks);
  for (const busy of [false, true]) {
    const tree = WorkerOrderButton({ label: 'Tugatish', variant: 'filled', height: 58, disabled: busy, onPress: () => calls.push('complete') });
    const button = nodes(tree, item => item.type === 'Button')[0];
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'disabled').args[0], busy);
    const label = button.props.children;
    assert.equal(label.props.modifiers.some(modifier => modifier.name === 'frame' && modifier.args[0].maxWidth === Infinity), true);
    if (!busy) button.props.onPress();
  }
  assert.deepEqual(calls, ['complete']);
  const group = WorkerOrderActionGroup({ children: [React.createElement('Button', { key: 'pause' }, 'Rulonni yechish'),
    React.createElement('Button', { key: 'complete' }, 'Tugatish')] });
  assert.equal(text(group), 'Tugatish Rulonni yechish');
});

test('order actions use system glass controls on iOS 26 and native bordered controls on older iOS', () => {
  for (const [version, styles] of [['26.1.1', ['glassProminent', 'glass']], ['18.7', ['borderedProminent', 'bordered']]]) {
    const { WorkerOrderButton } = load('components/WorkerOrderControls.ios.tsx', {
      ...mocks, 'react-native': { ...mocks['react-native'], Platform: { Version: version } },
    });
    for (const [index, variant] of ['filled', 'outlined'].entries()) {
      const tree = WorkerOrderButton({ label: index ? 'Rulonni yechish' : 'Tugatish', variant, height: 58, onPress() {} });
      const button = nodes(tree, item => item.type === 'Button')[0];
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonStyle').args[0], styles[index]);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonBorderShape').args[0], 'capsule');
      assert.equal(nodes(tree, item => item.props.modifiers?.some(modifier => modifier.name === 'frame'
        && ['height', 'minHeight'].some(key => key in modifier.args[0]))).length, 0);
    }
  }
});

test('native order identity keeps image preview and close actions with the cached thumbnail', () => {
  const h = harness(), calls = [];
  const { WorkerOrderIdentity } = load('components/WorkerOrderIdentity.ios.tsx', { ...mocks,
    './WorkerOrderThumbnail': { WorkerOrderThumbnail: 'Thumbnail' }, './useWorkerColors': { useWorkerColors: () => ({ surface: 'surface', icon: 'icon' }) } });
  const tree = WorkerOrderIdentity({ ...h.props, onOpenImage: () => calls.push('image'), onClose: () => calls.push('close') });
  byId(tree, 'worker-order-image').props.onPress(); byId(tree, 'worker-order-close').props.onPress();
  assert.equal(byId(tree, 'worker-order-close').props.role, 'close');
  assert.deepEqual(calls, ['image', 'close']);
  const thumbnail = nodes(tree, item => item.type === 'Thumbnail')[0];
  assert.equal(thumbnail.props.session, h.props.session); assert.equal(thumbnail.props.imageId, 'image');
  assert.equal(text(tree).includes('0337'), true); assert.equal(text(tree).includes('Tea'), true);
});

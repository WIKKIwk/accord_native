const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const guard = load('shared/profileSessionGuard.ts'), dart = load('admin/dartJsonString.ts');
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const present = load('admin/adminWorkMapSummaryPresentation.ts', { '../shared/localization': l10n, './dartJsonString': dart });
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(readers) {
  const states = [], effects = [], scheduled = [], reads = []; let stateIndex = 0, effectIndex = 0, current = true, ticketCurrent = true, writes = 0;
  const args = { session: {}, ticket: { kind: 'order', id: 'o', generation: 1 }, isCurrent: () => current, hydrated: {},
    controller: { subscribe() {}, getSnapshot: () => ({}), detailIsCurrent: () => ticketCurrent } };
  const react = {
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useRef(initial) {
      const index = stateIndex++; if (!Object.hasOwn(states, index)) states[index] = { current: initial };
      return states[index];
    },
    useState(initial) {
      const index = stateIndex++; if (!Object.hasOwn(states, index)) states[index] = initial;
      return [states[index], value => { writes++; states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = effectIndex++, previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) scheduled.push(() => {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: effect() };
      });
    },
  };
  const hook = load('admin/useAdminWorkMapSummary.ts', { react, '../shared/profileSessionGuard': guard,
    './adminWorkMapDetailWitness': load('admin/adminWorkMapDetailWitness.ts'),
    './adminWorkMapReader': readers ?? { adminWorkMapSummaryReader: (session, witness) => id => {
      assert.equal(guard.isProfileSessionCurrent(witness), true, 'the real strict reader must accept the composed valid witness');
      return new Promise((resolve, reject) => reads.push({ session, witness, id, resolve, reject }));
    } } }).useAdminWorkMapSummary;
  return { args, reads, get writes() { return writes; }, invalidateWitness() { current = false; }, invalidateTicket() { ticketCurrent = false; },
    render() { stateIndex = 0; effectIndex = 0; const value = hook(args.session, args.isCurrent, args.controller, args.ticket, args.hydrated); scheduled.splice(0).forEach(fn => fn()); return value; },
    unmount() { effects.forEach(effect => effect.cleanup?.()); } };
}
test('summary stays collapsed without a read, then hydrates exactly the original ticket ID on explicit expansion', async () => {
  const f = fixture(), initial = f.render(); assert.equal(initial.expanded, false); assert.equal(initial.canExpand, true); assert.equal(f.reads.length, 0);
  initial.toggle(); const expanded = f.render(); assert.equal(expanded.loading, true); assert.equal(f.reads.length, 1); assert.equal(f.reads[0].id, 'o');
  const value = { source_map_id: 'o' }; f.reads[0].resolve(value); await tick(); assert.equal(f.render().value, value); f.unmount();
});
test('actual saved-summary hook/reader accepts the composed witness and retires the read on collapse', async () => {
  const sent = [], waiting = [], adminGuard = load('admin/adminProductionRequest.ts', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
  const readers = load('admin/adminWorkMapReader.ts', {
    '../auth': { activeSessionToken: session => session.token }, '../apparatusApi': {}, '../productionOrderPageApi': {}, '../pendingOrderApi': {}, '../productionOrderDetailApi': {},
    './adminOrderSummaryApi': { adminProductionMapOrderSummary: async (session, id, beforeSend) => {
      beforeSend(); sent.push({ session, id, beforeSend }); return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    } },
    '../sessionReadScope': { sessionReadScope: session => JSON.stringify(session.profile) },
    '../shared/appRoutes': load('shared/appRoutes.ts'), '../shared/profileSessionGuard': guard,
    '../shared/mobileApiException': load('shared/mobileApiException.ts'), './adminProductionRequest': adminGuard, './adminWorkMapMetadataModel': {},
  });
  const f = fixture(readers); f.args.session = { token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  f.render().toggle(); f.render(); assert.equal(sent.length, 1); assert.equal(sent[0].id, 'o');
  f.render().toggle(); assert.throws(sent[0].beforeSend, /session changed/); // before passive cleanup
  f.render(); assert.throws(sent[0].beforeSend, /session changed/);
  waiting[0].resolve({ source_map_id: 'o' }); await tick(); assert.equal(f.render().value, undefined);
  f.render().toggle(); f.render(); assert.equal(sent.length, 2); assert.throws(sent[0].beforeSend, /session changed/);
  waiting[1].resolve({ source_map_id: 'o' }); await tick(); assert.equal(f.render().value.source_map_id, 'o'); f.unmount();
});
test('pending or unhydrated detail cannot expand or send a saved-summary read', () => {
  for (const change of [{ hydrated: false }, { ticket: { id: 'p', kind: 'pending' } }]) {
    const f = fixture(); Object.assign(f.args, change); const state = f.render(); assert.equal(state.canExpand, false); state.toggle(); state.retry(); f.render(); assert.equal(f.reads.length, 0); f.unmount();
  }
});
test('collapse immediately invalidates an in-flight send guard before React runs effect cleanup', async () => {
  const f = fixture(); f.render().toggle(); f.render();
  assert.equal(f.reads[0].witness(), true);
  f.render().toggle();
  assert.equal(f.reads[0].witness(), false);
  const before = f.writes; f.reads[0].resolve({ source_map_id: 'o' }); await tick();
  assert.equal(f.writes, before); assert.equal(f.render().value, undefined); f.unmount();
});
test('a fresh hydration cannot reuse an earlier calculation while its new read is pending', async () => {
  const f = fixture(); f.args.hydrated = { id: 'first' }; f.render().toggle(); f.render();
  f.reads[0].resolve({ source_map_id: 'o' }); await tick(); assert.ok(f.render().value);
  f.args.hydrated = false; assert.equal(f.render().expanded, false);
  f.args.hydrated = { id: 'second' }; const reopened = f.render();
  assert.equal(reopened.expanded, true); assert.equal(reopened.loading, true); assert.equal(reopened.value, undefined);
  assert.equal(f.reads.length, 2); f.unmount();
});
test('collapse discards late calculation/error and reopening starts a fresh read rather than showing a cached value', async () => {
  for (const fail of [false, true]) {
    const f = fixture(); f.render().toggle(); f.render(); f.render().toggle(); f.render(); const before = f.writes; assert.equal(f.reads[0].witness(), false);
    if (fail) f.reads[0].reject(Error('late')); else f.reads[0].resolve({ source_map_id: 'o' });
    await tick(); assert.equal(f.writes, before); assert.equal(f.render().value, undefined);
    f.render().toggle(); const opened = f.render(); assert.equal(opened.value, undefined); assert.equal(opened.loading, true); assert.equal(f.reads.length, 2); f.unmount();
  }
});
test('a failed summary retains its panel and explicit retry starts a fresh ticket-bound attempt', async () => {
  const f = fixture(); f.render().toggle(); f.render(); f.reads[0].reject(Error('not shown verbatim')); await tick();
  const failed = f.render(); assert.equal(failed.failed, true); assert.equal(failed.expanded, true); failed.retry();
  const pending = f.render(); assert.equal(pending.failed, false); assert.equal(pending.loading, true); assert.equal(f.reads.length, 2); f.unmount();
});
for (const invalidate of ['invalidateWitness', 'invalidateTicket']) test(`${invalidate} retires summary data and callbacks without another read`, async () => {
  const f = fixture(); f.render().toggle(); f.render(); f[invalidate](); const before = f.writes;
  assert.equal(f.reads[0].witness(), false); f.reads[0].resolve({ source_map_id: 'o' }); await tick();
  assert.equal(f.writes, before); const state = f.render(); assert.equal(state.expanded, false); assert.equal(state.value, undefined);
  state.toggle(); state.retry(); assert.equal(f.writes, before); assert.equal(f.reads.length, 1); f.unmount();
});
test('a new session/ticket starts collapsed and cannot inherit the previous panel or data', async () => {
  for (const key of ['session', 'ticket']) {
    const f = fixture(); f.render().toggle(); f.render(); f.args[key] = { ...f.args[key] }; const state = f.render();
    assert.equal(state.expanded, false); assert.equal(state.value, undefined); f.reads[0].resolve({ source_map_id: 'o' }); await tick();
    assert.equal(f.render().value, undefined); assert.equal(f.reads.length, 1); f.unmount();
  }
});
test('unmount, asynchronous witness and duplicate toggle do not create a stale calculation read', async () => {
  const f = fixture(); f.render().toggle(); f.render(); f.unmount(); const before = f.writes; f.reads[0].resolve({}); await tick(); assert.equal(f.writes, before);
  const invalid = fixture(); invalid.args.isCurrent = async () => true; invalid.render().toggle(); assert.equal(invalid.reads.length, 0); invalid.unmount();
  const duplicate = fixture(), state = duplicate.render(); state.toggle(); state.toggle(); assert.equal(duplicate.render().expanded, false); assert.equal(duplicate.reads.length, 0); duplicate.unmount();
});
const map = { base_length: 501, order_kg: 12.5, width_mm: null, standard_print_side: false };
const state = { expanded: true, canExpand: true, loading: false, failed: false };
const calculation = { width_mm: 120, waste_percent: 5, effective_layers: [{ material: ' PE ', micron: ' 30 ' }, { material: '', micron: '20' }],
  products: [{ item_code: 'P', product: 'Film', frame_count: 2, frame_product_size_mm: 50 }], note: '\u0085Note\u0085' };
test('loading/unavailable preserve the source summary rows, positive stored metrics, print side and retry order', () => {
  const loading = present.adminWorkMapSummaryPresentation(map, { ...state, loading: true }, 'uz');
  assert.deepEqual(loading.blocks.map(block => block.id), ['subtitle', 'length', 'weight', 'print-side', 'loading']);
  assert.equal(loading.blocks.find(block => block.id === 'length').value, '1000 metr');
  assert.equal(loading.blocks.find(block => block.id === 'weight').value, '12.5 kg');
  assert.equal(loading.blocks.find(block => block.id === 'print-side').value, 'Nostandart');
  assert.deepEqual(present.adminWorkMapSummaryPresentation(map, { ...state, failed: true }, 'uz').blocks.map(block => block.id),
    ['subtitle', 'length', 'weight', 'print-side', 'unavailable-divider', 'unavailable', 'retry']);
  assert.deepEqual(present.adminWorkMapSummaryPresentation(map, { ...state, expanded: false }, 'uz').blocks, []);
});
test('loaded summary keeps source materials/width/summary/waste/products/note order and exact interpolations', () => {
  const model = present.adminWorkMapSummaryPresentation(map, { ...state, value: calculation }, 'uz');
  assert.deepEqual(model.blocks.map(block => block.id), ['materials-title', 'layer-0', 'layer-1', 'width', 'summary-divider',
    'subtitle', 'length', 'weight', 'print-side', 'waste', 'planned', 'products-divider', 'products-title', 'product-0', 'note-divider', 'note-title', 'note']);
  assert.equal(model.blocks.find(block => block.id === 'layer-0').value, 'PE · 30 mikron');
  assert.equal(model.blocks.find(block => block.id === 'width').value, '120 mm');
  assert.equal(model.blocks.find(block => block.id === 'waste').value, '5 %'); assert.equal(model.blocks.at(-1).label, 'Note');
  assert.equal(model.blocks.find(block => block.id === 'product-0').value, 'P · 2 ta kadr × 50 mm');
});
test('source null-coalescing width, empty sections, finite positive lengths and raw number branch are preserved', () => {
  const value = { ...calculation, effective_layers: [], products: [], note: '' };
  for (const width_mm of [0, -1, Infinity]) {
    const model = present.adminWorkMapSummaryPresentation({ base_length: Infinity, order_kg: 0, width_mm }, { ...state, value }, 'en');
    assert.equal(model.blocks.some(block => ['width', 'length', 'weight', 'products-title', 'note-title'].includes(block.id)), false);
    assert.equal(model.blocks.some(block => block.id === 'materials-empty'), true);
    assert.equal(model.blocks.find(block => block.id === 'print-side').value, 'Standard');
  }
  assert.equal(present.adminWorkMapRawQuantity(-0), '-0');
  assert.equal(present.adminWorkMapRawQuantity(1000000000000000100), '1000000000000000128');
  assert.equal(present.adminWorkMapRawQuantity(1e21), '1e+21');
  assert.equal(present.adminWorkMapSummaryPresentation({ ...map, base_length: Number.MAX_VALUE }, { ...state, loading: true }, 'uz').blocks.some(block => block.id === 'length'), false);
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} summary uses native expand/retry controls and ordered passive blocks only`, () => {
  const View = load(`admin/AdminWorkMapSummary.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: { Button: 'Button', Column: 'Column', VStack: 'VStack', Divider: 'Divider', HorizontalDivider: 'Divider', Text: 'NativeText', Image: 'Image', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': { font: value => value, accessibilityHidden: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' } }).AdminWorkMapSummary;
  const toggled = () => {}, retried = () => {}, model = present.adminWorkMapSummaryPresentation(map, { ...state, failed: true }, 'uz');
  const tree = nodes(View({ model, onToggle: toggled, onRetry: retried }));
  assert.equal(tree.find(node => node.props.testID === 'admin-work-map-summary').props.onPress, toggled);
  assert.equal(tree.find(node => node.type === 'Button').props[platform === 'ios' ? 'onPress' : 'onClick'], retried);
  assert.deepEqual(tree.filter(node => node.type === 'ListItem' && !node.props.testID).map(node => node.props.supportingText), model.blocks.filter(block => block.kind === 'row').map(block => block.value));
  assert.equal(nodes(View({ model: { ...model, canExpand: false }, onToggle: toggled, onRetry: retried })).find(node => node.props.testID === 'admin-work-map-summary').props.onPress, undefined);
  assert.equal(tree.some(node => node.props.onLongPress || node.props.onMove || node.props.onSubmit), false);
});

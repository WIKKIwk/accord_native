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
const guard = load('shared/profileSessionGuard.ts');
const metadata = load('admin/adminWorkMapMetadataModel.ts', { './dartJsonString': load('admin/dartJsonString.ts'),
  './adminWorkMapClosedModel': load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': load('admin/dartJsonString.ts') }) });
const tick = () => new Promise(resolve => setImmediate(resolve));
test('rework notice uses the source localization for all supported languages', () => {
  const local = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const expected = { uz: 'Buyurtma qoliplari peredelkada. Barcha kerakli qoliplar qaytmaguncha ishni boshlash mumkin emas.',
    en: 'This order has molds in rework. Work cannot start until all required molds return.',
    ru: 'Формы заказа на переделке. Начать работу можно после возврата всех необходимых форм.',
    ur: 'This order has molds in rework. Work cannot start until all required molds return.' };
  for (const [locale, text] of Object.entries(expected)) assert.equal(local.extensionText('qolipReworkText', 'order_unavailable', locale), text);
  assert.equal(local.productionText('worker.freeze.active', 'en'), 'The order is frozen. Please contact an admin and ask them to unfreeze it before continuing.');
  assert.equal(local.productionText('worker.freeze.requested', 'en'), 'An admin requested a freeze. Safely remove the roll first, or enter the issue reason.');
});
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(readers) {
  let current = true, ticketCurrent = true, stateIndex = 0, effectIndex = 0, writes = 0, closes = 0;
  const states = [], effects = [], scheduled = [], reads = [];
  const session = {}, ticket = { id: 'o', kind: 'order', generation: 1, epoch: 'e', revision: 4 };
  const controller = { subscribe() {}, getSnapshot: () => ({}), detailIsCurrent: () => ticketCurrent };
  const args = { session, ticket, isCurrent: () => current, controller, close: () => { closes++; } };
  const react = {
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState(initial) {
      const index = stateIndex++;
      if (!Object.hasOwn(states, index)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { writes++; states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = effectIndex++, previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) scheduled.push(() => {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: effect() };
      });
    },
  };
  const hook = load('admin/useAdminWorkMapDetail.ts', { react, '../shared/profileSessionGuard': guard,
    './adminWorkMapDetailWitness': load('admin/adminWorkMapDetailWitness.ts'),
    './adminWorkMapReader': readers ?? { adminWorkMapDetailReader: (captured, isCurrent) => async capturedTicket => {
      assert.equal(guard.isProfileSessionCurrent(isCurrent), true, 'the strict reader must accept a valid composed ticket witness');
      const response = deferred(); reads.push({ captured, isCurrent, ticket: capturedTicket, response }); return response.promise;
    } } }).useAdminWorkMapDetail;
  return { args, reads, get writes() { return writes; }, get closes() { return closes; },
    invalidateWitness: () => { current = false; }, invalidateTicket: () => { ticketCurrent = false; },
    render() { stateIndex = 0; effectIndex = 0; const result = hook(args.session, args.isCurrent, args.controller, args.ticket, args.close);
      scheduled.splice(0).forEach(effect => effect()); return result; },
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}
test('detail hook binds the original session and ticket, then shows only its completed response', async () => {
  const f = fixture(), first = f.render(); assert.equal(first.valid, true); assert.equal(first.loading, true);
  assert.equal(f.reads[0].captured, f.args.session); assert.equal(f.reads[0].ticket, f.args.ticket); assert.equal(f.reads[0].isCurrent(), true);
  const value = { kind: 'order', map: { id: 'o' }, customer: 'Canonical' }; f.reads[0].response.resolve(value); await tick();
  assert.equal(f.render().value, value); assert.equal(f.render().loading, false); f.unmount();
});
test('actual detail hook/reader composition accepts a valid ticket and rejects the same ticket after account loss', async () => {
  const sent = [], waiting = [], adminGuard = load('admin/adminProductionRequest.ts', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
  const readers = load('admin/adminWorkMapReader.ts', {
    '../auth': { activeSessionToken: session => session.token }, '../apparatusApi': {}, '../productionOrderPageApi': {}, '../pendingOrderApi': {}, './adminOrderSummaryApi': {},
    '../productionOrderDetailApi': { adminProductionOrderDetail: async (session, input, beforeSend) => {
      beforeSend(); sent.push({ session, input }); const response = deferred(); waiting.push(response); return response.promise;
    } },
    '../sessionReadScope': { sessionReadScope: session => JSON.stringify(session.profile) },
    '../shared/appRoutes': load('shared/appRoutes.ts'), '../shared/profileSessionGuard': guard,
    '../shared/mobileApiException': load('shared/mobileApiException.ts'), './adminProductionRequest': adminGuard,
    './adminWorkMapMetadataModel': metadata, './adminWorkMapOrderWeight': load('admin/adminWorkMapOrderWeight.ts', { './dartJsonString': load('admin/dartJsonString.ts') }),
    './dartJsonString': load('admin/dartJsonString.ts'),
  });
  const f = fixture(readers); f.args.session = { token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  assert.equal(f.render().valid, true); assert.equal(sent.length, 1);
  waiting[0].resolve({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] }); await tick();
  assert.equal(f.render().value.map.id, 'o'); f.render().retry(); f.render(); assert.equal(sent.length, 2);
  f.invalidateWitness(); waiting[1].resolve({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] }); await tick();
  assert.equal(f.render().value, undefined); assert.equal(sent.length, 2); f.unmount();
});
test('raw detail witness composition forwards malformed results to the strict validator without coercion', async () => {
  const compose = load('admin/adminWorkMapDetailWitness.ts').adminWorkMapDetailWitness, controller = { detailIsCurrent: () => true };
  assert.equal(guard.isProfileSessionCurrent(compose(() => true, controller, {})), true);
  for (const raw of [() => 1, () => null, async () => true, async () => { throw Error('invalid asynchronous witness'); }]) {
    assert.equal(guard.isProfileSessionCurrent(compose(raw, controller, {})), false);
  }
  for (const result of [false, 1, null]) {
    assert.equal(guard.isProfileSessionCurrent(compose(() => true, { detailIsCurrent: () => result }, {})), false);
  }
  for (const detailIsCurrent of [async () => true, async () => { throw Error('invalid asynchronous ticket'); }, () => { throw Error('invalid ticket'); }]) {
    assert.equal(guard.isProfileSessionCurrent(compose(() => true, { detailIsCurrent }, {})), false);
  }
  await tick();
});
test('retry clears the prior error and waits for a fresh ticket-bound read', async () => {
  const f = fixture(); f.render(); f.reads[0].response.reject(new Error('failed')); await tick();
  const failed = f.render(); assert.equal(failed.error, 'failed'); failed.retry();
  const retried = f.render(); assert.equal(retried.loading, true); assert.equal(retried.error, undefined); assert.equal(f.reads.length, 2);
  const value = { kind: 'pending', template: { product: 'New' } }; f.reads[1].response.resolve(value); await tick();
  assert.equal(f.render().value, value); f.unmount();
});
for (const invalidate of ['invalidateWitness', 'invalidateTicket']) test(`${invalidate} suppresses late success/error, closes and disables retry`, async () => {
  for (const outcome of ['resolve', 'reject']) {
    const f = fixture(); f.render(); f[invalidate](); assert.equal(f.reads[0].isCurrent(), false);
    f.reads[0].response[outcome](outcome === 'resolve' ? { kind: 'order', map: { id: 'o' } } : new Error('late')); await tick();
    assert.equal(f.writes, 0); const invalid = f.render(); assert.equal(invalid.valid, false); assert.equal(invalid.value, undefined);
    assert.equal(f.closes, 1); invalid.retry(); assert.equal(f.writes, 0); assert.equal(f.reads.length, 1); f.unmount();
  }
});
test('unmount never publishes a pending detail or its error', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const f = fixture(); f.render(); f.unmount(); assert.equal(f.reads[0].isCurrent(), false); f.reads[0].response[outcome](outcome === 'resolve' ? {} : new Error('late')); await tick();
    assert.equal(f.writes, 0);
  }
});
test('new ticket or session never displays the old successful response during its initial frame', async () => {
  for (const key of ['ticket', 'session']) {
    const f = fixture(); f.render(); const old = { kind: 'order', map: { id: 'o' } }; f.reads[0].response.resolve(old); await tick();
    assert.equal(f.render().value, old); f.args[key] = { ...f.args[key] };
    const changed = f.render(); assert.equal(changed.value, undefined); assert.equal(changed.loading, true); assert.equal(f.reads.length, 2); f.unmount();
    f.reads[1].response.resolve(old); await tick();
  }
});
test('asynchronous or throwing witness never starts a detail read', () => {
  for (const witness of [async () => true, () => { throw new Error('invalid'); }]) {
    const f = fixture(); f.args.isCurrent = witness;
    assert.equal(f.render().valid, false); assert.equal(f.reads.length, 0); assert.equal(f.closes, 1); f.unmount();
  }
});
function nodes(tree) {
  return tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
}
test('basic detail view delegates lifecycle/retry and displays the canonical hydrated customer', () => {
  let detail = { valid: true, loading: false, value: { kind: 'order', customer: 'Canonical', metadata: { createdAtUnix: null, creator: null },
    map: { title: 'Hydrated', customer_name: 'Old', order_kg: 12, combo: null, products: [] } } };
  const retry = () => {}, close = () => {};
  const View = load('admin/AdminWorkMapDetail.tsx', {
    '@expo/ui': { Button: 'Button', Column: 'Column', Host: 'Host', ListItem: 'ListItem' },
    react: { useSyncExternalStore: (_s, snapshot) => snapshot() },
    'react-native': { ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../components/useWorkerColors': { useWorkerColors: () => ({ text: '#000', field: '#fff' }) },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' },
    '../shared/localization': { localizedGetter: key => key, productionText: key => key, adminText: key => key, extensionText: (method, key) => `${method}.${key}` },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './useAdminWorkMapDetail': { useAdminWorkMapDetail: () => ({ ...detail, retry }) },
    './AdminWorkMapMetadata': { AdminWorkMapMetadata: 'Metadata' }, './adminWorkMapMetadataModel': metadata,
    './AdminWorkMapSummary': { AdminWorkMapSummary: 'Summary' }, './AdminWorkMapCombo': { AdminWorkMapCombo: 'Combo' },
    './AdminWorkMapPending': { AdminWorkMapPending: 'Pending' }, './AdminWorkMapControlNotice': { AdminWorkMapControlNotice: 'ControlNotice' },
    './adminWorkMapPendingPresentation': load('admin/adminWorkMapPendingPresentation.ts', { './adminDartDouble': load('admin/adminDartDouble.ts') }),
    './adminWorkMapComboPresentation': { adminWorkMapComboPresentation: (combo, products) => ({ combo, products }) },
    './adminWorkMapDetailHeader': load('admin/adminWorkMapDetailHeader.ts', { './dartJsonString': load('admin/dartJsonString.ts') }),
    './adminWorkMapSummaryPresentation': { adminWorkMapSummaryPresentation: (map, state) => ({ map, ...state }) },
    './useAdminWorkMapSummary': { useAdminWorkMapSummary: (_session, _isCurrent, _controller, _ticket, hydrated) => ({ expanded: false, canExpand: !!hydrated }) },
  }).AdminWorkMapDetail;
  const props = { session: { profile: { role: 'admin' } }, ticket: { kind: 'order' }, row: { code: '1', id: 'o', title: 'Old' }, close };
  const tree = nodes(View(props));
  assert.equal(tree.some(node => node.type === 'ListItem' && node.props.children === 'customerLabel'), false);
  assert.deepEqual(tree.filter(node => node.type === 'Text').slice(0, 3).map(node => node.props.children), ['worker.order.code', '-', 'Canonical • Hydrated']);
  assert.deepEqual(tree.find(node => node.type === 'Metadata').props.rows.map(row => row.value), ['detail.date_missing', 'detail.creator_missing']);
  assert.equal(tree.find(node => node.type === 'Summary').props.model.canExpand, true);
  assert.equal(tree.find(node => node.type === 'Summary').props.model.map.order_kg, 12);
  detail.value.orderWeight = 42.5;
  assert.equal(nodes(View(props)).find(node => node.type === 'Summary').props.model.map.order_kg, 42.5);
  assert.equal(detail.value.map.order_kg, 12, 'the hydrated snapshot itself is not mutated');
  assert.equal(tree.some(node => node.props.testID === 'admin-qolip-rework-notice'), false);
  for (const [state, key] of [['frozen', 'worker.freeze.active'], ['freeze_requested', 'worker.freeze.requested']]) {
    detail.value.orderControl = state;
    const notice = nodes(View(props)).find(node => node.type === 'ControlNotice');
    assert.equal(notice.props.text, key);
  }
  for (const state of ['active', null]) {
    detail.value.orderControl = state; assert.equal(nodes(View(props)).some(node => node.type === 'ControlNotice'), false);
  }
  detail.value.orderControl = 'frozen';
  detail.value.qolipInRework = true;
  for (const role of ['admin', 'brigader']) {
    const notice = nodes(View({ ...props, session: { profile: { role } } })).find(node => node.props.testID === 'admin-qolip-rework-notice');
    assert.equal(notice.props.children.props.children, 'qolipReworkText.order_unavailable');
    const both = nodes(View({ ...props, session: { profile: { role } } })).filter(node => node.type === 'ControlNotice' || node.props.testID === 'admin-qolip-rework-notice');
    assert.deepEqual(both.map(node => node.type === 'ControlNotice' ? node.type : node.props.testID), ['ControlNotice', 'admin-qolip-rework-notice']);
  }
  assert.equal(nodes(View({ ...props, session: { profile: { role: 'sales_manager' } } })).some(node => node.props.testID === 'admin-qolip-rework-notice'), false);
  detail.value.qolipInRework = false;
  detail.value.orderControl = null;
  assert.equal(nodes(View(props)).some(node => node.props.testID === 'admin-qolip-rework-notice'), false);
  detail.value.map.combo = { name: 'C' }; detail.value.map.products = [{ product: 'P' }];
  assert.equal(nodes(View(props)).find(node => node.type === 'Combo').props.model.combo.name, 'C');
  detail.value.map.products = []; assert.equal(nodes(View(props)).some(node => node.type === 'Combo'), false);
  detail.value.map.products = [{ product: 'P' }];
  assert.equal(nodes(View({ ...props, session: { profile: { role: 'sales_manager' } } })).some(node => node.type === 'Combo'), false);
  detail.value.metadata = { createdAtUnix: null, creator: { role: 'telegram', displayName: 'Ana' } };
  assert.deepEqual(nodes(View(props)).find(node => node.type === 'Metadata').props.rows.map(row => row.value), ['detail.date_missing', 'detail.creator_role.telegram · Ana']);
  detail = { valid: true, loading: false, error: 'failed' };
  const failed = nodes(View(props)); assert.equal(failed.some(node => node.type === 'ListItem'), false);
  assert.deepEqual(failed.filter(node => node.type === 'Text').slice(0, 3).map(node => node.props.children), ['worker.order.code', '1', 'Old']);
  assert.deepEqual(failed.find(node => node.type === 'Metadata').props.rows.map(row => row.value), ['loading', 'loading']);
  assert.equal(failed.find(node => node.type === 'Summary').props.model.canExpand, false);
  assert.equal(nodes(View({ ...props, session: { profile: { role: 'sales_manager' } } })).some(node => node.type === 'Metadata'), false);
  assert.equal(nodes(View({ ...props, ticket: { kind: 'pending' } })).some(node => node.type === 'Metadata'), false);
  assert.equal(failed.find(node => node.type === 'Button' && node.props.label === 'retry').props.onPress, retry);
  assert.equal(failed.find(node => node.type === 'WorkerIconButton').props.label, 'worker.action.close');
  assert.equal(failed.find(node => node.type === 'WorkerIconButton').props.onPress, close);
  const pending = nodes(View({ ...props, ticket: { kind: 'pending' } }));
  assert.equal(pending.find(node => node.type === 'WorkerIconButton').props.onPress, close);
  assert.equal(pending.find(node => node.type === 'WorkerIconButton').props.tonal, false);
  detail = { valid: true, loading: false, value: { kind: 'pending', managerName: 'Manager', template: { order_number: '17', customer: 'Ana', product: 'Film', status: 'Rulon', kg: 100, frame_product_size_mm: 60, frame_count: 2, production_options: null, effective_layers: [] } } };
  const hydratedPending = nodes(View({ ...props, ticket: { kind: 'pending' } }));
  assert.equal(hydratedPending.find(node => node.type === 'Text').props.children, '№17 · Chala buyurtma');
  assert.equal(hydratedPending.find(node => node.type === 'Pending').props.rows.at(-1).value, 'Manager');
  assert.equal(hydratedPending.some(node => node.type === 'Summary' || node.type === 'Combo'), false);
  assert.equal(hydratedPending.some(node => node.props.testID === 'admin-qolip-rework-notice'), false);
  assert.equal(hydratedPending.some(node => node.type === 'ControlNotice'), false);
  detail = { valid: false }; assert.equal(View(props).type, 'View'); assert.equal(nodes(View(props)).length, 1);
});

for (const platform of ['ios', 'android']) test(`${platform} control notice renders passive native error colors and text`, () => {
  const Component = load(`admin/AdminWorkMapControlNotice.${platform}.tsx`, {
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ errorContainer: 'error-bg', onErrorContainer: 'error-fg' }) },
    'react-native': { PlatformColor: value => value, StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
  }).AdminWorkMapControlNotice;
  const row = Component({ text: 'Frozen' });
  assert.equal(row.props.testID, 'admin-order-control-notice'); assert.equal(row.props.children.props.children, 'Frozen');
  assert.equal(row.props.style[1].backgroundColor, platform === 'ios' ? 'secondarySystemBackground' : 'error-bg');
  assert.equal(row.props.children.props.style[1].color, platform === 'ios' ? 'systemRed' : 'error-fg');
  assert.equal(row.props.onPress, undefined);
});

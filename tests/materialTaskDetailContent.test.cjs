const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { hooks, tick, defer, jsx } = require('./support/workerPaddonHarness.cjs');

function setup({ detailError } = {}) {
  const runner = hooks(), calls = [], detail = defer(), unlink = defer();
  let current = true, focus, alert, pendingSheet;
  const p = (key, values) => key + (values ? JSON.stringify(values) : '');
  const session = { profile: { role: 'material_taminotchi' } }, witness = { session };
  const order = { map: { id: 'order', code: 'FULL', title: 'Full title', product_code: 'PET', image_id: 'image', customer_name: 'Buyer', nodes: [] } };
  const assignment = { order_id: 'order', barcode: 'R', stock_status: 'available', consumed_qty: 0 };
  const sheet = { isOpen: () => false, open(content, options) { pendingSheet = { content, options }; }, close() {} };
  const mocks = {
    react: runner.react, 'react/jsx-runtime': jsx,
    'expo-router': { useFocusEffect: callback => { focus = callback; }, router: { push: value => calls.push(['route', value]) } },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert: (...args) => { alert = args; } } },
    '../components/WorkerAssignedMaterialQr': { WorkerAssignedMaterialQr: 'MaterialQr' },
    '../components/WorkerWipHistory': { WorkerWipHistory: 'WipHistory' },
    '../components/useWorkerOrderText': { useWorkerOrderText: () => ({ locale: 'uz', p }) },
    '../gscale/gscaleRouteArgs': { serializeGScaleModeArgs: value => ({ order: JSON.stringify(value.order) }) },
    '../nativeSheet': { useNativeSheet: () => sheet },
    '../rawMaterialUnlinkApi': { adminUnlinkRawMaterialAssignment: async (_s, id, barcode, guard) => { guard(); calls.push(['unlink', id, barcode]); await unlink.promise; guard(); } },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'scale' }, canOpenRoute: () => true },
    '../shared/dartApparatus': { dartTrim: value => value.trim() },
    '../shared/camera/synchronousGuard': { isSynchronouslyTrue: callback => { try { return callback() === true; } catch { return false; } } },
    '../shared/localization': { adminText: (key, _locale, values) => p(key, values), productionText: (key, _locale, values) => p(key, values) },
    '../shared/productionDataRevisionRuntime': { productionDataRevision: { subscribe: () => () => {} } },
    '../shared/mobileApiException': { MobileApiException: class extends Error {} },
    '../workerControlsApi': { WorkerControlException: class extends Error {} },
    '../workerOpeningWipRecordsApi': { adminOpeningWipRecords: async (_s, _options, guard) => { guard(); return []; } },
    '../workerWipApi': { adminWipBatches: async (_s, options) => { assert(options.current()); calls.push('map-read'); return []; } },
    './materialReceiptArgs': { materialReceiptArgs: value => ({ order: { id: value.map.id, code: value.map.code } }) },
    './materialTaskDetailApi': { readMaterialTaskDetail: async (_s, _w, _r, guard) => { assert(guard()); calls.push('detail'); if (detailError) throw detailError; return detail.promise; } },
    './materialTaskDetailSections': {
      materialDetailAssignments: async (_s, full, guard) => { guard(); assert.equal(full, order); calls.push('materials'); return [assignment]; },
      materialDetailAttachedMolds: async (_s, full, guard) => { guard(); assert.equal(full, order); calls.push('molds'); return []; },
      materialDetailCanUnlink: row => row.stock_status === 'available' && row.consumed_qty <= 0, materialMoldHexColor: () => null,
    },
    './materialTaskMapModel': { materialMapOpeningBatches: () => [], materialTaskMapRows: () => [] },
    './materialSequenceModel': { materialSequenceCode: value => value.map.code },
  };
  const filename = path.resolve(__dirname, '../src/material/useMaterialTaskDetailContent.tsx'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const props = { session, witness, row: { id: 'order', code: 'SUMMARY', order_number: '', title: 'Summary', customer_name: '', image_id: '' }, isCurrent: () => current };
  const h = { calls, order, assignment, detail, unlink, runner, setCurrent: value => { current = value; },
    render() { runner.begin(); h.model = loaded.exports.useMaterialTaskDetailContent(props); runner.flush(); return h.model; },
    focus: () => focus(), alert: () => alert, sheet: () => pendingSheet, dispose: runner.dispose };
  h.render(); return h;
}
async function ready(h) { h.detail.resolve(h.order); await tick(); h.render(); await tick(); return h.render(); }

test('full-detail transport failure uses the source localized fallback instead of internal exception text', async () => {
  const h = setup({ detailError: new Error('internal transport failure') });
  try {
    await tick(); h.render();
    assert.equal(h.model.shown.error, 'production.open_failed');
  } finally { h.dispose(); }
});

test('Material detail loads sections only after the selected full order arrives and retains its real identity', async () => {
  const h = setup(); assert.deepEqual(h.calls, ['detail']);
  await ready(h); assert.deepEqual(h.calls, ['detail', 'molds', 'materials']);
  assert.equal(h.model.code, 'FULL'); assert.equal(h.model.imageId, 'image');
  assert.deepEqual(h.model.materials.value, [h.assignment]);
  h.dispose();
});

test('a late full detail cannot start sections after the original modal lifetime expires', async () => {
  const h = setup(); h.setCurrent(false); await ready(h);
  assert.equal(h.model.order, null); assert.deepEqual(h.calls, ['detail']); h.dispose();
});

test('Material receive routes only the full order and refreshes assignments when returning', async () => {
  const h = setup(); await ready(h); h.model.receive(); h.model.receive();
  const routes = h.calls.filter(value => Array.isArray(value) && value[0] === 'route');
  assert.equal(routes.length, 1); assert.equal(routes[0][1].pathname, '/android-material/receipt');
  assert.deepEqual(JSON.parse(routes[0][1].params.order), { id: 'order', code: 'FULL' });
  h.render(); assert.equal(h.model.canReceive, false);
  h.focus(); await tick(); h.render(); assert.equal(h.model.canReceive, true);
  assert.equal(h.calls.filter(value => value === 'materials').length, 2); h.dispose();
});

test('Material unlink rechecks confirmation and cannot submit twice before a render or after retirement', async () => {
  const h = setup(); await ready(h); h.model.unlink(h.assignment);
  const confirm = h.alert()[2].find(value => value.style === 'destructive');
  confirm.onPress(); confirm.onPress(); assert.equal(h.calls.filter(value => Array.isArray(value) && value[0] === 'unlink').length, 1);
  h.unlink.resolve(); await tick(); h.render(); assert.equal(h.model.notice, 'worker.material.unlink.success');
  h.model.unlink(h.assignment); const stale = h.alert()[2].find(value => value.style === 'destructive');
  h.setCurrent(false); stale.onPress(); assert.equal(h.calls.filter(value => Array.isArray(value) && value[0] === 'unlink').length, 1); h.dispose();
});

test('Material stage history and attached mold QR explicitly disable writes in the reused components', async () => {
  const h = setup(); await ready(h);
  h.model.openStage('apparatus:print:a', 'Print'); assert.equal(h.sheet().content.type, 'WipHistory');
  assert.equal(h.sheet().content.props.allowReprint, false); assert.equal(h.sheet().content.props.allowReactivation, false);
  assert.equal(h.sheet().content.props.isCurrent(), true);
  h.model.openMoldQr({ qolip_code: 'Q', name: 'Mold', code: 'SKU', size: 2, customer_names: [] });
  assert.equal(h.sheet().content.type, 'MaterialQr'); assert.equal(h.sheet().content.props.allowReprint, false);
  h.setCurrent(false); assert.equal(h.sheet().content.props.isCurrent(), false); h.dispose();
});

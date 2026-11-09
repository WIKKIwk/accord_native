const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const location = (overrides = {}) => ({ id: 'source', block: 'A blok', warehouse: 'Qolip ombor',
  item_code: 'ITEM-1', item_name: 'Qolip', qolip_code: 'Q-1', size: 44, quantity: 1,
  row_letter: 'A', column_number: 1, location_label: 'A1', ...overrides });
const target = { name: 'B blok', warehouse: 'Qolip ombor' };
function harness(response) {
  const calls = [], session = { token: 'token' };
  const api = load('qolip/qolipLocationsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      calls.push({ session: value, target, init });
      return typeof response === 'function' ? response(calls.length, init) : response;
    } },
  });
  const logic = load('qolip/qolipLocationLogic.ts', { './qolipApiCommon': common });
  return { api, logic, calls, session };
}

test('location model preserves defaults, numeric conversion and optional column', () => {
  const { api } = harness(json({}));
  assert.deepEqual(api.qolipLocationFromJson({ id: 8, size: 42.9, quantity: 1.8, column_number: null }), {
    id: '8', block: '', warehouse: '', item_code: '', item_name: '', qolip_code: '', size: 42,
    quantity: 1, row_letter: '', column_number: null, location_label: '',
  });
  assert.throws(() => api.qolipLocationFromJson({ size: '42' }));
  assert.throws(() => api.qolipLocationFromJson(null));
});

test('location reader sends a trimmed block query and preserves absent-list behavior', async () => {
  const { api, calls, session } = harness(index => json(index === 1 ? { locations: [location()] } : {}));
  assert.deepEqual(await api.qolipLocations(session, ' A blok '), [location()]);
  assert.equal(calls[0].target, '/v1/mobile/qolip/locations?block=A+blok');
  assert.deepEqual(await api.qolipLocations(session, 'A blok'), []);
  await assert.rejects(harness(new Response('bad', { status: 500 })).api.qolipLocations(session, 'A'), /Qolip locations failed/);
});

// Source assertions mirror the separately run V2 test/qolip_cell_qr_flow_test.dart case.
// That test uses HttpOverrides rather than the MockClient recorder.
test('save location sends selected child code, size, cell and product details', async () => {
  const returned = location({ qolip_code: 'QOLIP-0002', size: 42, row_letter: 'A', column_number: 2, location_label: 'A2' });
  const { api, calls, session } = harness(json({ location: returned }));
  const product = { code: ' ITEM-001 ', name: ' Kross qolip ', qolip_code: ' QOLIP-0002 ', size: 42 };
  assert.deepEqual(await api.qolipSaveLocation(session, { block: { name: ' A blok ', warehouse: ' Qolip ombor ' },
    product, quantity: 1, rowLetter: ' A ', columnNumber: 2 }), returned);
  assert.equal(calls[0].target, '/v1/mobile/qolip/locations');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { block: 'A blok', warehouse: 'Qolip ombor', item_code: 'ITEM-001',
    item_name: 'Kross qolip', qolip_code: 'QOLIP-0002', size: 42, quantity: 1, row_letter: 'A', column_number: 2 });
});

test('explicit code and size override the product and omitted optional fields stay absent', async () => {
  const { api, calls, session } = harness(() => json({ location: location() }));
  await api.qolipSaveLocation(session, { block: target, product: { code: 'I', name: 'N', qolip_code: 'old', size: 10 },
    qolipCode: ' new ', size: 12, quantity: 3 });
  assert.deepEqual(JSON.parse(calls[0].init.body), { block: 'B blok', warehouse: 'Qolip ombor', item_code: 'I', item_name: 'N',
    qolip_code: 'new', size: 12, quantity: 3 });
  await api.qolipSaveLocation(session, { block: target, quantity: 0, rowLetter: ' ', columnNumber: 0 });
  assert.deepEqual(JSON.parse(calls[1].init.body), { block: 'B blok', warehouse: 'Qolip ombor', quantity: 0, column_number: 0 });
});

test('single move sends uppercase row and preserves the server error code', async () => {
  const { api, calls, session } = harness(json({ location: location({ block: 'B blok', row_letter: 'Z', column_number: 13 }) }));
  const moved = await api.qolipMoveLocation(session, { locationId: ' source ', targetBlock: target, quantity: 2,
    rowLetter: ' z ', columnNumber: 13 });
  assert.equal(moved.block, 'B blok');
  assert.equal(calls[0].target, '/v1/mobile/qolip/locations/move');
  assert.deepEqual(JSON.parse(calls[0].init.body), { location_id: 'source', block: 'B blok', warehouse: 'Qolip ombor',
    quantity: 2, row_letter: 'Z', column_number: 13 });
  const failure = harness(json({ error: 'insufficient_stock', message: ' Kam ' }, 409));
  await assert.rejects(failure.api.qolipMoveLocation(failure.session, { locationId: 'source', targetBlock: target,
    quantity: 2, rowLetter: 'Z', columnNumber: 13 }), error =>
    error instanceof MobileApiException && error.code === 'insufficient_stock' && error.statusCode === 409 && error.message === 'Kam');
});

test('batch move rejects empty or repeated IDs before sending and checks returned count', async () => {
  const { api, calls, session } = harness(() => json({ locations: [location({ id: 'one' }), location({ id: 'two' })] }));
  const args = { targetBlock: target, rowLetter: ' z ', columnNumber: 13 };
  for (const locations of [[], [location({ id: ' ' })], [location({ id: 'one' }), location({ id: ' one ' })]]) {
    await assert.rejects(api.qolipMoveLocations(session, { ...args, locations }), error => error.code === 'location_invalid');
  }
  assert.equal(calls.length, 0);
  const rows = [location({ id: ' one ', quantity: 2 }), location({ id: 'two', quantity: 4 })];
  assert.equal((await api.qolipMoveLocations(session, { ...args, locations: rows })).length, 2);
  assert.deepEqual(JSON.parse(calls[0].init.body), { moves: [
    { location_id: 'one', block: 'B blok', warehouse: 'Qolip ombor', quantity: 2, row_letter: 'Z', column_number: 13 },
    { location_id: 'two', block: 'B blok', warehouse: 'Qolip ombor', quantity: 4, row_letter: 'Z', column_number: 13 },
  ] });
  const partial = harness(json({ locations: [location()] }));
  await assert.rejects(partial.api.qolipMoveLocations(partial.session, { ...args, locations: rows }),
    error => error.code === 'qolip_location_move_batch_invalid_response');
});

// @v2-test test/qolip_move_contract_test.dart
test('old backend only offers the source block; new backend allows cross-block choices', () => {
  const { logic } = harness(json({}));
  const blocks = [{ name: 'A blok', warehouse: 'Qolip ombor' }, target];
  assert.deepEqual(logic.qolipMoveTargetBlocks({ blocks, source: location(), supportsCrossBlockMove: false }).map(block => block.name), ['A blok']);
  assert.deepEqual(logic.qolipMoveTargetBlocks({ blocks, source: location(), supportsCrossBlockMove: true }).map(block => block.name), ['A blok', 'B blok']);
  assert.deepEqual(logic.qolipMoveTargetBlocks({ blocks: [], source: location(), supportsCrossBlockMove: true }),
    [{ name: 'A blok', warehouse: 'Qolip ombor' }]);
});

test('stale move response is rejected unless block, warehouse, code, row and column match', () => {
  const { logic } = harness(json({}));
  const args = { targetBlock: target, qolipCode: 'Q-1', rowLetter: 'Z', columnNumber: 13 };
  assert.equal(logic.qolipMoveReachedTarget({ ...args, moved: location({ block: 'A blok', row_letter: 'Z', column_number: 13 }) }), false);
  assert.equal(logic.qolipMoveReachedTarget({ ...args, moved: location({ block: ' b BLOK ', warehouse: 'qolip ombor',
    qolip_code: ' q-1 ', row_letter: ' z ', column_number: 13 }) }), true);
  for (const override of [{ warehouse: 'other' }, { qolip_code: 'Q-2' }, { row_letter: 'Y' }, { column_number: 12 }]) {
    assert.equal(logic.qolipMoveReachedTarget({ ...args, moved: location({ block: 'B blok', row_letter: 'Z', column_number: 13, ...override }) }), false);
  }
});

test('deferred test mode cannot send a location request to a backend', async () => {
  const { api, calls, session } = harness(json({ locations: [] }));
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipLocations(session, 'A'), /test mode is not yet ported/);
  assert.equal(calls.length, 0);
});

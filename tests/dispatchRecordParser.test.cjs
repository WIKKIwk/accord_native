const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// This standalone regression also runs against the parser-only a947a1a extraction.
function fixture(body = {}) {
  const root = path.resolve(__dirname, '..');
  const filename = process.env.NOTIFICATION_API_TEST_FILE || path.join(root, 'src/shared/notificationApi.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const modelFilename = path.join(root, 'src/shared/notification/notificationDetailModel.ts');
  let model;
  if (fs.existsSync(modelFilename)) {
    model = new Module(modelFilename, module); model.filename = modelFilename; model.paths = module.paths;
    model._compile(ts.transpileModule(fs.readFileSync(modelFilename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, modelFilename);
  }
  mod.require = name => name === '../authorizedFetch' ? { authorizedFetch: async () => ({ status: 200, json: async () => body }) }
    : name === './notification/notificationDetailModel' && model ? model.exports : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('exported dispatch parser preserves all fields, defaults and recognized statuses', () => {
  const { dispatchRecordFromJson: parse } = fixture();
  assert.deepEqual(parse({}), { id: '', record_type: '', supplier_ref: '', supplier_name: '', item_code: '', item_name: '', uom: '',
    sent_qty: 0, accepted_qty: 0, amount: 0, currency: '', note: '', event_type: '', highlight: '', status: 'pending', created_label: '' });
  const record = { id: 'R', record_type: 'dispatch', supplier_ref: 'S', supplier_name: 'Supplier', item_code: 'A', item_name: 'Item',
    uom: 'kg', sent_qty: 3.5, accepted_qty: 2.25, amount: 40, currency: 'USD', note: 'note', event_type: 'event',
    highlight: 'highlight', status: ' ACCEPTED ', created_label: 'date' };
  assert.deepEqual(parse(record), { ...record, status: 'accepted' });
  for (const status of ['accepted', 'partial', 'rejected', 'cancelled', 'draft']) assert.equal(parse({ status }).status, status);
  for (const status of ['pending', 'unexpected', '', null]) assert.equal(parse({ status }).status, 'pending');
});

test('exported dispatch parser enforces each existing string and number field type', () => {
  const { dispatchRecordFromJson: parse } = fixture();
  for (const input of [null, [], 'text', 3]) assert.throws(() => parse(input), /Invalid notification object/);
  for (const field of ['id', 'record_type', 'supplier_ref', 'supplier_name', 'item_code', 'item_name', 'uom',
    'currency', 'note', 'event_type', 'highlight', 'status', 'created_label']) {
    assert.throws(() => parse({ [field]: 1 }), /Invalid notification string/, field);
  }
  for (const field of ['sent_qty', 'accepted_qty', 'amount']) assert.throws(() => parse({ [field]: '1' }), /Invalid notification number/, field);
});

test('notificationDetail retains the old parse order and uses the exported record parser', async () => {
  const row = { id: 'R', status: ' ACCEPTED ', sent_qty: 3.5 };
  const f = fixture({ record: row, comments: [{ body: 'Hi' }] });
  const detail = await f.notificationDetail({}, 'R');
  assert.deepEqual(detail.record, f.dispatchRecordFromJson(row));
  assert.deepEqual(detail.comments, [{ id: '', author_label: '', body: 'Hi', created_label: '' }]);
  await assert.rejects(fixture({ record: { status: 42 }, comments: 'bad' }).notificationDetail({}, 'R'), /Invalid notification string/);
  await assert.rejects(fixture({ record: { id: 42 }, comments: 'bad' }).notificationDetail({}, 'R'), /Invalid notification comments/);
  await assert.rejects(fixture({ record: [], comments: 'bad' }).notificationDetail({}, 'R'), /Invalid notification object/);
  assert.equal((await fixture({}).notificationDetail({}, 'R')).record.status, 'pending');
});

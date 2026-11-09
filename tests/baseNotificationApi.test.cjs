const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function fixture(status = 200, result = { record: { id: 'one', status: ' Accepted ', sent_qty: 2 }, comments: [{ body: 'Hi' }] }) {
  const calls = [];
  const modelFilename = path.resolve(__dirname, '../src/shared/notification/notificationDetailModel.ts');
  const model = new Module(modelFilename, module); model.filename = modelFilename; model.paths = module.paths;
  model._compile(ts.transpileModule(fs.readFileSync(modelFilename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, modelFilename);
  const filename = path.resolve(__dirname, '../src/shared/notificationApi.ts');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => name === '../authorizedFetch' ? {
    authorizedFetch: async (session, route, init = {}) => { calls.push({ session, route, ...init }); return { status, json: async () => result }; },
  } : name === './notification/notificationDetailModel' ? model.exports : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { ...loaded.exports, calls };
}

test('notification detail uses the V2 query and record/comment defaults', async () => {
  const f = fixture();
  const result = await f.notificationDetail({}, 'id +/');
  assert.equal(f.calls[0].route, '/v1/mobile/notifications/detail?receipt_id=id+%2B%2F');
  assert.equal(result.record.status, 'accepted');
  assert.equal(result.record.sent_qty, 2);
  assert.equal(result.record.item_name, '');
  assert.deepEqual(result.comments, [{ id: '', author_label: '', body: 'Hi', created_label: '' }]);
});

test('comments and unannounced responses preserve request fields', async () => {
  const f = fixture();
  await f.addNotificationComment({}, 'one', ' hello ');
  await f.supplierRespondUnannounced({}, 'one', false);
  assert.equal(f.calls[0].route, '/v1/mobile/notifications/comments?receipt_id=one');
  assert.deepEqual(JSON.parse(f.calls[0].body), { message: ' hello ' });
  assert.equal(f.calls[0].headers['Content-Type'], 'application/json');
  assert.equal(f.calls[1].route, '/v1/mobile/supplier/unannounced/respond');
  assert.deepEqual(JSON.parse(f.calls[1].body), { receipt_id: 'one', approve: false, reason: '' });
});

test('each notification operation requires HTTP 200 and validates response types', async () => {
  const f = fixture(201);
  await assert.rejects(f.notificationDetail({}, '1'), /Notification detail failed/);
  await assert.rejects(f.addNotificationComment({}, '1', 'm'), /Notification comment failed/);
  await assert.rejects(f.supplierRespondUnannounced({}, '1', true), /Supplier unannounced response failed/);
  await assert.rejects(fixture(200, { comments: [{}], record: { sent_qty: '2' } }).notificationDetail({}, '1'), TypeError);
  assert.equal((await fixture(200, {}).notificationDetail({}, '1')).record.status, 'pending');
});

test('dispatch statuses use Dart whitespace and explicit API failures keep Dart Exception text', { todo: 'Shared notification behavior remains at main pending account-switch decision' }, async () => {
  const partial = fixture(200, { record: { status: '\u0085 PARTIAL \u0085' }, comments: [] });
  assert.equal((await partial.notificationDetail({}, 'R')).record.status, 'partial');
  const f = fixture(403);
  for (const [method, args, message] of [
    ['notificationDetail', ['R'], 'Notification detail failed'],
    ['addNotificationComment', ['R', 'hello'], 'Notification comment failed'],
    ['supplierRespondUnannounced', ['R', true], 'Supplier unannounced response failed'],
  ]) await assert.rejects(f[method]({}, ...args), error => String(error) === `Exception: ${message}`);
});

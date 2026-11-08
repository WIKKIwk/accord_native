const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/shared/notification', `${file}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}
const model = load('notificationDetailModel');
const { NotificationDetailController } = load('notificationDetailController', { './notificationDetailModel': model });
const record = (patch = {}) => ({ id: 'R', record_type: '', supplier_ref: 'S', supplier_name: 'Supplier',
  item_code: 'I', item_name: 'Item', uom: 'kg', sent_qty: 10, accepted_qty: 4, amount: 0, currency: '',
  note: '', event_type: '', highlight: '', status: 'pending', created_label: '', ...patch });
const detail = (patch = {}, comments = []) => ({ record: record(patch), comments });
const wait = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const events = [], session = { profile: { ref: 'S' } }, role = options.role ?? 'supplier';
  const services = {
    markSeen: async (_session, id) => { events.push(['seen', id]); },
    read: async (_session, id) => { events.push(['read', id]); return options.detail ?? detail(); },
    comment: async (_session, id, body) => { events.push(['comment', id, body]); return options.detail ?? detail(); },
    respond: async (_session, id, approve, reason) => { events.push(['respond', id, approve, reason]); return detail({ status: approve ? 'accepted' : 'rejected' }); },
    recordDecision: (from, to) => events.push(['decision', from, to]),
    ...options.services,
  };
  const callbacks = { onCustomerDetail: id => events.push(['customer', id]),
    onForeignReceipt: message => events.push(['foreign', message]), onNotice: message => events.push(['notice', message]) };
  const controller = new NotificationDetailController(session, options.id ?? 'R', role, services, callbacks);
  return { controller, events, session };
}

test('V2 detail redirects customer MAT-DN IDs without marking or fetching, not result-event IDs', async () => {
  const direct = fixture({ role: 'customer', id: 'MAT-DN-12' });
  direct.controller.start(); await wait();
  assert.deepEqual(direct.events, [['customer', 'MAT-DN-12']]);
  const discussion = fixture({ role: 'customer', id: 'customer_delivery_result:MAT-DN-12' });
  discussion.controller.start(); await wait();
  assert.deepEqual(discussion.events.slice(0, 2), [['seen', 'customer_delivery_result:MAT-DN-12'], ['read', 'customer_delivery_result:MAT-DN-12']]);
});

test('V2 permissions distinguish supplier responses, acknowledgments, notes and Werka acceptance', () => {
  const policy = (role, row, comments = []) => model.notificationDetailPolicy(role, 'S', detail(row, comments));
  assert.equal(policy('supplier', { supplier_ref: ' another ' }).belongs, false);
  assert.equal(policy('supplier', { supplier_ref: ' \u0085S\u0085 ' }).belongs, true);
  assert.equal(policy('werka', { supplier_ref: 'another', status: 'draft' }).canConfirm, true);
  assert.equal(policy('werka', { status: 'pending', event_type: 'event' }).canConfirm, false);
  assert.equal(policy('supplier', { event_type: 'werka_unannounced_pending', note: 'issue' }).canRespond, true);
  assert.equal(policy('supplier', { event_type: 'werka_unannounced_pending', note: 'issue' }).canAcknowledge, false);
  assert.equal(policy('supplier', { status: 'partial' }).canAcknowledge, true);
  assert.equal(policy('supplier', { status: 'partial' }).canWriteIssueComment, true);
  const comments = [{ author_label: 'Supplier A', body: 'TASDIQLAYMAN', id: '', created_label: '' }];
  assert.equal(policy('supplier', { status: 'partial' }, comments).canWriteIssueComment, false);
  assert.equal(policy('werka', { status: 'partial' }, comments).canWriteIssueComment, true);
  assert.equal(policy('supplier', { event_type: 'supplier_ack', highlight: ' notice ', note: 'issue' }).showHighlight, true);
  assert.equal(policy('supplier', { event_type: 'supplier_ack', note: 'issue' }).canWriteIssueComment, false);
  assert.equal(model.notificationStatusLabel('partial'), 'Qisman qabul');
});

test('details mark seen before reading and reject another supplier receipt', async () => {
  const f = fixture({ detail: detail({ supplier_ref: 'other' }) });
  f.controller.start(); await wait();
  assert.deepEqual(f.events, [['seen', 'R'], ['read', 'R'], ['foreign', 'Bu receipt sizga tegishli emas.']]);
  assert.equal(f.controller.getSnapshot().detail, null);
  const fail = fixture({ services: { markSeen: async () => { throw Error('store'); } } });
  fail.controller.start(); await wait();
  assert.match(String(fail.controller.getSnapshot().error), /store/);
  assert.deepEqual(fail.events, []);
});

test('comments trim Dart whitespace, prevent duplicate sends and preserve error messages', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ detail: detail({ status: 'partial' }), services: {
    comment: async (_session, id, body) => { f.events.push(['comment', id, body]); return pending; },
  } });
  f.controller.start(); await wait();
  f.controller.setComment('\u0085 hello \u0085');
  const first = f.controller.sendComment(), second = f.controller.sendComment();
  assert.equal(f.controller.getSnapshot().sending, true);
  assert.deepEqual(f.events.filter(event => event[0] === 'comment'), [['comment', 'R', 'hello']]);
  finish(detail({ status: 'partial' })); await Promise.all([first, second]);
  assert.equal(f.controller.getSnapshot().comment, '');
  assert.equal(f.controller.getSnapshot().sending, false);
  const denied = fixture({ detail: detail({ status: 'rejected' }), services: { comment: async () => { throw Error('forbidden'); } } });
  denied.controller.start(); await wait(); denied.controller.setComment('x'); await denied.controller.sendComment();
  assert.deepEqual(denied.events.at(-1), ['notice', 'Bu receipt sizga tegishli emas.']);
});

test('acknowledgment sends the V2 fixed comment and unannounced decisions adjust shared summary', async () => {
  const ack = fixture({ detail: detail({ status: 'partial' }) });
  ack.controller.start(); await wait(); await ack.controller.acknowledge();
  assert.deepEqual(ack.events.at(-1), ['comment', 'R', 'Tasdiqlayman, shu holat bo‘lganini ko‘rdim.']);
  const f = fixture({ detail: detail({ event_type: 'werka_unannounced_pending' }) });
  f.controller.start(); await wait(); await f.controller.respond(false, ' \u0085reason\u0085 ');
  assert.deepEqual(f.events.slice(-2), [['respond', 'R', false, 'reason'], ['decision', 'pending', 'rejected']]);
  assert.equal(f.controller.getSnapshot().detail.record.status, 'rejected');
});

test('later reload wins and a stopped screen ignores stale response state', async () => {
  const pending = [];
  const f = fixture({ services: { read: async () => new Promise(resolve => pending.push(resolve)) } });
  f.controller.start(); await wait(); const newer = f.controller.reload(); await wait();
  pending[1](detail({ id: 'new' })); await newer;
  pending[0](detail({ id: 'old' })); await wait();
  assert.equal(f.controller.getSnapshot().detail.record.id, 'new');
  const last = f.controller.reload(); await wait(); f.controller.stop(); pending[2](detail({ id: 'stale' })); await last;
  assert.equal(f.controller.getSnapshot().detail.record.id, 'new');
});

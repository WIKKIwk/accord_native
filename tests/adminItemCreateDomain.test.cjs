const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateSupport.cjs');
test('source group ordering is parent BFS with stable case-sensitive names and cyclic tail', () => {
  const input = [s.group('Leaf', 'Branch'), s.group('Branch', 'All Item Groups'), s.group('Orphan', 'Missing'), s.group('All Item Groups'), s.group('Cycle A', 'Cycle B'), s.group('Cycle B', 'Cycle A'), s.group('ignored', '', ' Branch ')];
  assert.deepEqual(s.model.orderAdminItemCreateGroups(input), ['All Item Groups', 'Orphan', 'Branch', 'Leaf', 'Cycle A', 'Cycle B']);
  assert.equal(s.model.syncAdminItemCreateGroup(' branch ', ['Branch', 'All Item Groups']), 'Branch');
  assert.equal(s.model.syncAdminItemCreateGroup('unknown', ['Branch', 'All Item Groups']), 'All Item Groups');
  assert.equal(s.model.syncAdminItemCreateUom(' KG ', ['PCS', 'kg', 'KG']), 'kg');
});
test('only finished products require name and customer; raw items preserve source absent client validation', () => {
  const draft = { code: '', name: '', group: 'Raw', uom: 'PCS', customer: null }, tree = [s.group('Child', 'Tayyor mahsulot')];
  assert.deepEqual(s.model.validateAdminItemCreate(draft, ['PCS'], tree, false), { group: 'Raw', finished: false, uom: 'PCS' });
  assert.equal(s.model.validateAdminItemCreate(draft, ['PCS'], tree, true).error.literal, 'Faqat tayyor mahsulot qo‘shish mumkin');
  assert.equal(s.model.validateAdminItemCreate({ ...draft, group: 'Child' }, ['PCS'], tree, false).error.key, 'item.name_required');
  assert.equal(s.model.validateAdminItemCreate({ ...draft, group: 'Child', name: 'n' }, ['PCS'], tree, false).error.key, 'item.customer_required');
});
test('operation guards expire after settlement and detach cancels waits while allowing clean StrictMode attach', async () => {
  const scope = new s.scope.AdminItemCreateScope(() => true); scope.start(); const operation = scope.begin(), pending = s.deferred();
  const wait = operation.wait(pending.promise); scope.dispose(); await assert.rejects(wait, s.scope.AdminItemCreateScopeChanged); assert.equal(operation.current(), false);
  scope.start(); assert.equal(scope.current(), true); const next = scope.begin(); next.expire(); assert.throws(next.guard);
  pending.resolve('late'); await s.flush(); assert.equal(operation.current(), false);
});
test('thenable authority and reentrant authority permanently retire the original owner', () => {
  const asynchronous = new s.scope.AdminItemCreateScope(() => Promise.resolve(true)); assert.equal(asynchronous.start(), false);
  let reentrant = false; const scope = new s.scope.AdminItemCreateScope(() => !reentrant || scope.current()); scope.start(); reentrant = true;
  assert.equal(scope.current(), false); reentrant = false; assert.equal(scope.current(), false);
});
test('list exact 80 paging, raw duplicates and full accumulated cache match source', async () => {
  const rows = Array.from({ length: 80 }, (_, i) => s.item(String(i))), one = s.listOwner({ page: async (...args) => { one.calls.push(args); return args[3] ? [rows[0]] : rows; } });
  one.controller.start(); await s.flush(); assert.equal(one.controller.getSnapshot().hasMore, true); one.controller.scroll(421); assert.equal(one.calls.length, 1);
  one.controller.scroll(420); await s.flush(); assert.equal(one.calls[1][3], 80); assert.equal(one.controller.getSnapshot().items.length, 81); assert.equal(one.controller.getSnapshot().items[80], rows[0]);
  assert.equal(one.memory.readList('one').items.length, 81); assert.equal(one.controller.getSnapshot().hasMore, false); assert.equal(one.calls[0][5](), false);
});
test('220ms draft search leaves older query live until debounce then retires its response and body guard', async () => {
  const first = s.deferred(), second = s.deferred(); const one = s.listOwner({ page: (...args) => { one.calls.push(args); return one.calls.length === 1 ? first.promise : second.promise; } });
  one.controller.start(); one.controller.changeSearch('  New Query  '); one.clock.advance(219); assert.equal(one.calls.length, 1); assert.equal(one.calls[0][5](), true);
  one.clock.advance(1); assert.equal(one.calls.length, 2); assert.equal(one.calls[1][0], 'New Query'); assert.equal(one.calls[0][5](), false);
  first.resolve([s.item('old')]); second.resolve([s.item('new')]); await s.flush(); assert.equal(one.controller.getSnapshot().items[0].code, 'new');
});
test('query/group changes retain raw selection and group change flushes current search draft immediately', async () => {
  const one = s.listOwner(); one.controller.start(); await s.flush(); one.controller.toggleItem(s.item(' raw ')); one.controller.changeSearch(' draft '); one.controller.changeGroup(' Target '); await s.flush();
  assert.equal(one.clock.size(), 0); assert.equal(one.calls.at(-1)[0], 'draft'); assert.equal(one.calls.at(-1)[1], ' Target '); assert.deepEqual(one.controller.getSnapshot().selectedCodes, [' raw ']);
  one.controller.requestMove(); const prompt = one.controller.getSnapshot().prompt; assert.equal(prompt.group, 'Target'); assert.deepEqual(prompt.codes, [' raw ']); one.controller.chooseMove(prompt, false); assert.equal(one.controller.getSnapshot().moving, false);
});
test('partial move starts only after original confirmation is cleared, removes only updated codes and retries first page', async () => {
  const moved = []; const one = s.listOwner({ move: async (...args) => { moved.push(args); assert.equal(one.controller.getSnapshot().prompt, null); return { updated_count: 1, failed_count: 1, updated_item_codes: ['A'] }; } });
  one.controller.start(); await s.flush(); one.controller.toggleItem(s.item('A')); one.controller.toggleItem(s.item('B')); one.controller.requestMove(); assert.equal(one.controller.getSnapshot().notice.key, 'bulk_move.select_group');
  one.controller.changeGroup('G'); await s.flush(); one.controller.requestMove(); const prompt = one.controller.getSnapshot().prompt, commit = one.controller.chooseMove(prompt, true);
  assert.equal(moved.length, 0); assert.equal(one.controller.getSnapshot().moving, true); await commit(); await commit(); assert.equal(moved.length, 1);
  assert.deepEqual(one.controller.getSnapshot().selectedCodes, ['B']); assert.equal(one.controller.getSnapshot().notice.key, 'bulk_move.partial_success'); assert.equal(one.calls.at(-1)[3], 0);
});
test('stale confirmation cannot send after detach, and original item return cannot clear a newer account cache', async () => {
  const result = s.deferred(), one = s.listOwner({ openItem: () => result.promise }); one.controller.start(); await s.flush(); const open = one.controller.openItem(s.item('A'));
  one.controller.dispose(); one.memory.writeList(one.memory.ticket('new'), { query: 'new', group: '', items: [], hasMore: false }); result.resolve(); await open;
  assert.equal(one.memory.readList('new').query, 'new'); assert.equal(one.calls.length, 1);
});
test('group tree failure falls back to names while UOM reads start concurrently and empty UOM fails visibly', async () => {
  const tree = s.deferred(), uom = s.deferred(), calls = []; const one = s.formOwner({ tree: () => { calls.push('tree'); return tree.promise; }, uoms: () => { calls.push('uom'); return uom.promise; }, groups: async () => ['Fallback'] });
  one.controller.start(); assert.deepEqual(calls, ['tree', 'uom']); tree.reject(new Error('tree')); uom.resolve([]); await s.flush(); assert.equal(one.controller.getSnapshot().draft.group, 'Fallback');
  const dialog = one.controller.openDialog(); assert.equal(await one.controller.save(dialog), null); assert.equal(one.controller.getSnapshot().notice.key, 'item.uom_load_failed');
});
test('source saving visual snapshot stays stale until dialog rebuild; fields remain editable and live duplicate command lock holds', async () => {
  const duplicate = s.deferred(), created = s.deferred(); const one = s.formOwner({ initialItemGroup: 'Raw', duplicateItems: () => duplicate.promise, create: async input => { one.calls.push(input); return created.promise; } });
  one.controller.start(); await s.flush(); const dialog = one.controller.openDialog(); one.controller.changeField(dialog, 'code', 'old'); one.controller.changeField(dialog, 'name', 'oldName'); const saving = one.controller.save(dialog); await s.flush();
  assert.equal(one.controller.getSnapshot().saving, true); assert.equal(one.controller.getSnapshot().dialog.savingView, false); assert.equal(await one.controller.save(dialog), null);
  one.controller.changeField(dialog, 'code', 'new'); one.controller.changeField(dialog, 'name', 'newName'); duplicate.resolve([]); await s.flush(); assert.equal(one.calls[0].code, 'new'); assert.equal(one.calls[0].name, 'newName');
  created.resolve(s.item('CREATED')); await saving; assert.equal(one.controller.getSnapshot().draft.code, ''); assert.equal(one.controller.getSnapshot().notice.key, 'item.created');
});
test('create command survives its dialog outside dismissal, cannot close a newer dialog, and preserves shared acknowledgement clears', async () => {
  const create = s.deferred(); const one = s.formOwner({ create: () => create.promise }); one.controller.start(); await s.flush(); const dialog = one.controller.openDialog(); const saving = one.controller.save(dialog); await s.flush();
  assert.equal(one.controller.closeDialog(dialog, true), true); const next = one.controller.openDialog(); one.controller.changeField(next, 'name', 'new dialog text'); create.resolve(s.item('CREATED')); const item = await saving;
  assert.equal(one.controller.getSnapshot().draft.name, ''); assert.equal(one.controller.getSnapshot().dialog.id, next.id); assert.equal(one.controller.finishSaveDialog(dialog.id, item), null);
});
test('duplicate check is exact trimmed case-fold only and API failure surfaces source raw MobileApiException', async () => {
  const one = s.formOwner({ initialItemGroup: 'Raw', duplicateItems: async () => [s.item(' Code ')] }); one.controller.start(); await s.flush(); const dialog = one.controller.openDialog(); one.controller.changeField(dialog, 'code', 'code');
  assert.equal(await one.controller.save(dialog), null); assert.equal(one.controller.getSnapshot().notice.key, 'item.already_exists'); assert.equal(one.calls.length, 0);
  const other = s.formOwner({ create: async () => { throw new s.MobileApiException({ code: 'failure', message: 'raw backend text' }); } }); other.controller.start(); await s.flush(); await other.controller.save(other.controller.openDialog()); assert.equal(other.controller.getSnapshot().notice.literal, 'raw backend text');
});
test('local/customer picker uses 50 paging, 240 scroll, duplicates and latest blank page cache rather than accumulated list', async () => {
  const memory = new s.cache.AdminItemCreateMemoryCache(), rows = Array.from({ length: 50 }, (_, i) => ({ ref: String(i), name: String(i), phone: '' }));
  const one = s.pickerOwner({ cache: { store: memory, namespace: 'one', isCustomer: () => true }, fetch: async (...args) => { one.calls.push(args); return args[2] ? [rows[0]] : rows; } });
  one.controller.start(); await s.flush(); one.controller.scroll(241); assert.equal(one.calls.length, 1); one.controller.scroll(240); await s.flush(); assert.equal(one.calls[1][2], 50);
  assert.equal(one.controller.getSnapshot().items.length, 51); assert.equal(memory.readCustomers('one').items.length, 1); assert.equal(one.calls[0][4](), false);
});
test('picker result is delivered once only after genuine native dismissal acknowledgement; stale replay acknowledgements do nothing', async () => {
  const row = { ref: 'A', name: 'A', phone: '' }, one = s.pickerOwner({ fetch: async () => [row] }); one.controller.start(); await s.flush(); one.controller.select(row);
  assert.equal(one.closed.length, 0); assert.equal(one.controller.getSnapshot().closing, true); one.controller.completeClose(); one.controller.completeClose(); assert.deepEqual(one.closed, [row]);
});
test('customer-create is original picker lifetime owned through blur and cache clear fences old pending blank response', async () => {
  const result = s.deferred(), read = s.deferred(), memory = new s.cache.AdminItemCreateMemoryCache(), customer = { ref: 'new', name: 'New', phone: '' };
  const one = s.pickerOwner({ fetch: () => read.promise, create: () => result.promise, cache: { store: memory, namespace: 'one', isCustomer: () => true } }); one.controller.start(); const create = one.controller.create();
  memory.clearCustomers('one'); read.resolve([{ ...customer, ref: 'old' }]); result.resolve(customer); await create; await s.flush(); assert.equal(memory.readCustomers('one'), null); assert.equal(one.closed.length, 0);
  one.controller.completeClose(); assert.deepEqual(one.closed, [customer]);
});
test('source picker query backing changes immediately without results publication until 220ms; old response is accepted before that reload', async () => {
  const response = s.deferred(), one = s.pickerOwner({ fetch: (...args) => { one.calls.push(args); return one.calls.length === 1 ? response.promise : Promise.resolve([]); } });
  one.controller.start(); let publications = 0; one.controller.subscribe(() => { publications++; }); one.controller.search(' new query ');
  assert.equal(one.controller.getSnapshot().query, ' new query '); assert.equal(publications, 0); response.resolve([{ name: 'old request', ref: 'old' }]); await s.flush(); assert.equal(one.controller.getSnapshot().items[0].ref, 'old');
  one.clock.advance(219); assert.equal(one.calls.length, 1); one.clock.advance(1); await s.flush(); assert.equal(one.calls[1][0], 'new query'); assert.deepEqual(one.controller.getSnapshot().items, []);
});
test('source group/finished command capture precedes duplicate await while name/code/UOM buffers are reread afterward', async () => {
  const duplicate = s.deferred(), one = s.formOwner({ initialItemGroup: 'Raw', duplicateItems: () => duplicate.promise }); one.controller.start(); await s.flush(); const dialog = one.controller.openDialog();
  one.controller.changeField(dialog, 'code', 'old'); const saving = one.controller.save(dialog); await s.flush(); one.controller.setGroup(dialog.id, 'Tayyor mahsulot'); one.controller.setUom(dialog.id, 'kg');
  const current = one.controller.getSnapshot().dialog; one.controller.changeField(current, 'code', 'new'); one.controller.changeField(current, 'name', 'new name'); duplicate.resolve([]); await saving;
  assert.deepEqual(one.calls[0], { code: 'new', name: 'new name', uom: 'kg', itemGroup: 'Raw', customerRef: '' });
});
test('unchanged group text does not rebuild the source customer/code branch merely because late ancestry metadata arrives', async () => {
  const tree = s.deferred(), one = s.formOwner({ initialItemGroup: 'Child', tree: () => tree.promise }); one.controller.start(); const dialog = one.controller.openDialog(); assert.equal(dialog.finishedView, false);
  tree.resolve([s.group('Child', 'Tayyor mahsulot'), s.group('Tayyor mahsulot')]); await s.flush(); assert.equal(one.controller.getSnapshot().draft.group, 'Child'); assert.equal(one.controller.getSnapshot().dialog.finishedView, false);
  one.controller.refreshDialog(dialog.id); assert.equal(one.controller.getSnapshot().dialog.finishedView, true);
});
test('reentrant subscription cannot send a second read or mutate selection during source list acknowledgement', async () => {
  const one = s.listOwner(); let attempted = false; one.controller.subscribe(() => { if (!one.controller.getSnapshot().initialLoading && !attempted) { attempted = true; one.controller.reload(); one.controller.changeGroup('reentrant'); one.controller.toggleItem(s.item('reentrant')); } });
  one.controller.start(); await s.flush(); assert.equal(one.calls.length, 1); assert.equal(one.controller.getSnapshot().group, ''); assert.deepEqual(one.controller.getSnapshot().selectedCodes, []);
});
test('retirement during duplicate lookup cancels its wrapper immediately, expires body guard and never sends a create', async () => {
  const duplicate = s.deferred(); let readGuard; const one = s.formOwner({ duplicateItems: (_code, guard) => { readGuard = guard; return duplicate.promise; } }); one.controller.start(); await s.flush(); const dialog = one.controller.openDialog(); one.controller.changeField(dialog, 'code', 'X');
  const pending = one.controller.save(dialog); await s.flush(); one.controller.dispose(); await pending; assert.throws(readGuard); duplicate.resolve([]); await s.flush(); assert.equal(one.calls.length, 0);
});
test('source customer create receives Dart-trimmed initialName including U+0085 without altering embedded characters', async () => {
  const created = [], one = s.pickerOwner({ create: async query => { created.push(query); return null; } }); one.controller.start(); await s.flush();
  one.controller.search('\u0085 Raw\u0085Name \u0085'); await one.controller.create(); assert.deepEqual(created, ['Raw\u0085Name']);
  one.controller.search('\u0085 \u0085'); await one.controller.create(); assert.deepEqual(created, ['Raw\u0085Name', '']);
});

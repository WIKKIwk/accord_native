const test = require('node:test'), assert = require('node:assert/strict');
const { fixture: contentFixture, s, byID, nodes, text, modifier, press, submit } = require('./adminItemDetailDecisionContentSupport.cjs');
const fixture = (platform = 'android', options = {}) => contentFixture(platform, { ...options, detail: s.detail({ is_finished_goods: true, ...options.detail }) });

for (const platform of ['android', 'ios']) {
  test(`${platform}: customer content mount/StrictMode never activates a read; genuine host activation does once`, async () => {
    const f = fixture(platform); await f.open('customers'); let tree = f.renderContent(); f.replay(); f.renderContent();
    assert.equal(f.f.calls.length, 0); assert.equal(byID(tree, 'admin-item-customer-content').props.style[1].height, 672); assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.paddingBottom === 40).length);
    assert.ok(byID(tree, 'admin-item-customer-done')); assert.equal(platform === 'android' ? byID(tree, 'admin-item-customer-done').props.enabled : !modifier(byID(tree, 'admin-item-customer-done'), 'disabled')[0], true);
    f.activate(); f.activate(); await s.flush(); tree = f.renderContent(); assert.deepEqual(f.f.calls.map(value => value.slice(0, 2)), [['customers', '']]); assert.ok(byID(tree, 'admin-item-customer-option-C')); f.cleanup();
  });
  test(`${platform}: actual native search value wins delayed JS change; suffix disabled loading, IME remains overlapping`, async () => {
    const pending = [], f = fixture(platform, { deps: { customers: async query => { const wait = s.deferred(); pending.push({ query, wait }); return wait.promise; } } });
    await f.open('customers'); f.renderContent(); f.activate(); let tree = f.renderContent(), field = byID(tree, 'admin-item-customer-search'), value = field.props.value ?? field.props.text;
    assert.equal(pending.length, 1); assert.equal(platform === 'android' ? byID(tree, 'admin-item-customer-search-submit').props.enabled : !modifier(byID(tree, 'admin-item-customer-search-submit'), 'disabled')[0], false);
    value.set(' New native query '); press(byID(tree, 'admin-item-customer-search-submit')); assert.equal(pending.length, 1);
    if (platform === 'android') field.props.keyboardActions.onSearch('old callback value'); else submit(field);
    assert.equal(pending.length, 2); assert.equal(pending[1].query, 'New native query');
    pending[1].wait.resolve([{ ref: 'N', name: 'New', phone: '' }]); await s.flush(); tree = f.renderContent(); assert.ok(byID(tree, 'admin-item-customer-option-N'));
    pending[0].wait.resolve([{ ref: 'O', name: 'Old settlement', phone: '' }]); await s.flush(); tree = f.renderContent(); assert.ok(byID(tree, 'admin-item-customer-option-O')); assert.equal(byID(tree, 'admin-item-customer-option-N'), undefined); f.cleanup();
  });
  test(`${platform}: search field is explicit-submit, Done remains enabled on loading/error/empty`, async () => {
    let fail = true; const f = fixture(platform, { deps: { customers: async () => { if (fail) throw Error('network controlled'); return []; } } });
    await f.open('customers'); let tree = f.renderContent(), field = byID(tree, 'admin-item-customer-search'); (field.props.onValueChange ?? field.props.onTextChange)(' typed '); assert.equal(f.f.calls.length, 0);
    f.activate(); await s.flush(); tree = f.renderContent(); assert.ok(text(tree).includes('detail.customer_load_failed')); const doneError = byID(tree, 'admin-item-customer-done'); assert.equal(platform === 'android' ? doneError.props.enabled : !modifier(doneError, 'disabled')[0], true);
    fail = false; press(byID(tree, 'admin-item-customer-retry')); await s.flush(); tree = f.renderContent(); assert.ok(text(tree).includes('detail.customer_not_found')); press(byID(tree, 'admin-item-customer-done')); assert.equal(f.closes.length, 1); await f.ack(); assert.equal(f.f.owner.getSnapshot().dialogs.length, 0); f.cleanup();
  });
  test(`${platform}: customer title/subtitle/raw-ref keys, actual toggle and pending spinner retain Source state`, async () => {
    const pending = s.deferred(), customers = [{ ref: ' z ', name: ' ', phone: ' +998 ' }, { ref: 'A', name: ' Alice ', phone: '' }];
    const f = fixture(platform, { deps: { customers: async () => customers, setCustomer: async (detail, customer) => { await pending.promise; return s.detail({ ...detail, customers: [customer] }); } } });
    await f.open('customers'); f.renderContent(); f.activate(); await s.flush(); let tree = f.renderContent();
    assert.ok(text(tree).includes(' z  •  +998 ')); assert.ok(text(tree).includes(' Alice ')); const target = byID(tree, 'admin-item-customer-option- z ');
    (target.props.onCheckedChange ?? target.props.onIsOnChange)(true); tree = f.renderContent();
    assert.equal(platform === 'android' ? byID(tree, 'admin-item-customer-done').props.enabled : !modifier(byID(tree, 'admin-item-customer-done'), 'disabled')[0], false);
    const other = byID(tree, 'admin-item-customer-option-A'); assert.equal(platform === 'android' ? other.props.enabled : !modifier(other, 'disabled')[0], false);
    if (platform === 'android') assert.ok(nodes(tree, node => node.type === 'CircularProgressIndicator' && modifier(node, 'size')?.[0] === 24).length);
    press(byID(tree, 'admin-item-customer-done')); assert.equal(f.closes.length, 0); pending.resolve(); await s.flush(); tree = f.renderContent(); const selected = byID(tree, 'admin-item-customer-option- z '); assert.equal(platform === 'android' ? selected.props.checked : selected.props.isOn, true); f.cleanup();
  });
  test(`${platform}: covered and stale customer callbacks deny search/toggle/Done before native buffer read`, async () => {
    const f = fixture(platform); await f.open('customers'); f.renderContent(); f.activate(); await s.flush(); const tree = f.renderContent(), field = byID(tree, 'admin-item-customer-search'), input = field.props.value ?? field.props.text, row = byID(tree, 'admin-item-customer-option-C');
    f.top(false); press(byID(tree, 'admin-item-customer-search-submit')); (row.props.onCheckedChange ?? row.props.onIsOnChange)(true); press(byID(tree, 'admin-item-customer-done')); assert.equal(input.reads, 0); assert.equal(f.f.calls.filter(value => value[0] === 'customer').length, 0); assert.equal(f.closes.length, 0);
    f.top(true); f.current(false); press(byID(tree, 'admin-item-customer-search-submit')); assert.equal(input.reads, 0); f.cleanup();
  });
  test(`${platform}: original customer rows cannot toggle after replacement search settlement`, async () => {
    let latest = false; const f = fixture(platform, { deps: { customers: async () => [{ ref: latest ? 'new' : 'old', name: 'Customer', phone: '' }] } });
    await f.open('customers'); f.renderContent(); f.activate(); await s.flush(); let tree = f.renderContent(), old = byID(tree, 'admin-item-customer-option-old'); latest = true; press(byID(tree, 'admin-item-customer-search-submit')); await s.flush(); tree = f.renderContent(); assert.ok(byID(tree, 'admin-item-customer-option-new'));
    (old.props.onCheckedChange ?? old.props.onIsOnChange)(true); await s.flush(); assert.equal(f.f.calls.filter(value => value[0] === 'customer').length, 0); assert.equal(f.f.owner.getSnapshot().changed, false); f.cleanup();
  });
  test(`${platform}: unknown own viewport holds customer content and event admission without starting reads`, async () => {
    const f = fixture(platform); await f.open('customers'); let tree = f.renderContent(); const done = byID(tree, 'admin-item-customer-done'); f.props({ viewport: null }); assert.equal(f.renderContent(), null); press(done); assert.equal(f.closes.length, 0); assert.equal(f.f.calls.length, 0);
    f.props({ viewport: { width: 360, height: 900, paddingBottom: 32 } }); tree = f.renderContent(); assert.equal(byID(tree, 'admin-item-customer-content').props.style[1].height, 756); assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.paddingBottom === 48).length); f.cleanup();
  });
}

test('customer content owns no child disposal: barrier cancel during pending write retains accepted parent mutation', async () => {
  const pending = s.deferred(), f = fixture('android', { deps: { setCustomer: async (detail, customer, assigned, guard) => { await pending.promise; guard(); return s.detail({ ...detail, customers: assigned ? [customer] : [] }); } } });
  await f.open('customers'); let m = f.read(); assert.equal(m.owner.getSnapshot().loading, true); assert.equal(f.f.calls.length, 0); f.activate(); await s.flush(); m = f.read(); m.toggle(m.rows[0], true); m = f.read(); assert.equal(m.doneEnabled, false); m.close(true); assert.equal(f.closes.length, 0);
  m.close(false); assert.equal(f.closes.length, 1); assert.equal(m.owner.getSnapshot().closing, true); assert.equal(f.dialog().closing, true); f.cleanup();
  assert.equal(m.owner.getSnapshot().pendingRef, 'c'); // React removal alone never acknowledges native close or disposes child.
  await f.ack(); assert.equal(m.owner.getSnapshot().closing, true); pending.resolve(); await s.flush(); assert.equal(f.f.owner.getSnapshot().detail.customers[0].ref, 'C'); assert.equal(f.f.owner.getSnapshot().changed, true); assert.equal(f.f.owner.getSnapshot().dialogs.length, 0);
});
test('accepted customer close requires real child activation, with no mount-time substitute', async () => {
  const f = fixture(); await f.open('customers'); const m = f.read(); assert.equal(m.doneEnabled, true); m.close(true); assert.equal(f.closes.length, 0); assert.equal(f.f.calls.length, 0); f.activate(); m.close(true); assert.equal(f.closes.length, 1); await f.ack(); f.cleanup();
});
test('customer original account retirement after accepted close suppresses future actual ACK and writes', async () => {
  const f = fixture(); await f.open('customers'); f.read(); f.activate(); await s.flush(); const m = f.read(); m.close(true); assert.equal(f.closes.length, 1); f.current(false); f.f.retire(); assert.equal(f.read().visible, false); const result = await f.ack(); assert.equal(result.changed, false); assert.equal(f.f.calls.filter(value => value[0] === 'customer').length, 0); f.cleanup();
});
test('customer retry is Source top-aligned and native content has no fake modal/onDismiss handler', async () => {
  const f = fixture('android', { deps: { customers: async () => { throw Error('controlled'); } } }); await f.open('customers'); f.renderContent(); f.activate(); await s.flush(); const tree = f.renderContent();
  assert.equal(nodes(tree, node => ['Modal', 'BottomSheet', 'AlertDialog'].includes(node.type)).length, 0);
  assert.equal(modifier(byID(tree, 'admin-item-customer-retry'), 'defaultMinSize')[0].minHeight, 0); assert.equal(modifier(byID(tree, 'admin-item-customer-retry'), 'defaultMinSize')[0].minWidth, 0);
  assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.paddingVertical === 40).length); f.cleanup();
});

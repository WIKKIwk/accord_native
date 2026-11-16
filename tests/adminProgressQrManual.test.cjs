const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminProgressQrManualSupport.cjs');
for (const platform of ['android', 'ios']) {
  for (const locale of ['uz', 'ru', 'en', 'ur']) test(`${platform} ${locale}: manual native content retains Source words, hint, order, autofocus and actual persistent page buffer`, async () => {
    const f = await s.fixture(platform, locale), tree = f.render(), input = s.id(tree, 'input'), model = f.model();
    assert.deepEqual([model.title, model.label, model.cancelLabel, model.verifyLabel], ['worker.scanner.manual.title', 'worker.scanner.manual.payload', 'worker.action.cancel', 'worker.scanner.manual.verify'].map(f.props.p));
    assert.equal(model.hint, '4001...'); assert.equal(input.props.autoFocus, true); assert.equal(input.props.value ?? input.props.text, f.buffer); assert.equal(f.buffer.reads, 0);
    const controls = s.nodes(tree, node => ['Button', 'TextButton'].includes(node.type)); assert.deepEqual(controls.map(node => node.props.modifiers.find(value => ['testID', 'accessibilityIdentifier'].includes(value.name)).args[0]), ['admin-progress-qr-manual-cancel', 'admin-progress-qr-manual-verify']);
    assert.equal(s.nodes(tree, node => ['Modal', 'AlertDialog', 'BottomSheet'].includes(node.type)).length, 0);
    assert.equal(input.props.onValueChange ?? input.props.onTextChange, undefined); assert.deepEqual(s.apiCalls(f), []);
    const verify = controls[1]; assert.ok(verify.props.modifiers.some(value => platform === 'android' ? value.name === 'defaultMinSize' && value.args[0].minHeight === 56 : value.name === 'frame' && value.args[0].minHeight === 56));
    if (platform === 'android') { assert.equal(input.props.singleLine, true); assert.deepEqual(input.props.keyboardOptions, { imeAction: 'done', capitalization: 'none' }); }
    else { assert.equal(input.props.placeholder, '4001...'); assert.ok(input.props.modifiers.some(value => value.name === 'textInputAutocapitalization' && value.args[0] === 'never')); }
  });
  test(`${platform}: Cancel preserves native text and a reopened dialog uses the SAME page buffer, with no JS echo`, async () => {
    const f = await s.fixture(platform), tree = f.render(); f.buffer.set('  http://x/QR?epc=REOPENED  '); s.click(s.id(tree, 'cancel'), platform); await f.ack(); assert.equal(f.buffer.value, '  http://x/QR?epc=REOPENED  '); assert.deepEqual(s.apiCalls(f), []);
    const g = await s.fixture(platform, 'ru', { lookup: f, buffer: f.buffer }), next = g.render(); assert.equal(s.id(next, 'input').props.value ?? s.id(next, 'input').props.text, f.buffer);
    s.click(s.id(next, 'verify'), platform); assert.deepEqual(s.apiCalls(g), []); assert.equal(g.closes[0].rawValue, f.buffer.value); await g.ack(); assert.equal(s.apiCalls(g)[0][1], 'REOPENED'); assert.equal(g.buffer.value, f.buffer.value);
  });
  test(`${platform}: Verify reads latest native text synchronously and duplicate actions wait for genuine original removal`, async () => {
    const f = await s.fixture(platform), tree = f.render(); f.buffer.set(' http://x/QR?epc=FIRST&epc=LAST '); s.click(s.id(tree, 'verify'), platform); s.click(s.id(tree, 'verify'), platform); s.click(s.id(tree, 'cancel'), platform);
    assert.equal(f.closes.length, 1); assert.equal(f.buffer.reads, 1); assert.deepEqual(s.apiCalls(f), []); await f.ack(); assert.equal(s.apiCalls(f).length, 1); assert.equal(s.apiCalls(f)[0][1], 'LAST'); assert.equal(f.controller.isManualCurrent(f.ticket), false);
  });
  test(`${platform}: Done returns Source submitted raw text and does not extract malformed URI until the actual native ACK`, async () => {
    const f = await s.fixture(platform), tree = f.render(), value = 'http://x/earlier%FF/QR?epc=VALID'; f.buffer.set(platform === 'ios' ? value : 'other native buffer');
    s.submit(s.id(tree, 'input'), platform, value); assert.equal(f.closes[0].rawValue, value); assert.deepEqual(s.apiCalls(f), []); await assert.rejects(f.ack(), SyntaxError); assert.equal(f.controller.isManualCurrent(f.ticket), false); assert.deepEqual(s.apiCalls(f), []);
  });
  test(`${platform}: actual surface/top loss, unmount, obsolete manual tickets and async authority cannot dispatch retained controls`, async () => {
    for (const effect of [f => f.surface(() => false), f => f.top(() => false), f => f.top(() => Promise.reject(Error('not synchronous'))), f => f.r.unmount(), f => f.controller.detach(), f => f.controller.completeManualRaw(f.ticket, null)]) {
      const f = await s.fixture(platform), tree = f.render(); effect(f); s.click(s.id(tree, 'verify'), platform); assert.equal(f.buffer.reads, 0); assert.deepEqual(f.closes, []); assert.deepEqual(s.apiCalls(f), []);
    }
    await s.lookup.flush();
  });
  test(`${platform}: accepted original close survives content removal and top loss but cannot move into a replacement surface`, async () => {
    const f = await s.fixture(platform), tree = f.render(); f.model().lifetime.subscribe(() => { f.top(() => false); f.r.unmount(); }); s.click(s.id(tree, 'cancel'), platform); assert.equal(f.closes.length, 1); assert.deepEqual(s.apiCalls(f), []);
    const g = await s.fixture(platform), old = s.id(g.render(), 'cancel'), newer = []; g.model().lifetime.subscribe(() => { g.props.onCloseRequested = value => newer.push(value); g.render(); }); s.click(old, platform); assert.deepEqual(g.closes, []); assert.deepEqual(newer, []);
    const h = await s.fixture(platform), action = s.id(h.render(), 'cancel'); h.model().lifetime.subscribe(() => h.surface(() => false)); s.click(action, platform); assert.deepEqual(h.closes, []);
  });
  test(`${platform}: same-surface input/callback replacement retires old dispatch, while StrictMode replay keeps original input`, async () => {
    const f = await s.fixture(platform), cancel = s.id(f.render(), 'cancel'); f.r.replay(); s.click(cancel, platform); assert.equal(f.closes.length, 1);
    for (const key of ['buffer', 'onCloseRequested', 'ticket']) {
      const g = await s.fixture(platform), old = s.id(g.render(), 'verify'); g.props[key] = key === 'buffer' ? s.Buffer() : key === 'onCloseRequested' ? () => {} : { generation: g.ticket.generation };
      assert.equal(g.render(), null); s.click(old, platform); assert.equal(g.buffer.reads, 0); assert.deepEqual(g.closes, []);
    }
  });
  test(`${platform}: actual native getter retirement/released buffer and original hide failure do not authorize lookup`, async () => {
    const f = await s.fixture(platform), tree = f.render(); f.buffer.get = () => { f.surface(() => false); return 'raw'; }; s.click(s.id(tree, 'verify'), platform); assert.deepEqual(f.closes, []);
    const g = await s.fixture(platform), next = g.render(); g.buffer.released = true; s.click(s.id(next, 'verify'), platform); assert.deepEqual(g.closes, []);
    for (const asyncFailure of [false, true]) { const h = await s.fixture(platform); h.props.onCloseRequested = () => { if (asyncFailure) return Promise.reject(Error('hide failed')); throw Error('hide failed'); }; s.click(s.id(h.render(), 'cancel'), platform); await s.lookup.flush(); assert.deepEqual(s.apiCalls(h), []); assert.equal(h.model().lifetime.getSnapshot(), true); }
  });
  test(`${platform}: final original-current unmount blocks a new event, and an asynchronous getter cannot stand in for native text`, async () => {
    const f = await s.fixture(platform); let armed = false, checks = 0;
    f.props.isCurrent = () => { if (armed && ++checks === 2) f.r.unmount(); return true; };
    const tree = f.render(); armed = true; s.click(s.id(tree, 'verify'), platform); assert.equal(f.buffer.reads, 0); assert.deepEqual(f.closes, []); assert.equal(f.model().lifetime.getSnapshot(), false);
    const g = await s.fixture(platform), next = g.render(); g.buffer.get = () => Promise.resolve('not an actual synchronous native buffer'); s.click(s.id(next, 'verify'), platform); assert.deepEqual(g.closes, []);
  });
  test(`${platform}: empty Verify stays enabled, closes with empty raw text and shows Source invalidQr only after actual ACK`, async () => {
    const f = await s.fixture(platform), tree = f.render(); s.click(s.id(tree, 'verify'), platform); assert.equal(f.closes[0].rawValue, ''); assert.equal(f.state().status, 'prompt'); await f.ack(); assert.equal(f.state().status, 'invalidQr'); assert.deepEqual(s.apiCalls(f), []);
  });
}
test('manual content requires real host, synchronous persistent buffer and Source production resolver', async () => {
  for (const key of ['surfaceIdentity', 'buffer', 'isCurrent', 'canInteract', 'onCloseRequested', 'p']) { const f = await s.fixture(); f.props[key] = undefined; assert.throws(f.render, /required/); }
  const f = await s.fixture(); f.props.ticket = { generation: f.ticket.generation }; assert.equal(f.render(), null);
});

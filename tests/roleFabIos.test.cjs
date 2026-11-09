const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function compile(relative, mocks = {}, extension = '.ts') {
  const filename = path.resolve(__dirname, `../src/${relative}${extension}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const guard = compile('shared/camera/synchronousGuard');
const model = compile('shared/navigation/roleFabMenu', { '../camera/synchronousGuard': guard });
const actions = () => [{ id: 'receipt', label: 'Kirim', icon: 'scalemass', width: 150 },
  { id: 'scan', label: 'QR skanerlash', icon: 'qrcode.viewfinder', width: 215 },
  { id: 'assignment', label: 'Homashyo biriktirish', icon: 'shippingbox', width: 260, disabled: true }];
function nodes(node, kind) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, kind));
  return [...(node.type === kind ? [node] : []), ...nodes(node.props?.children, kind)];
}
function harness() {
  const hooks = []; let cursor = 0, effects = [], dirty = false, lastProps;
  const equal = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
  const react = {
    useMemo(fn, deps) { const i = cursor++, prior = hooks[i]; if (!prior || !equal(prior.deps, deps)) hooks[i] = { deps, value: fn() }; return hooks[i].value; },
    useSyncExternalStore(subscribe, getSnapshot) { const i = cursor++, prior = hooks[i];
      if (!prior || prior.subscribe !== subscribe) { if (prior?.cleanup) prior.cleanup();
        hooks[i] = { subscribe, cleanup: subscribe(() => { dirty = true; }) }; }
      return getSnapshot(); },
    useLayoutEffect(fn, deps) { const i = cursor++, prior = hooks[i]; if (!prior || !equal(prior.deps, deps)) effects.push(() => {
      if (prior?.cleanup) prior.cleanup(); hooks[i] = { deps, effect: fn, cleanup: fn() };
    }); },
  };
  const module = compile('shared/navigation/RoleFab.ios', { react, 'react/jsx-runtime': jsx,
    '@expo/ui/community/menu': { MenuView: 'MenuView' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', PlatformColor: color => color, StyleSheet: { absoluteFill: {}, create: value => value } },
    '../camera/synchronousGuard': guard, './roleFabMenu': model }, '.tsx');
  const render = props => {
    lastProps = props; let tree, loops = 0;
    do { dirty = false; cursor = 0; effects = []; tree = module.RoleFab(props); effects.forEach(fn => fn());
      if (++loops > 10) throw Error('unexpected render loop'); } while (dirty);
    return tree;
  };
  return { render, flush() { return render(lastProps); },
    replayEffects() { for (const hook of hooks) if (hook?.effect) { if (hook.cleanup) hook.cleanup(); hook.cleanup = hook.effect(); } return render(lastProps); },
    unmount() { for (const hook of hooks) if (hook?.cleanup) hook.cleanup(); } };
}
const base = (overrides = {}) => ({ actions: actions(), onSelect() {}, isCurrent: () => true, resetKey: 'epoch-1', ...overrides });
const menuOf = tree => nodes(tree, 'MenuView')[0];
const fire = (menu, id) => menu.props.onPressAction({ nativeEvent: { event: id } });

test('presentations preserve public order, labels, SF icons and per-action disabled status', () => {
  const presentation = model.createRoleFabPresentation(actions());
  assert.deepEqual(presentation.menuActions.map(item => item.title), ['Kirim', 'QR skanerlash', 'Homashyo biriktirish']);
  assert.deepEqual(presentation.menuActions.map(item => item.image), ['scalemass', 'qrcode.viewfinder', 'shippingbox']);
  assert.deepEqual(presentation.menuActions.map(item => !!item.attributes?.disabled), [false, false, true]);
  const calls = [], gate = model.createRoleFabGate(presentation, () => true, id => calls.push(id));
  for (const item of presentation.menuActions) gate.select(presentation.key, item.id);
  assert.deepEqual(calls, ['receipt']);
  const next = model.createRoleFabPresentation(actions()), nextGate = model.createRoleFabGate(next, () => true, id => calls.push(id));
  nextGate.select(next.key, next.menuActions[1].id); assert.deepEqual(calls, ['receipt', 'scan']);
  assert.equal(Object.isFrozen(presentation.menuActions), true); assert.equal(Object.isFrozen(presentation.menuActions[0]), true);
});

test('empty, duplicate, invalid, or missing actions produce no menu', () => {
  for (const list of [[], [{ ...actions()[0], id: '' }], [actions()[0], actions()[0]], [{ ...actions()[0], width: 0 }],
    [{ ...actions()[0], disabled: 'yes' }], [{ ...actions()[0], label: ' ' }]]) {
    assert.equal(model.createRoleFabPresentation(list), null);
    const h = harness(); assert.equal(h.render(base({ actions: list })), null);
  }
  const h = harness(); assert.equal(h.render(base({ resetKey: '' })), null);
  assert.equal(h.render(base({ isCurrent: undefined })), null);
});

test('native menu reuses the existing Worker trigger pattern and returns original action IDs', () => {
  const h = harness(), calls = [], tree = h.render(base({ onSelect: id => calls.push(id), testIDPrefix: 'material-fab', openLabel: 'Amallar' }));
  const menu = menuOf(tree), trigger = nodes(tree, 'View').find(item => item.props.accessibilityRole === 'button');
  assert.ok(menu); assert.equal(menu.props.testID, 'material-fab'); assert.equal(trigger.props.accessibilityLabel, 'Amallar');
  const symbol = nodes(tree, 'SymbolView')[0]; assert.equal(symbol.props.name, 'plus.circle.fill');
  fire(menu, menu.props.actions[1].id); fire(menu, menu.props.actions[2].id); fire(menu, 'unknown');
  assert.deepEqual(calls, ['scan']); h.unmount();
});

test('reset, changed action or callback, and unmount reject stale native events even for the same public ID', () => {
  const h = harness(), calls = [], fn = id => calls.push(`old:${id}`), current = () => true, first = base({ onSelect: fn, isCurrent: current });
  const oldMenu = menuOf(h.render(first)), oldId = oldMenu.props.actions[0].id;
  const resetMenu = menuOf(h.render({ ...first, resetKey: 'epoch-2' })), resetId = resetMenu.props.actions[0].id;
  assert.notEqual(oldId, resetId); fire(oldMenu, oldId); fire(resetMenu, oldId); assert.deepEqual(calls, []);
  fire(resetMenu, resetId); assert.deepEqual(calls, ['old:receipt']);
  const changed = actions(); changed[0].label = 'Kirim 2';
  const changedMenu = menuOf(h.render({ ...first, actions: changed, resetKey: 'epoch-2', onSelect: id => calls.push(`new:${id}`) }));
  fire(resetMenu, resetId); fire(changedMenu, resetId); fire(changedMenu, changedMenu.props.actions[0].id);
  assert.deepEqual(calls, ['old:receipt', 'new:receipt']);
  h.unmount(); fire(changedMenu, changedMenu.props.actions[0].id); assert.deepEqual(calls, ['old:receipt', 'new:receipt']);
});

test('effect cleanup and re-setup create a fresh native event namespace', () => {
  const h = harness(), calls = [], props = base({ onSelect: id => calls.push(id) });
  const first = menuOf(h.render(props)), oldId = first.props.actions[0].id;
  const second = menuOf(h.replayEffects()), newId = second.props.actions[0].id;
  assert.notEqual(oldId, newId); fire(first, oldId); fire(second, oldId); assert.deepEqual(calls, []);
  fire(second, newId); assert.deepEqual(calls, ['receipt']); h.unmount();
});

test('observed focus/session loss permanently invalidates the old presentation', () => {
  const h = harness(), calls = [], list = actions(); let current = true;
  const props = base({ actions: list, isCurrent: () => current, onSelect: id => calls.push(id) });
  const menu = menuOf(h.render(props)), id = menu.props.actions[0].id;
  current = false; fire(menu, id); current = true; fire(menu, id); assert.deepEqual(calls, []); assert.equal(h.flush(), null);
  const next = menuOf(h.render({ ...props, resetKey: 'epoch-2' })); assert.notEqual(next.props.actions[0].id, id);
  fire(next, id); fire(next, next.props.actions[0].id); assert.deepEqual(calls, ['receipt']); h.unmount();
});

test('observed in-place action change cannot revive an old menu after restoration', () => {
  const h = harness(), calls = [], list = actions(), props = base({ actions: list, onSelect: id => calls.push(id) });
  const menu = menuOf(h.render(props)), id = menu.props.actions[0].id;
  list[0].disabled = true; fire(menu, id); list[0].disabled = false; fire(menu, id);
  assert.deepEqual(calls, []); assert.equal(h.flush(), null);
  const next = menuOf(h.render({ ...props, resetKey: 'epoch-2' })); fire(next, next.props.actions[0].id);
  assert.deepEqual(calls, ['receipt']); h.unmount();
});

test('reentrant guard invalidation or action mutation prevents its own selection', () => {
  const h = harness(), calls = [], list = actions(); let armed = false;
  const props = base({ actions: list, onSelect: id => calls.push(id), isCurrent: () => { if (armed) h.unmount(); return true; } });
  const menu = menuOf(h.render(props)); armed = true; fire(menu, menu.props.actions[0].id); assert.deepEqual(calls, []);
  const second = harness(), list2 = actions(); let mutate = false;
  const menu2 = menuOf(second.render(base({ actions: list2, onSelect: id => calls.push(id), isCurrent: () => {
    if (mutate) list2[0].label = 'changed'; return true;
  } })));
  mutate = true; fire(menu2, menu2.props.actions[0].id); assert.deepEqual(calls, []); second.unmount();
});

test('async, rejected, false or throwing focus guards never select and rejection is observed', async () => {
  for (const isCurrent of [() => false, () => 1, () => Promise.resolve(true), () => Promise.reject(Error('async guard')), () => { throw Error('guard'); }]) {
    const h = harness(), calls = [], tree = h.render(base({ isCurrent, onSelect: id => calls.push(id) }));
    assert.equal(tree, null); assert.deepEqual(calls, []); h.unmount();
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('reentry from guard or selected callback cannot dispatch the same event twice', () => {
  const presentation = model.createRoleFabPresentation(actions()), eventId = presentation.menuActions[0].id;
  let gate, guardReentered = false, callbackReentered = false; const calls = [];
  gate = model.createRoleFabGate(presentation, () => {
    if (!guardReentered) { guardReentered = true; gate.select(presentation.key, eventId); }
    return true;
  }, id => {
    calls.push(id);
    if (!callbackReentered) { callbackReentered = true; gate.select(presentation.key, eventId); }
  });
  gate.select(presentation.key, eventId); assert.deepEqual(calls, ['receipt']);
  gate.select(presentation.key, eventId); assert.deepEqual(calls, ['receipt']);
});

test('malformed native events and stale or disabled event IDs never dispatch', () => {
  const h = harness(), calls = [], menu = menuOf(h.render(base({ onSelect: id => calls.push(id) })));
  for (const event of [undefined, {}, { nativeEvent: {} }, { nativeEvent: { event: null } }]) menu.props.onPressAction(event);
  fire(menu, menu.props.actions[2].id); fire(menu, 'unrecognized'); assert.deepEqual(calls, []);
  fire(menu, menu.props.actions[0].id); assert.deepEqual(calls, ['receipt']); h.unmount();
});

test('duplicate native delivery invokes once and a later menu receives a new event namespace', () => {
  const h = harness(), calls = [], menu = menuOf(h.render(base({ onSelect: id => { calls.push(id); } })));
  const oldId = menu.props.actions[0].id; fire(menu, oldId); fire(menu, oldId); assert.deepEqual(calls, ['receipt']);
  const next = menuOf(h.flush()), newId = next.props.actions[0].id; assert.notEqual(newId, oldId);
  fire(next, oldId); assert.deepEqual(calls, ['receipt']); fire(next, newId); assert.deepEqual(calls, ['receipt', 'receipt']); h.unmount();
});

test('async selection hides the consumed menu until settlement and never repeats the old event', async () => {
  let resolve; const wait = new Promise(r => { resolve = r; }), calls = [], h = harness();
  const menu = menuOf(h.render(base({ onSelect: async id => { calls.push(id); await wait; } })));
  const oldId = menu.props.actions[0].id; fire(menu, oldId); fire(menu, oldId); assert.deepEqual(calls, ['receipt']);
  assert.equal(h.flush(), null); resolve(); await new Promise(r => setImmediate(r));
  const next = menuOf(h.flush()); assert.ok(next); const newId = next.props.actions[0].id; assert.notEqual(oldId, newId);
  fire(next, oldId); assert.deepEqual(calls, ['receipt']); fire(next, newId); assert.deepEqual(calls, ['receipt', 'receipt']);
  await new Promise(r => setImmediate(r)); h.unmount();
});

test('async rejection reports once and remains blocked until an explicit reset', async () => {
  const h = harness(), calls = [], errors = [], props = base({ onSelect: async id => { calls.push(id); throw Error('failed'); },
    onSelectionError: error => errors.push(error.message) });
  const menu = menuOf(h.render(props)), oldId = menu.props.actions[0].id; fire(menu, oldId); fire(menu, oldId);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.flush(), null);
  assert.deepEqual(calls, ['receipt']); assert.deepEqual(errors, ['failed']);
  const reset = menuOf(h.render({ ...props, resetKey: 'epoch-2' })); assert.ok(reset);
  fire(reset, oldId); assert.deepEqual(calls, ['receipt']); h.unmount();
});

test('an old async completion or failure cannot rearm or report after reset or unmount', async () => {
  let resolve; const p = new Promise(a => { resolve = a; });
  const h = harness(), calls = [], errors = [], props = base({ onSelect: id => { calls.push(id); return p; },
    onSelectionError: error => errors.push(error.message) });
  const old = menuOf(h.render(props)), oldId = old.props.actions[0].id; fire(old, oldId); assert.equal(h.flush(), null);
  const next = menuOf(h.render({ ...props, resetKey: 'epoch-2' })), newId = next.props.actions[0].id;
  resolve(); await new Promise(r => setImmediate(r)); fire(next, oldId); assert.deepEqual(calls, ['receipt']);
  fire(next, newId); assert.deepEqual(calls, ['receipt', 'receipt']); h.unmount();
  // Separate rejection after unmount must be consumed and must not notify an old owner.
  let rejectOld; const waiting = new Promise((_a, b) => { rejectOld = b; });
  const h2 = harness(), old2 = menuOf(h2.render(base({ onSelect: () => waiting, onSelectionError: error => errors.push(error.message) })));
  fire(old2, old2.props.actions[0].id); h2.unmount(); rejectOld(Error('stale')); await new Promise(r => setImmediate(r));
  assert.deepEqual(errors, []);
});

test('invalidation reentered by a store subscriber prevents the selected callback', () => {
  const list = actions(), calls = [];
  // Avoid recursively invalidating on the invalidation's own publication.
  let armed = false; const second = model.createRoleFabStore(list, 'epoch-1', () => true, id => calls.push(id), model.roleFabFingerprint(list));
  second.subscribe(() => { if (armed && !second.getSnapshot()) { armed = false; second.invalidate(); } });
  second.activate(); const entry = second.getSnapshot(); armed = true;
  entry.gate.select(entry.presentation.key, entry.presentation.menuActions[0].id); assert.deepEqual(calls, []); assert.equal(second.getSnapshot(), null);
});

test('scope lost during a pending selection neither reopens a menu nor reports to the old owner', async () => {
  for (const outcome of ['resolve', 'reject']) {
    let finish, valid = true; const promise = new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; });
    const h = harness(), errors = [], menu = menuOf(h.render(base({ isCurrent: () => valid, onSelect: () => promise,
      onSelectionError: error => errors.push(error.message) })));
    fire(menu, menu.props.actions[0].id); assert.equal(h.flush(), null); valid = false;
    finish(outcome === 'reject' ? Error('old scope') : undefined); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.flush(), null); assert.deepEqual(errors, []); h.unmount();
  }
});

test('scope changed reentrantly during pending publication prevents the selected callback', () => {
  const list = actions(), calls = []; let valid = true, armed = false;
  const store = model.createRoleFabStore(list, 'epoch-1', () => valid, id => calls.push(id), model.roleFabFingerprint(list));
  store.subscribe(() => { if (armed && !store.getSnapshot()) valid = false; });
  store.activate(); const entry = store.getSnapshot(); armed = true;
  entry.gate.select(entry.presentation.key, entry.presentation.menuActions[0].id);
  assert.deepEqual(calls, []); assert.equal(store.getSnapshot(), null);
});

test('reentrant activation during the lifetime guard fails closed without recursion', () => {
  const list = actions(), calls = []; let store, attempted = false;
  store = model.createRoleFabStore(list, 'epoch-1', () => { if (!attempted) { attempted = true; store.activate(); } return true; },
    id => calls.push(id), model.roleFabFingerprint(list));
  store.activate(); assert.equal(attempted, true); assert.equal(store.getSnapshot(), null); assert.deepEqual(calls, []);
});

test('reentrant invalidation from a subscriber does not recurse', () => {
  const list = actions(), calls = [], store = model.createRoleFabStore(list, 'epoch-1', () => true,
    id => calls.push(id), model.roleFabFingerprint(list));
  store.subscribe(() => { if (!store.getSnapshot()) store.invalidate(); });
  store.activate(); const entry = store.getSnapshot();
  entry.gate.select(entry.presentation.key, entry.presentation.menuActions[0].id);
  assert.equal(store.getSnapshot(), null); assert.deepEqual(calls, []);
});

test('invalid guard is terminal but disabled and unknown IDs do not consume the gate', () => {
  const p = model.createRoleFabPresentation(actions()), calls = []; let current = true, invalid = 0, checks = 0;
  const gate = model.createRoleFabGate(p, () => { checks++; return current; }, id => calls.push(id), () => { invalid++; });
  gate.select(p.key, 'unknown'); gate.select(p.key, p.menuActions[2].id); assert.equal(checks, 0); assert.equal(invalid, 0);
  current = false; gate.select(p.key, p.menuActions[0].id); assert.equal(invalid, 1);
  current = true; gate.select(p.key, p.menuActions[0].id); assert.deepEqual(calls, []); assert.equal(invalid, 1);
});

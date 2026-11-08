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
  return { render,
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
  assert.deepEqual(calls, ['receipt', 'scan']);
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

test('focus/session guard and in-place action mutation are checked before each selection', () => {
  const h = harness(), calls = [], list = actions(); let current = true;
  const menu = menuOf(h.render(base({ actions: list, isCurrent: () => current, onSelect: id => calls.push(id) })));
  const id = menu.props.actions[0].id; current = false; fire(menu, id); assert.deepEqual(calls, []);
  current = true; list[0].disabled = true; fire(menu, id); assert.deepEqual(calls, []);
  list[0].disabled = false; fire(menu, id); assert.deepEqual(calls, ['receipt']); h.unmount();
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
    const h = harness(), calls = [], menu = menuOf(h.render(base({ isCurrent, onSelect: id => calls.push(id) })));
    fire(menu, menu.props.actions[0].id); assert.deepEqual(calls, []); h.unmount();
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
  gate.select(presentation.key, eventId); assert.deepEqual(calls, ['receipt', 'receipt']);
});

test('malformed native events and stale or disabled event IDs never dispatch', () => {
  const h = harness(), calls = [], menu = menuOf(h.render(base({ onSelect: id => calls.push(id) })));
  for (const event of [undefined, {}, { nativeEvent: {} }, { nativeEvent: { event: null } }]) menu.props.onPressAction(event);
  fire(menu, menu.props.actions[2].id); fire(menu, 'unrecognized'); assert.deepEqual(calls, []); h.unmount();
});

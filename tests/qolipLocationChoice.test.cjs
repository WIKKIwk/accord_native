const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', file), m = new Module(filename, module); m.require = id => id in mocks ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return m.exports;
}
const common = load('qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const labels = load('qolipLocationChoiceLabels.ts', { './qolipApiCommon': common });
const Lifetime = load('qolipLocationChoiceLifetime.ts', { './qolipApiCommon': common }).QolipLocationChoiceLifetime;
const row = patch => ({ id: 'same', item_name: ' Product ', qolip_code: ' Q ', size: 0, quantity: 2, location_label: ' A1 ', ...patch });
const tick = () => new Promise(resolve => setImmediate(resolve));
test('location choice labels preserve original whitespace/value order and include zero or negative size', () => {
  assert.deepEqual(labels.qolipLocationChoiceLabel(row(), '2 ta'), { title: ' Product ', subtitle: ' Q  • 0 • 2 ta •  A1 ' });
  assert.deepEqual(labels.qolipLocationChoiceLabel(row({ size: -3, quantity: -1 }), '-1 ta'), { title: ' Product ', subtitle: ' Q  • -3 • -1 ta •  A1 ' });
});
test('only trimmed-blank item names fall back to the raw mold code; blank code/location are omitted from subtitle', () => {
  assert.deepEqual(labels.qolipLocationChoiceLabel(row({ item_name: ' \u0085', qolip_code: ' Q ' }), '2 ta'), { title: ' Q ', subtitle: ' Q  • 0 • 2 ta •  A1 ' });
  assert.deepEqual(labels.qolipLocationChoiceLabel(row({ item_name: 'Name', qolip_code: '\u0085 ', location_label: ' \u0085' }), '2 ta'), { title: 'Name', subtitle: '0 • 2 ta' });
});
function boundaryHarness() {
  let current = true; const listeners = new Set(), boundary = { current: () => current, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  const state = new Lifetime(boundary);
  return { state, listeners, invalidate: () => { current = false; [...listeners].forEach(fn => fn()); }, revive: () => { current = true; } };
}
test('read-only lifetime subscribes only after activation and rejects selections after cleanup', () => {
  const h = boundaryHarness(); assert.equal(h.state.getSnapshot(), true); assert.equal(h.state.canChoose(), false); assert.equal(h.listeners.size, 0);
  h.state.activate(); h.state.activate(); assert.equal(h.listeners.size, 1); assert.equal(h.state.canChoose(), true); h.state.suspend(); assert.equal(h.state.canChoose(), false); assert.equal(h.listeners.size, 0);
});
test('original invalidation hides old options and never revives across predicate ABA', () => {
  const h = boundaryHarness(); let changes = 0; h.state.subscribe(() => changes++); h.state.activate(); h.invalidate();
  assert.equal(h.state.getSnapshot(), false); assert.equal(h.state.canChoose(), false); assert.equal(changes, 1); h.revive(); h.state.activate(); assert.equal(h.state.getSnapshot(), false); assert.equal(h.listeners.size, 0);
});
test('false, throwing, async and reentrant boundaries cannot activate the read-only picker', async () => {
  for (const current of [() => false, () => { throw new Error('guard'); }, async () => true, async () => { throw new Error('guard'); }]) {
    let subscriptions = 0; const state = new Lifetime({ current, subscribe: () => { subscriptions++; return () => {}; } });
    state.activate(); assert.equal(state.getSnapshot(), false); assert.equal(state.canChoose(), false); assert.equal(subscriptions, 0);
  }
  let reentered; const state = new Lifetime({ current: () => { reentered = state.getSnapshot(); return true; }, subscribe: () => () => {} });
  state.activate(); assert.equal(reentered, false); assert.equal(state.canChoose(), false); await tick();
});
test('invalidation during subscription installation and an async subscription fail closed and clean up', async () => {
  let valid = true, stopped = 0; const first = new Lifetime({ current: () => valid, subscribe: fn => { valid = false; fn(); return () => stopped++; } });
  first.activate(); assert.equal(first.canChoose(), false); assert.equal(stopped, 1);
  const second = new Lifetime({ current: () => true, subscribe: async () => () => stopped++ }); second.activate(); await tick(); assert.equal(second.canChoose(), false); assert.equal(stopped, 2);
});
test('cleanup/recreation may reuse the same valid original boundary but never captures a new account witness', () => {
  const h = boundaryHarness(); h.state.activate(); h.state.suspend(); h.state.activate(); assert.equal(h.listeners.size, 1); assert.equal(h.state.canChoose(), true); h.state.suspend();
});
test('one failing observer or cleanup cannot suppress other invalidation observers', () => {
  let valid = true, signal, observed = 0;
  const state = new Lifetime({ current: () => valid, subscribe: listener => { signal = listener; return () => { throw new Error('cleanup'); }; } });
  state.subscribe(() => { throw new Error('observer'); }); state.subscribe(() => observed++); state.activate(); valid = false; signal();
  assert.equal(state.getSnapshot(), false); assert.equal(state.canChoose(), false); assert.equal(observed, 1); state.suspend();
});
test('rejected async observers and cleanup results are consumed while the lifetime closes', async () => {
  let valid = true, signal;
  const state = new Lifetime({ current: () => valid, subscribe: listener => { signal = listener; return async () => { throw new Error('cleanup'); }; } });
  state.subscribe(async () => { throw new Error('observer'); }); state.activate(); valid = false; signal(); await tick(); assert.equal(state.canChoose(), false);
  const asyncSubscription = new Lifetime({ current: () => true, subscribe: async () => async () => { throw new Error('delayed cleanup'); } });
  asyncSubscription.activate(); await tick(); assert.equal(asyncSubscription.canChoose(), false);
});
test('a reentrant boundary signal cannot return true after the lifetime has expired', () => {
  let valid = true, signal, trigger = false;
  const state = new Lifetime({ current: () => { if (trigger) { trigger = false; valid = false; signal(); return true; } return valid; },
    subscribe: listener => { signal = listener; return () => {}; } });
  state.activate(); trigger = true; assert.equal(state.getSnapshot(), false); assert.equal(state.canChoose(), false);
});

for (const platform of ['ios', 'android']) {
  function native(options) {
    const captured = {}, calls = []; let valid = true;
    const node = name => props => { (captured[name] ??= []).push(props); return React.createElement('div', null, props.children); };
    const nodes = Object.fromEntries(['Button', 'Column', 'Host', 'HStack', 'Image', 'LazyColumn', 'List', 'ListItem', 'RNHostView', 'SymbolView', 'Text', 'View', 'VStack'].map(name => [name, node(name)]));
    for (const slot of ['LeadingContent', 'HeadlineContent', 'SupportingContent']) nodes.ListItem[slot] = node(slot);
    const mods = Object.fromEntries(['buttonStyle', 'font', 'listStyle', 'clickable', 'fillMaxSize', 'fillMaxWidth'].map(name => [name, (...args) => ({ name, args })]));
    const Component = load(`QolipLocationChoice.${platform}.tsx`, { '@expo/ui/swift-ui': nodes, '@expo/ui/jetpack-compose': { ...nodes, useMaterialColors: () => ({ onSurfaceVariant: 'theme' }) },
      '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods, 'react-native': nodes, 'expo-symbols': nodes,
      '../shared/localization': { localizedMethod: (key, locale, values) => { assert.equal(key, 'qolipCount'); assert.equal(locale, 'uz'); return `${values.count} ta`; } },
      './qolipLocationChoiceLabels': labels, './useQolipText': { useQolipText: () => ({ locale: 'uz' }) },
      './useQolipLocationChoice': { useQolipLocationChoice: props => ({ valid, choose: item => calls.push(item) }) } }).QolipLocationChoice;
    const props = { title: 'Source localized title', options, boundary: {}, choose() { throw new Error('view bypassed its guarded hook'); } };
    const render = () => { for (const key in captured) delete captured[key]; return renderToStaticMarkup(React.createElement(Component, props)); };
    return { captured, calls, render, invalidate: () => { valid = false; } };
  }
  test(`${platform} read-only choice renders exact source rows in original order, retains duplicate IDs, and selects original objects`, () => {
    const options = [row({ item_name: 'First' }), row({ item_name: '', qolip_code: 'Second', location_label: '' })], h = native(options), html = h.render();
    assert.ok(html.indexOf('First') < html.indexOf('Second')); assert.ok(html.includes(' Q  • 0 • 2 ta •  A1 ')); assert.deepEqual(h.calls, []);
    const rows = h.captured[platform === 'ios' ? 'Button' : 'ListItem']; assert.equal(rows.length, 2);
    rows.forEach(props => platform === 'ios' ? props.onPress() : props.modifiers.find(mod => mod.name === 'clickable').args[0]());
    assert.equal(h.calls[0], options[0]); assert.equal(h.calls[1], options[1]); assert.ok(h.captured[platform === 'ios' ? 'Image' : 'SymbolView']);
  });
  test(`${platform} an empty options list shows only the supplied title without search, retry, close or invented empty UI`, () => {
    const h = native([]), html = h.render(); assert.ok(html.includes('Source localized title')); assert.equal(h.captured.Button, undefined); assert.equal(h.captured.ListItem, undefined); assert.deepEqual(h.calls, []);
    assert.equal(h.captured.Text.length, 1);
  });
  test(`${platform} an invalid original boundary removes the complete old title and option list`, () => {
    const h = native([row()]); h.invalidate(); assert.equal(h.render(), ''); assert.equal(h.captured.Host, undefined); assert.deepEqual(h.calls, []);
  });
}

test('choice hook uses the actual original boundary, activates after commit and rechecks before returning the original row', () => {
  const effects = [], picked = [], props = { boundary: {}, choose: item => picked.push(item) }; let state, allowed = true;
  class FakeLifetime { constructor(boundary) { assert.equal(boundary, props.boundary); state = this; } subscribe() {} getSnapshot() { return true; }
    activate() { this.active = true; } suspend() { this.active = false; } canChoose() { return this.active && allowed; } }
  const hook = load('useQolipLocationChoice.ts', { react: { useMemo: fn => fn(), useLayoutEffect: fn => effects.push(fn), useSyncExternalStore: (_s, get) => get() },
    './qolipLocationChoiceLifetime': { QolipLocationChoiceLifetime: FakeLifetime } }).useQolipLocationChoice;
  const view = hook(props), item = row(); assert.equal(view.valid, true); view.choose(item); assert.equal(picked.length, 0); const cleanup = effects[0]();
  view.choose(item); assert.equal(picked[0], item); allowed = false; view.choose(item); assert.equal(picked.length, 1); allowed = true; cleanup(); assert.equal(state.active, false); view.choose(item); assert.equal(picked.length, 1);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.endsWith('.xml')) return id;
    throw new Error(`Unexpected import: ${id}`);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return mod.exports;
}
const model = load('workerMaterialPresentation.ts');
const identity = value => value;
const row = { item_name: 'OPP 375/12', item_code: 'OPP 375/12 • Rulon', item_group: 'OPP', barcode: '30E2978F21DC3D708CAB3093',
  order_id: '0337', reserved_order_id: '0337', stock_status: 'in_use', execution_status: 'in_use', stock_uom: 'kg', received_qty: 105.885, consumed_qty: 0 };

// V2 _materialAssignmentConfirmed
for (const status of ['in_use', 'consumed', ' IN_USE ']) test(`reopening an order restores the accepted marker from server stock ${status}`, () => {
  assert.equal(model.assignedMaterialPresentation({ ...row, stock_status: status }, [], identity, '0337').confirmed, true);
});
for (const override of [
  { reserved_order_id: 'other' }, { reserved_order_id: '' }, { stock_status: 'ready' }, { stock_status: 'awaiting_delivery' },
  { stock_status: 'reserved' }, { stock_status: undefined }, { barcode: '' },
]) test(`does not infer receipt from quantities or execution status: ${JSON.stringify(override)}`, () => {
  assert.equal(model.assignedMaterialPresentation({ ...row, ...override }, [], identity, '0337').confirmed, false);
});
test('local scans use normalized, non-empty exact barcode matches; pending rows have no server receipt scope', () => {
  assert.equal(model.assignedMaterialPresentation({ ...row, stock_status: 'ready', reserved_order_id: '' }, [` ${row.barcode.toLowerCase()} `], identity).confirmed, true);
  assert.equal(model.assignedMaterialPresentation(row, [row.barcode.slice(0, -1)], identity, 'other').confirmed, false);
  assert.equal(model.assignedMaterialPresentation({ barcode: '' }, [' '], identity, '0337').confirmed, false);
  assert.equal(model.assignedMaterialPresentation(row, [], identity).confirmed, false);
});
test('compact text preserves V2 code deduplication, all details and localized status without blank separators', () => {
  const item = model.assignedMaterialPresentation(row, [], value => `translated:${value}`, '0337');
  assert.equal(item.title, row.item_name);
  assert.equal(item.subtitle, `Rulon • OPP • ${row.barcode} • translated:Ishlatilmoqda`);
  const fallback = model.assignedMaterialPresentation({ item_code: '', item_group: 'PET', barcode: 'R1' }, [], identity);
  assert.equal(fallback.title, 'PET'); assert.equal(fallback.subtitle, 'R1');
  const single = model.assignedMaterialPresentation({ item_name: 'PET', item_code: 'pet', item_group: '' }, [], identity);
  assert.equal(single.subtitle, '');
});

// V2 _ScannedItemsExpansionHeader
test('empty lists cannot expand even if they were open before the last row disappeared', () => {
  for (const expanded of [false, true]) assert.deepEqual(model.materialSectionExpansion({ loading: false, error: ' ', count: 0, expanded }),
    { hasContent: false, canToggle: false, expanded: false });
});
test('loading keeps the pending title/count without offering a disclosure action', () => {
  for (const count of [0, 1]) assert.deepEqual(model.materialSectionExpansion({ loading: true, error: '', count, expanded: false }),
    { hasContent: true, canToggle: false, expanded: false });
});
test('non-empty lists and errors remain expandable', () => {
  for (const change of [{ count: 1 }, { error: 'Network error' }]) assert.deepEqual(
    model.materialSectionExpansion({ loading: false, error: '', count: 0, expanded: true, ...change }),
    { hasContent: true, canToggle: true, expanded: true });
});

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const modifiers = new Proxy({}, { get: (_target, name) => name === 'shapes'
  ? new Proxy({}, { get: (_shapeTarget, shape) => (...args) => ({ shape, args }) })
  : (...args) => ({ kind: name, args }) });
const colors = Object.fromEntries(['onSurface', 'onSurfaceVariant', 'surface', 'surfaceContainerHigh', 'surfaceContainerHighest', 'primaryContainer',
  'onPrimaryContainer', 'secondaryContainer', 'onSecondaryContainer'].map(name => [name, name]));
function nativeComponent(name, platform, palette = colors, systemPalette = palette) {
  return load(`components/${name}.${platform}.tsx`, {
    'react/jsx-runtime': jsx, '@expo/ui/swift-ui': new Proxy({}, { get: (_target, key) => key }),
    '@expo/ui/jetpack-compose': new Proxy({ useMaterialColors: options => { assert.deepEqual(options, {}); return systemPalette; } },
      { get: (target, key) => target[key] ?? key }),
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    './BaseHost': { BaseHost: 'BaseHost' }, './useBaseTheme': { useBaseTheme: () => ({ colors: palette }) },
    './workerOrderLayout': load('components/workerOrderLayout.ts'),
    './useWorkerOrderText': { useWorkerOrderText: () => ({ locale: 'uz', t: identity,
      p: (key, values) => key + (values ? JSON.stringify(values) : '') }) },
    '../workerMaterialPresentation': model,
  })[name];
}
function nodes(tree, name) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, name));
  if (!tree || typeof tree !== 'object') return [];
  return [...(tree.type === name ? [tree] : []), ...nodes(tree.props?.children, name)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}

for (const mode of ['light', 'dark']) test(`android: ${mode} order material headers and expanded lists use system colors`, () => {
  const configured = Object.fromEntries(Object.keys(colors).map(name => [name, `configured-${name}`]));
  const system = Object.fromEntries(Object.keys(colors).map(name => [name, `system-${mode}-${name}`]));
  const Header = nativeComponent('WorkerExpansion', 'android', configured, system);
  let presses = 0;
  const header = Header({ title: 'Hali qabul qilinmagan homashyolar', count: '2 ta', expanded: true, onPress: () => presses++, systemColors: true });
  assert.equal(header.props.dynamicColors, true);
  assert.deepEqual(nodes(header, 'Text').map(node => node.props.color), [system.onSurface, system.onSurfaceVariant]);
  assert.equal(nodes(header, 'Icon')[0].props.tint, system.onSurfaceVariant);
  nodes(header, 'TextButton')[0].props.onClick(); assert.equal(presses, 1);
  const otherHeader = Header({ title: 'Qoliplar', count: '1 ta', expanded: false, onPress() {} });
  assert.equal(otherHeader.props.dynamicColors, false);
  assert.deepEqual(nodes(otherHeader, 'Text').map(node => node.props.color), [configured.onSurface, configured.onSurfaceVariant]);

  const List = nativeComponent('WorkerMaterialList', 'android', configured, system), opened = [];
  const pending = { ...row, barcode: 'R2', stock_status: 'ready', received_qty: 0 };
  const list = List({ rows: [row, pending], scanned: [], orderId: '0337', onLongPress: material => opened.push(material) });
  assert.equal(list.props.dynamicColors, true);
  const backgroundOf = node => node.props.modifiers.find(mod => mod.kind === 'background').args[0];
  const balance = nodes(list, 'Column').find(node => node.props.modifiers?.some(mod => mod.kind === 'background'));
  assert.equal(backgroundOf(balance), system.secondaryContainer);
  const materialRows = nodes(list, 'Row').filter(node => node.props.modifiers?.some(mod => mod.kind === 'combinedClickable'));
  assert.deepEqual(materialRows.map(backgroundOf), [system.primaryContainer, system.surfaceContainerHighest]);
  assert.deepEqual(nodes(list, 'Icon').map(node => node.props.tint), [system.onPrimaryContainer, system.onSurfaceVariant]);
  for (const node of nodes(list, 'Text')) assert.ok(Object.values(system).includes(node.props.color));
  materialRows[1].props.modifiers.find(mod => mod.kind === 'combinedClickable').args[0].onLongClick();
  assert.deepEqual(opened, [pending]);
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: all twelve app palettes supply readable text/icon colors, including palettes without onSurfaceVariant`, () => {
    const palettes = require('../src/shared/themePalettes.json');
    for (const modes of Object.values(palettes)) for (const mode of ['light', 'dark']) {
      const palette = modes[mode].colors;
      const List = nativeComponent('WorkerMaterialList', platform, palette), Header = nativeComponent('WorkerExpansion', platform, palette);
      const trees = [List({ rows: [row, { ...row, stock_status: 'ready' }], orderId: '0337', scanned: [], onLongPress() {} }),
        Header({ title: 'Biriktirilgan homashyolar', count: '1 ta', expanded: false, onPress() {} })];
      for (const tree of trees) {
        if (platform === 'android') {
          for (const node of nodes(tree, 'Text')) assert.ok(node.props.color);
          for (const node of nodes(tree, 'Icon')) assert.ok(node.props.tint);
        } else {
          for (const node of [...nodes(tree, 'Text'), ...nodes(tree, 'Image')])
            for (const mod of node.props.modifiers ?? []) if (mod.kind === 'foregroundStyle') assert.ok(mod.args[0]);
        }
      }
    }
  });
  test(`${platform}: empty/loading disclosure has no button or arrow; populated disclosure opens immediately`, () => {
    const Header = nativeComponent('WorkerExpansion', platform), button = platform === 'ios' ? 'Button' : 'TextButton', icon = platform === 'ios' ? 'Image' : 'Icon';
    for (const state of [{ loading: false, error: '', count: 0 }, { loading: true, error: '', count: 0 }]) {
      const section = model.materialSectionExpansion({ ...state, expanded: false });
      const tree = Header({ title: 'Hali qabul qilinmagan homashyo yo‘q', count: state.loading ? '..' : '', expanded: false,
        onPress: section.canToggle ? () => assert.fail('No empty action') : undefined });
      assert.equal(nodes(tree, button).length, 0); assert.equal(nodes(tree, icon).length, 0);
      assert.match(text(tree), /Hali qabul qilinmagan/);
    }
    let presses = 0;
    const tree = Header({ title: 'Biriktirilgan homashyolar', count: '1 ta', expanded: true, onPress: () => presses++ });
    assert.equal(nodes(tree, icon).length, 1);
    nodes(tree, button)[0].props[platform === 'ios' ? 'onPress' : 'onClick'](); assert.equal(presses, 1);
  });
  test(`${platform}: accepted rows use checkmarks, compact native rich text and preserve the material QR long press`, () => {
    const List = nativeComponent('WorkerMaterialList', platform), opened = [];
    const pending = { ...row, barcode: 'R2', stock_status: 'ready', execution_status: 'ready', received_qty: 0 };
    const tree = List({ rows: [row, pending], scanned: [], orderId: '0337', onLongPress: value => opened.push(value) });
    const icons = nodes(tree, platform === 'ios' ? 'Image' : 'Icon');
    assert.match(platform === 'ios' ? icons[0].props.systemName : icons[0].props.source, /check/);
    assert.match(platform === 'ios' ? icons[1].props.systemName : icons[1].props.source, /shippingbox|material.xml/);
    const lines = nodes(tree, 'Text').filter(node => platform === 'ios'
      ? node.props.modifiers?.some(mod => mod.kind === 'lineLimit' && mod.args[0] === 2) : node.props.maxLines === 2);
    assert.equal(lines.length, 2); assert.equal(text(lines[0]), `${row.item_name} • Rulon • OPP • ${row.barcode} • Ishlatilmoqda`);
    const nativeRows = nodes(tree, platform === 'ios' ? 'HStack' : 'Row').filter(node => node.props.modifiers?.some(mod => mod.kind === (platform === 'ios' ? 'onLongPressGesture' : 'combinedClickable')));
    const gesture = nativeRows[0].props.modifiers.find(mod => mod.kind === (platform === 'ios' ? 'onLongPressGesture' : 'combinedClickable'));
    if (platform === 'ios') gesture.args[0](); else gesture.args[0].onLongClick();
    assert.deepEqual(opened, [row]);
    assert.match(text(tree), /105,885 kg/);
    const intake = List({ rows: [row], scanned: [], showBalances: false, onLongPress() {} });
    assert.doesNotMatch(text(intake), /worker.material.balance/);
    const intakeIcon = nodes(intake, platform === 'ios' ? 'Image' : 'Icon')[0];
    assert.doesNotMatch(platform === 'ios' ? intakeIcon.props.systemName : intakeIcon.props.source, /check/);
  });
}

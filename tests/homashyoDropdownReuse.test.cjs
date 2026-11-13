const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const menu = Object.assign(() => {}, { Trigger: 'Trigger', Items: 'Items' });
const item = Object.assign(() => {}, { Text: 'ItemText' });
const walk = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(walk) : [value, ...walk(value.props?.children)];
function setup() {
  let expanded = false;
  const changes = [], filename = path.resolve(__dirname, '../src/shared/filters/DropdownFilter.android.tsx');
  const mocks = {
    'react/jsx-runtime': jsx, react: { useState: () => [expanded, value => { expanded = value; }] },
    '@expo/ui': { Host: 'Host', Row: 'Row', Spacer: 'Spacer', Text: 'Text' },
    '@expo/ui/jetpack-compose': { Box: 'Box', DropdownMenu: menu, DropdownMenuItem: item, OutlinedButton: 'Outlined', TextButton: 'TextButton', Text: 'NativeText' },
    '@expo/ui/jetpack-compose/modifiers': { combinedClickable: value => value, defaultMinSize: value => value, fillMaxWidth: () => 'fill', padding: (...value) => value },
    '../../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' },
  };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const render = extra => mod.exports.DropdownFilter({ label: '', selectedLabel: 'Zebra', backgroundColor: 'surface', options: [
    { value: 'godex', label: 'GoDEX' }, { value: 'zebra', label: 'Zebra' }], onChange: value => changes.push(value), ...extra });
  return { render, changes };
}
test('shared dropdown keeps its existing card and outlined trigger unless inline is requested', () => {
  const h = setup(), tree = h.render({ enabled: false, last: true });
  assert.equal(tree.type, 'Card'); assert.equal(tree.props.first, true); assert.equal(tree.props.last, true);
  assert.equal(walk(tree).find(node => node.type === 'Outlined').props.enabled, false);
});
test('inline printer menu fits its row and retains selection, dismissal and disabled behavior', () => {
  const h = setup(); let tree = h.render({ inline: true });
  assert.equal(tree.type, 'Host'); assert.equal(tree.props.matchContents, true);
  assert.equal(walk(tree).some(node => node.type === 'Card' || node.type === 'Row'), false);
  walk(tree).find(node => node.type === 'TextButton').props.onClick();
  tree = h.render({ inline: true }); assert.equal(walk(tree).find(node => node.type === menu).props.expanded, true);
  walk(tree).filter(node => node.type === item)[1].props.onClick();
  assert.deepEqual(h.changes, ['zebra']);
  tree = h.render({ inline: true, enabled: false });
  assert.equal(walk(tree).find(node => node.type === menu).props.expanded, false);
  assert.equal(walk(tree).find(node => node.type === 'TextButton').props.enabled, false);
});

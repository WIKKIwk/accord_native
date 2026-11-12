const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// @v2-test test/admin_production_map_worker_completed_wip_test_part.dart
function harness() {
  let selected = null;
  const ref = { current: null }, dismissed = [];
  const filename = path.resolve(__dirname, '../src/components/WorkerWipHistory.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const mocks = {
    react: { useState: () => [selected, value => { selected = typeof value === 'function' ? value(selected) : value; }], useImperativeHandle: (target, create) => { target.current = create(); } },
    'react-native': { Platform: { OS: 'ios' }, StyleSheet: { create: value => value } },
    './WorkerOrderSheet': { WorkerOrderSheet: 'OrderSheet' },
    './WorkerOrderDetails': { WorkerOrderFreezeDetails: 'FreezeDetails' },
  };
  mod.require = id => id === 'react/jsx-runtime' ? require(id) : mocks[id] ?? {};
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return { ref, dismissed, render: () => mod.exports.WorkerWipHistorySheet({ ref, session: { profile: { ref: 'worker' } }, onDismiss: () => dismissed.push(true) }) };
}

test('iOS completed history opens the issue reason and dismisses without opening WIP history', () => {
  const h = harness(); assert.equal(h.render(), null);
  const order = { id: 'o', apparatusId: 'apparatus:default:p', issueNote: 'Material nuqsonli' };
  h.ref.current.open(order, { 'apparatus:default:p': '8 ta rangli bosma apparat' });
  const tree = h.render(), detail = tree.props.children;
  assert.equal(tree.type, 'OrderSheet'); assert.equal(tree.props.compact, true);
  assert.equal(detail.type, 'FreezeDetails'); assert.equal(detail.props.order, order);
  assert.equal(detail.props.apparatusName, '8 ta rangli bosma apparat');
  detail.props.onClose(); assert.equal(h.render(), null); assert.equal(h.dismissed.length, 1);
});

test('completed history without an issue keeps the regular WIP list', () => {
  const h = harness(); h.render();
  const order = { id: 'o', apparatusId: 'apparatus:default:p', issueNote: '' };
  h.ref.current.open(order);
  const tree = h.render();
  assert.equal(tree.props.compact, false);
  assert.equal(tree.props.heightFraction, 1, 'the scrollable iOS history uses the native large detent');
  assert.equal(tree.props.children.type.name, 'WorkerWipHistory');
  assert.equal(tree.props.children.props.order, order);
  tree.props.onClose(); assert.equal(h.render(), null);
});

test('a delayed history dismissal cannot clear a later opening of the same order', () => {
  const h = harness(); h.render();
  const order = { id: 'o', apparatusId: 'apparatus:default:p', issueNote: '' };
  h.ref.current.open(order);
  const oldClose = h.render().props.onClose;
  oldClose(); h.render();
  h.ref.current.open(order);
  const latest = h.render();
  oldClose();
  assert.equal(h.render().props.children.props.order, latest.props.children.props.order);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('unrouted checkout read-only owner passes the real session, original boundary and locks through without an action fallback', () => {
  const filename = path.resolve(__dirname, '../src/qolip/QolipCheckoutReadOnlyOwner.tsx'), loaded = new Module(filename, module);
  const session = {}, boundary = {}, locks = { returningIds: new Set(['a']), bulkReturning: true }, snapshot = { invalid: false }, calls = [];
  const mocks = { './useQolipCheckoutView': { useQolipCheckoutView: (...args) => { calls.push(['hook', ...args]); return snapshot; } },
    './QolipCheckoutReadContent': { QolipCheckoutReadContent: props => { calls.push(['content', props]); return React.createElement('div', null, 'content'); } } };
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  const Owner = loaded.exports.QolipCheckoutReadOnlyOwner;
  assert.equal(renderToStaticMarkup(React.createElement(Owner, { session, boundary, locks })), '<div>content</div>');
  assert.deepEqual(calls, [['hook', session, boundary, locks], ['content', { snapshot }]]);
});

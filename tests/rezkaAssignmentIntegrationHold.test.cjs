const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('both live Rezka worker-settings entry points keep assignment writes disabled', () => {
  for (const relative of ['src/app/ios-rezka/(home)/workers.tsx', 'src/rezka/RezkaAndroidShell.android.tsx']) {
    const name = path.resolve(__dirname, '..', relative);
    const tree = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const calls = [];
    const visit = node => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(tree) === 'RezkaWorkerSettingsScreen') calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.equal(calls.length, 1, relative);
    assert.equal(calls[0].attributes.properties.some(p => ts.isJsxSpreadAttribute(p) || (p.name && p.name.getText(tree) === 'allowAssignments')), false, relative);
  }
});

/* global __dirname */
const assert = require('node:assert/strict'), test = require('node:test'), { execFileSync } = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const root = path.resolve(__dirname, '../modules/accord-admin-layout'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-scaffold-host-'));
test.before(() => {
  execFileSync('javac', ['-d', temporary, path.join(root, 'android/src/main/java/expo/modules/accordadminlayout/ScaffoldLayoutRegistry.java'), path.join(root, 'android/src/main/java/expo/modules/accordadminlayout/ScaffoldLayoutTransforms.java'), path.join(root, 'android/src/test/java/expo/modules/accordadminlayout/ScaffoldLayoutHostTest.java')], { encoding: 'utf8' });
  execFileSync('swiftc', ['-parse-as-library', path.join(root, 'ios/ScaffoldLayoutRegistry.swift'), path.join(root, 'ios/ScaffoldLayoutTransforms.swift'), path.join(root, 'ios/ScaffoldLayoutWire.swift'), path.resolve(__dirname, 'native/AdminScaffoldLayoutHostTest.swift'), '-o', path.join(temporary, 'scaffold-swift')], { encoding: 'utf8' });
});
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const cases = ['bootstrap-actual-dock-before-fixed', 'all-three-original-markers-and-raw-ime', 'foreign-window-rejected', 'same-window-foreign-ancestor-rejected', 'nested-parts-never-become-siblings', 'tag-or-native-id-recycle-retires',
  'retained-detach-reattach-same-window', 'different-window-cannot-revive', 'unknown-layout-never-becomes-zero', 'actual-pixel-height-not-semantic-target', 'reentrant-window-change-before-ack', 'exact-release-and-never-reused-ticket',
  'cancel-before-native-bind', 'stale-release-does-not-touch-fresh-owner', 'frame-revisions-dedup-and-source-changes', 'module-destroy-permanent-activity-invalidate-rebinds'];
for (const name of cases) for (const language of ['JVM', 'Swift']) test(`production ${language} original scaffold core: ${name}`, () => {
  const output = language === 'JVM' ? execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminlayout.ScaffoldLayoutHostTest', name], { encoding: 'utf8' }) : execFileSync(path.join(temporary, 'scaffold-swift'), [name], { encoding: 'utf8' });
  assert.equal(output.trim(), name + ' passed');
});
test('production JVM scaffold core requires actual UI-thread ownership', () => {
  assert.equal(execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminlayout.ScaffoldLayoutHostTest', 'off-ui-thread-rejected'], { encoding: 'utf8' }).trim(), 'off-ui-thread-rejected passed');
});
for (const name of ['identity-native-ancestor-path', 'ancestor-transform-never-combines-transformed-origin-with-plain-size', 'transform-path-never-substitutes-another-root-or-cycle']) for (const language of ['JVM', 'Swift']) test(`production ${language} transform path policy: ${name}`, () => {
  const output = language === 'JVM' ? execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminlayout.ScaffoldLayoutHostTest', name], { encoding: 'utf8' }) : execFileSync(path.join(temporary, 'scaffold-swift'), [name], { encoding: 'utf8' });
  assert.equal(output.trim(), name + ' passed');
});

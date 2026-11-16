/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..'), cli = path.join(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js');
for (const platform of ['android', 'apple']) test(`installed Expo autolinker ${platform} resolves only the intended local observer platform`, () => {
  const result = JSON.parse(execFileSync(process.execPath, [cli, 'resolve', '--platform', platform, '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }));
  const value = result.modules.find(value => value.packageName === 'accord-admin-presentation');
  if (platform === 'apple') { assert.equal(value, undefined); return; }
  assert.ok(value); assert.equal(value.projects.length, 1); assert.equal(value.projects[0].sourceDir, path.join(root, 'modules/accord-admin-presentation/android'));
  assert.deepEqual(value.projects[0].modules, [{ classifier: 'expo.modules.accordadminpresentation.AccordAdminPresentationModule', name: null }]);
  assert.equal(value.coreFeatures, undefined);
  const gradle = fs.readFileSync(path.join(value.projects[0].sourceDir, 'build.gradle'), 'utf8'); assert.equal(gradle.includes('compose'), false); assert.match(gradle, /compileOnly 'com\.facebook\.react:react-android'/);
});

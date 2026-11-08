const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getRoutes } = require('expo-router/build/getRoutes');

// Read the same physical route files Metro's require.context would expose, then
// use the installed SDK's route resolver rather than a hand-rolled route parser.
const appRoot = path.resolve(__dirname, '../src/app');
function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : entry.isFile() ? [full] : [];
  });
}
const realKeys = walkFiles(appRoot).map(file => `./${path.relative(appRoot, file).split(path.sep).join('/')}`);
function manifest(platform, keys) {
  const context = () => ({ default: () => null });
  context.keys = () => [...keys];
  const root = getRoutes(context, { platform, skipGenerated: true, ignoreEntryPoints: true, internal_stripLoadRoute: true });
  assert.ok(root, 'Expo Router must resolve the actual root route');
  const result = [];
  const visit = route => { result.push(route.contextKey); (route.children ?? []).forEach(visit); };
  visit(root); return result;
}
for (const platform of ['ios', 'android']) test(`${platform} Expo Router manifest holds both Boyoqchi route trees`, () => {
  const actual = manifest(platform, realKeys);
  assert.ok(actual.includes('./index.tsx'));
  assert.ok(actual.some(key => key.startsWith('./ios-worker/')));
  assert.ok(actual.some(key => key.startsWith('./ios-preparation/')));
  assert.ok(actual.some(key => key.startsWith('./android-preparation/')));
  assert.ok(!actual.some(key => /^\.\/(ios|android)-boyoqchi(?:\/|\.)/.test(key)), actual.join('\n'));
  // Positive control: actual SDK resolver would include these paths if reintroduced.
  const withReintroduced = manifest(platform, [...realKeys, './ios-boyoqchi/_layout.tsx', './ios-boyoqchi/index.tsx',
    './android-boyoqchi/_layout.tsx', './android-boyoqchi/index.tsx']);
  assert.ok(withReintroduced.includes('./ios-boyoqchi/_layout.tsx'));
  assert.ok(withReintroduced.includes('./android-boyoqchi/_layout.tsx'));
});

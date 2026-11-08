const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('iOS photo saving declares the V2 add-only purpose without changing read permissions', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'));
  const entry = config.expo.plugins.find(item => Array.isArray(item) && item[0] === 'expo-media-library');
  assert.ok(entry, 'expo-media-library config plugin is present');
  assert.equal(entry[1].savePhotosPermission,
    'Saved archive pages are added to Photos so you can review and share them later.');
  assert.equal(entry[1].photosPermission, 'Chatda so‘nggi rasmlarni ko‘rsatish va profil uchun rasm tanlashga ruxsat bering.');
  assert.deepEqual(entry[1].granularPermissions, ['photo']);
});

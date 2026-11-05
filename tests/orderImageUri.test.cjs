const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/orderImageUri.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { adminProductionMapOrderImageUrl, calculateOrderImageUrl, orderImageRequestUri } = loaded.exports;
const base = 'https://example.test';

test('order image URL follows V2 trimming, version and thumbnail rules', () => {
  const original = adminProductionMapOrderImageUrl(base, ' order 1 ', ' version 2 ');
  const url = new URL(original);
  assert.equal(url.pathname, '/v1/mobile/admin/production-maps/order-image/view');
  assert.equal(url.searchParams.get('order_id'), 'order 1');
  assert.equal(url.searchParams.get('image_id'), 'version 2');
  assert.equal(orderImageRequestUri(base, original, true).searchParams.get('variant'), 'thumb-v1');
  assert.equal(orderImageRequestUri(base, `${original}&variant=old`, false).searchParams.has('variant'), false);
  assert.equal(new URL(adminProductionMapOrderImageUrl(base, 'order', ' ')).searchParams.has('image_id'), false);
});

test('V2 image URL resolution keeps external and unrelated paths untouched', () => {
  assert.equal(calculateOrderImageUrl(base, ' /v1/mobile/image '), `${base}/v1/mobile/image`);
  assert.equal(calculateOrderImageUrl(base, ' relative '), 'relative');
  const external = 'https://other.test/v1/mobile/admin/production-maps/order-image/view?variant=old';
  assert.equal(orderImageRequestUri(base, external, true).toString(), external);
  const unrelated = `${base}/other?variant=old`;
  assert.equal(orderImageRequestUri(base, unrelated, true).toString(), unrelated);
});

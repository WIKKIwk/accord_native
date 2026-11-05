const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadContract } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const decoder = load('productionMapSnapshot', { './authorizedFetch': {} });
const context = () => JSON.parse(loadContract('order_scan_bootstrap_api_test').find(x => x.test === 'bootstrap decodes context and QR proof in one authorized request').responseBody.text).queue_context;

test('canonical snapshot decodes scoped maps and queue authority', () => {
  const value = decoder.decodeCanonicalProductionMapSnapshot(context(), true);
  assert.equal(value.maps[0].map.id, 'zakaz-scan-bootstrap');
  assert.equal(value.queue_action_controls['apparatus:default:bosma_7']['zakaz-scan-bootstrap'].state, 'pending');
  assert.equal(value.revision, 7);
});

test('canonical snapshot rejects malformed global queue controls', () => {
  for (const edit of [
    value => { delete value.visible_order_ids; },
    value => { value.queue_states['apparatus:default:bosma_7']['zakaz-scan-bootstrap'] = 'unknown'; },
    value => { value.queue_action_controls['apparatus:default:bosma_7']['zakaz-scan-bootstrap'].allowed_actions = ['unexpected']; },
    value => { value.queue_policies = {}; },
    value => { value.frozen_orders_by_apparatus = null; },
  ]) {
    const value = context(); edit(value);
    assert.throws(() => decoder.decodeCanonicalProductionMapSnapshot(value, true));
  }
});

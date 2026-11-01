const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}

const appearance = load('workerOrderAppearance');
const { workerMachinesFromSnapshot, queueFromSnapshot, canWorkOnApparatus } = load('workerApi', {
  './workerOrderAppearance': appearance, './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './authorizedFetch': {},
});

const machine = (id, name, operation) => ({ runtime_projection: { apparatus_id: id, display: { display_name: name }, execution_profile: { operation } } });
const catalog = [machine('cut', 'Kesish', 'cut'), machine('press', 'Bosma', 'print'), machine('press2', 'Bosma 2', 'print')];
const assigned = ['press'];

test('machine visibility follows the server flag and starts with an assigned machine', () => {
  assert.deepEqual(workerMachinesFromSnapshot(catalog, {}, assigned).map(item => item.id), ['press']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: false }, assigned).map(item => item.id), ['press']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned).map(item => item.id), ['press', 'cut', 'press2']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: 'true' }, assigned).map(item => item.id), ['press']);
});

test('watching another machine never enables print work actions or scanning', () => {
  const machines = workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned);
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'press'), assigned), true);
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'press2'), assigned), false);
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'cut'), ['cut']), false);
  assert.equal(canWorkOnApparatus(undefined, assigned), false);
});

test('watchable machine queues do not add other workers completed history', () => {
  const machines = workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned);
  const snapshot = {
    worker_list_rows: { one: { title: 'One' }, two: { title: 'Two' } },
    visible_order_ids: { press: ['one'], cut: ['two'] },
    completed_orders: [
      { apparatus: 'press', order_id: 'one', status: 'completed' },
      { apparatus: 'cut', order_id: 'two', status: 'completed' },
    ],
  };
  const queue = queueFromSnapshot(machines, snapshot, assigned);
  assert.deepEqual(queue.orders.cut.map(order => order.id), ['two']);
  assert.deepEqual(queue.completed.map(order => order.id), ['one']);
});

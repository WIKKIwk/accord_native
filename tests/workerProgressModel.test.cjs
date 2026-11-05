const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/workerProgressModel.ts');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { adminProgressBatchIsFinishedGoodsOutput: finished, progressBatchStatusDetail: status } = loaded.exports;

test('V2 final output requires the matching action, status and no next apparatus', () => {
  assert.equal(finished({ action: 'pause', status: 'resumed', next_apparatus: '' }), true);
  assert.equal(finished({ action: 'detach_roll', status: 'roll_detached', next_apparatus: '' }), true);
  assert.equal(finished({ action: 'complete', status: 'completed', next_apparatus: 'apparatus:default:cut' }), false);
  assert.equal(finished({ action: 'complete', status: 'paused', next_apparatus: '' }), false);
});

test('V2 derives progress status for older responses and respects supplied detail', () => {
  assert.deepEqual(status({ action: 'pause', status: 'paused', wip_status: 'waiting' }),
    { work_status: 'paused', wip_status: 'waiting', flow_status: 'free_wip', stock_status: '' });
  assert.equal(status({ wip_status: 'processed', processed_by_apparatus: 'warehouse:one' }).flow_status, 'accepted_to_stock');
  assert.equal(status({ wip_status: 'processed', processed_by_apparatus: 'apparatus:default:cut' }).flow_status, 'consumed_by_next_stage');
  assert.deepEqual(status({ status: 'paused', status_detail: {} }),
    { work_status: '', wip_status: '', flow_status: '', stock_status: '' });
});

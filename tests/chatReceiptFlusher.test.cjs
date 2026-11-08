const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/chat/chatReceiptFlusher.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { ChatReceiptFlusher } = loaded.exports;

function fixture(overrides = {}) {
  const calls = [];
  let current = true;
  let receipts = [{ conversationId: 'a', deliveredSequence: 5, readSequence: 4 }];
  const deps = {
    isCurrent: () => current,
    deviceId: async () => 'device-1',
    load: async () => { calls.push(['load']); return receipts; },
    delivered: async (...args) => { calls.push(['delivered', ...args]); },
    read: async (...args) => { calls.push(['read', ...args]); },
    acknowledge: async (...args) => { calls.push(['acknowledge', ...args]); },
    ...overrides,
  };
  return { calls, flusher: new ChatReceiptFlusher(deps), stop: () => { current = false; }, setReceipts: value => { receipts = value; } };
}

// Derived from V2 f11910bb ChatStore._flushPendingReceipts.
test('delivers before reading, then acknowledges both successful sequences', async () => {
  const f = fixture();
  await f.flusher.flush();
  assert.deepEqual(f.calls, [
    ['load'], ['delivered', 'a', 5, 'device-1'], ['read', 'a', 4, 'device-1'], ['acknowledge', 'a', 5, 4],
  ]);
});

test('a delivery failure leaves both pending and continues with other conversations', async () => {
  const calls = [];
  const f = fixture({
    delivered: async id => { calls.push(['delivered', id]); if (id === 'a') throw new Error('offline'); },
    read: async id => { calls.push(['read', id]); },
    acknowledge: async (...args) => { calls.push(['acknowledge', ...args]); },
  });
  f.setReceipts([{ conversationId: 'a', deliveredSequence: 5, readSequence: 4 }, { conversationId: 'b', deliveredSequence: 2, readSequence: 1 }]);
  await f.flusher.flush();
  assert.deepEqual(calls, [['delivered', 'a'], ['delivered', 'b'], ['read', 'b'], ['acknowledge', 'b', 2, 1]]);
});

test('a read failure acknowledges only successful delivery so the read can retry', async () => {
  const calls = [];
  const f = fixture({ read: async () => { throw new Error('offline'); }, acknowledge: async (...args) => calls.push(args) });
  await f.flusher.flush();
  assert.deepEqual(calls, [['a', 5, 0]]);
});

test('a receipt queued during a flush triggers another pass, without concurrent duplicate flushes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let reads = 0, loads = 0;
  const f = fixture({
    load: async () => { loads++; return loads === 1 ? [{ conversationId: 'a', deliveredSequence: 0, readSequence: 1 }] : []; },
    read: async () => { reads++; await gate; },
  });
  const first = f.flusher.flush();
  await new Promise(resolve => setImmediate(resolve));
  f.flusher.receiptQueued();
  const second = f.flusher.flush();
  assert.equal(first, second);
  release();
  await first;
  assert.equal(reads, 1);
  assert.equal(loads, 2);
});

test('an account switch during a request prevents old-session acknowledgment', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const f = fixture({ delivered: async () => gate, acknowledge: async (...args) => calls.push(args), read: async () => calls.push(['read']) });
  const pending = f.flusher.flush();
  await new Promise(resolve => setImmediate(resolve));
  f.stop();
  release();
  await pending;
  assert.deepEqual(calls, []);
});

test('a failed flush can be retried', async () => {
  let attempts = 0;
  const f = fixture({ deviceId: async () => { if (++attempts === 1) throw new Error('storage'); return 'device-1'; } });
  await assert.rejects(f.flusher.flush(), /storage/);
  await f.flusher.flush();
  assert.equal(attempts, 2);
});

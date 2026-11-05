const assert = require('node:assert/strict');
const test = require('node:test');
const { contractFetch, loadContract } = require('./support/contractFetch.cjs');

test('contract replay rejects headers that were absent from the V2 request', async () => {
  const name = 'worker HTTP and v2 socket opt into same compact projection, admin unaffected';
  const record = loadContract('worker_list_api_test').find(item => item.test === name);
  const replay = contractFetch('worker_list_api_test', name);
  await assert.rejects(replay(record.url, { headers: { ...record.requestHeaders, Accept: 'application/json' } }), /added header accept/);
});

test('contract replay requires generated body fields to remain present', async () => {
  const name = 'order alert OrderAlertKind.rawMaterial sends directly without resource selection';
  const record = loadContract('order_alert_button_test').find(item => item.test === name);
  const body = JSON.parse(record.requestBody.text);
  delete body.request_id;
  const replay = contractFetch('order_alert_button_test', name, { generated: ['request_id'] });
  await assert.rejects(replay(record.url, { method: record.method, headers: record.requestHeaders, body: JSON.stringify(body) }), /Generated body fields differ/);
});

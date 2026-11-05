// Replays requests recorded from V2 tests (tests/contracts/*.json, made by v2_contracts.sh).
// A V4 function passes only if it sends what V2 sent, and it receives what V2 received.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HEADERS_TO_COMPARE = ['authorization', 'content-type', 'idempotency-key', 'accept'];

function loadContract(stem) {
  const file = path.resolve(__dirname, '../contracts', `${stem}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).records;
}

function testNames(stem) {
  return [...new Set(loadContract(stem).map(record => record.test))];
}

/** The server and token a recorded test used, so a V4 session can match its Authorization header. */
function recordedSession(stem, testName) {
  const record = loadContract(stem).find(item => item.test === testName);
  if (!record) throw new Error(`No recording for "${testName}" in ${stem}.`);
  const header = Object.entries(record.requestHeaders ?? {}).find(([key]) => key.toLowerCase() === 'authorization')?.[1] ?? '';
  return { baseUrl: new URL(record.url).origin, token: header.replace(/^Bearer\s+/, ''), url: new URL(record.url) };
}

function bodyText(body) {
  if (!body) return '';
  return body.text ?? Buffer.from(body.base64, 'base64').toString('latin1');
}

function parseJson(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false }; }
}

function sortedQuery(url) {
  return [...url.searchParams.entries()].sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
}

function withoutKeys(value, keys) {
  if (Array.isArray(value)) return value.map(item => withoutKeys(item, keys));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)).map(([key, item]) => [key, withoutKeys(item, keys)]));
}

function generatedPaths(value, keys, path = '$') {
  if (Array.isArray(value)) return value.flatMap((item, index) => generatedPaths(item, keys, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => keys.includes(key)
    ? [`${path}.${key}`] : generatedPaths(item, keys, `${path}.${key}`));
}

/**
 * Builds a fetch stand-in from one V2 test's recording.
 * Options:
 *   generated: body and query keys whose values are generated per call (ids, timestamps). Compared by presence.
 *   ignoreHeaders: header names to leave out for this test. A reason should sit next to the call.
 *   rawBody: true for multipart, whose random boundary cannot match.
 *   onlyPaths: replay selected paths when the V2 test also exercises unrelated readers.
 */
function contractFetch(stem, testName, options = {}) {
  const { generated = [], ignoreHeaders = [], rawBody = false, onlyPaths } = options;
  const records = loadContract(stem).filter(record => record.test === testName &&
    (!onlyPaths || onlyPaths.includes(new URL(record.url).pathname)));
  if (!records.length) {
    throw new Error(`No recording for "${testName}" in ${stem}. Available:\n${testNames(stem).join('\n')}`);
  }
  const pending = [...records];
  const label = `${stem} > ${testName}`;
  const replay = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const index = pending.findIndex(record => {
      const recorded = new URL(record.url);
      return record.method === method && recorded.pathname === url.pathname;
    });
    if (index < 0) {
      assert.fail(`${label}\nV4 sent ${method} ${url.pathname}, which V2 did not send next.\nV2 still expects:\n${pending.map(item => `${item.method} ${new URL(item.url).pathname}`).join('\n') || '(nothing)'}`);
    }
    const [record] = pending.splice(index, 1);
    const recorded = new URL(record.url);
    const strip = pairs => pairs.filter(([key]) => !generated.includes(key));
    assert.deepEqual(strip(sortedQuery(url)), strip(sortedQuery(recorded)), `${label}\nQuery differs for ${method} ${url.pathname}`);
    assert.deepEqual(sortedQuery(url).filter(([key]) => generated.includes(key)).map(([key]) => key),
      sortedQuery(recorded).filter(([key]) => generated.includes(key)).map(([key]) => key), `${label}\nGenerated query fields differ`);

    const sentHeaders = new Headers(init.headers);
    for (const name of HEADERS_TO_COMPARE) {
      if (ignoreHeaders.includes(name)) continue;
      const expected = Object.entries(record.requestHeaders ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
      const actual = sentHeaders.get(name);
      if (expected === undefined) {
        assert.equal(actual, null, `${label}\nV4 added header ${name} for ${method} ${url.pathname}`);
        continue;
      }
      if (generated.includes(name)) assert.ok(actual, `${label}\nHeader ${name} is missing`);
      else assert.equal(actual, expected, `${label}\nHeader ${name} differs for ${method} ${url.pathname}`);
    }

    const expectedBody = bodyText(record.requestBody);
    if (!rawBody) {
      const sent = typeof init.body === 'string' ? init.body : String(init.body ?? '');
      if (!expectedBody) {
        assert.equal(sent, '', `${label}\nV4 added a body for ${method} ${url.pathname}`);
      } else {
        const a = parseJson(sent);
        const b = parseJson(expectedBody);
        if (a.ok && b.ok) {
          assert.deepEqual(generatedPaths(a.value, generated).sort(), generatedPaths(b.value, generated).sort(), `${label}\nGenerated body fields differ`);
          assert.deepEqual(withoutKeys(a.value, generated), withoutKeys(b.value, generated), `${label}\nBody differs for ${method} ${url.pathname}`);
        }
        else assert.equal(sent, expectedBody, `${label}\nBody differs for ${method} ${url.pathname}`);
      }
    }

    if (record.error) throw new Error(`Recorded failure: ${record.error}`);
    const hasBody = ![101, 204, 205, 304].includes(record.status);
    const responseBody = record.responseBody?.base64 ? Buffer.from(record.responseBody.base64, 'base64') : record.responseBody?.text ?? '';
    return new Response(hasBody ? responseBody : null, { status: record.status, headers: record.responseHeaders ?? {} });
  };
  replay.assertDone = () => {
    assert.deepEqual(pending.map(item => `${item.method} ${new URL(item.url).pathname}`), [], `${label}\nV2 sent these requests and V4 did not`);
  };
  return replay;
}

module.exports = { contractFetch, loadContract, recordedSession, testNames };

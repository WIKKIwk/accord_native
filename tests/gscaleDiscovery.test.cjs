const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/gscale/gscaleDiscovery.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const d = loaded.exports;
const endpoint = (host, port = 39117) => ({ host, port, baseUrl: `http://${host}:${port}` });
const server = (host, ref, latencyMs = 1, port = 39117) => ({
  endpoint: endpoint(host, port), latencyMs,
  handshake: { serverName: 'gscale', displayName: 'RP Scale', role: 'operator', serverRef: ref,
    printActivity: d.printerServerActivity(false) },
});
const response = (status, json) => ({ status, text: async () => JSON.stringify(json) });

// @v2-test test/gscale_discovery_result_test.dart
test('merge preserves old results for an empty fast scan and favors fresh duplicates', () => {
  const current = { servers: [server('192.168.1.4', 'rp-scale', 90)], candidateCount: 1 };
  const empty = { servers: [], candidateCount: 5 };
  assert.equal(d.mergeDiscoveryResults(current, empty, true), current);
  assert.equal(d.mergeDiscoveryResults(current, empty, false), empty);
  const fresh = { servers: [server('gscale.local', 'rp-scale', 12)], candidateCount: 5 };
  assert.deepEqual(d.mergeDiscoveryResults(current, fresh, true), fresh);
  const other = { servers: [server('192.168.1.103', 'other', 12)], candidateCount: 5 };
  assert.deepEqual(d.mergeDiscoveryResults(current, other, true).servers.map(s => s.endpoint.host), ['192.168.1.103', '192.168.1.4']);
});

test('special driver addresses and target labels match V2', () => {
  assert.equal(d.driverUrlForRs(server('192.168.1.114', '5070')), 'http://100.117.62.18:39117');
  assert.equal(d.driverUrlForRs(server('192.168.1.114', 'lab-scale')), 'http://192.168.1.114:39117');
  assert.equal(d.driverUrlForRs(server('192.168.0.100', 'rp-scale-godex-2', 1, 41257)), 'http://100.117.62.18:41257');
  assert.equal(d.printTargetLabel(server('100.117.62.18', 'rp-scale-godex-2')), 'rp-scale-godex-2 @ 39117');
});

test('handshake keeps busy activity and V2 fallback fields', () => {
  const handshake = d.serverHandshake({ server_name: 'rp-scale', display_name: 'RP Scale', role: 'operator',
    server_ref: 'rps-1', busy: true, print_activity: { busy: true, status: 'printing', item_code: 'ITEM-1' } });
  assert.equal(handshake.printActivity.busy, true);
  assert.equal(handshake.printActivity.itemCode, 'ITEM-1');
  assert.equal(d.serverHandshake({ busy: false }).printActivity.status, 'idle');
});

test('probe uses handshake then health fallback, rejecting unrelated services', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    return url.endsWith('/handshake') ? response(503, {}) : response(200, { service: 'mobileapi', busy: true });
  };
  const found = await d.probeServer(fetcher, endpoint('192.168.1.8'));
  assert.deepEqual(calls, ['http://192.168.1.8:39117/v1/mobile/handshake', 'http://192.168.1.8:39117/healthz']);
  assert.equal(found.handshake.serverRef, 'legacy-healthz');
  assert.equal(found.handshake.printActivity.busy, true);
  assert.equal(await d.probeServer(async () => response(200, { service: 'other' }), endpoint('host')), null);
});

test('full scan combines broadcast records with probed platform services, skipping loopback', async () => {
  const optionsSeen = [];
  const channel = {
    async discoverServices(options) {
      optionsSeen.push(options);
      return [{ host: '192.168.1.9', http_port: 41257 }, { host: '127.0.0.1', http_port: 39117 }];
    },
    async discoverAnnouncements(options) {
      optionsSeen.push(options);
      return [{ host: '192.168.1.8', http_port: 39117, server_name: 'wireless', server_ref: 'udp', latency_ms: 10 }];
    },
  };
  const fetcher = async url => url.startsWith('http://192.168.1.9:41257/')
    ? response(200, { service: 'mobileapi', server_name: 'lan', server_ref: 'nsd' }) : response(404, {});
  const result = await d.discoverServers(fetcher, channel);
  assert.equal(result.candidateCount, 5);
  assert.deepEqual(new Set(result.servers.map(s => s.handshake.serverRef)), new Set(['udp', 'nsd']));
  assert.ok(optionsSeen.some(o => o.port === 18081 && o.timeout_ms === 900));
  assert.ok(optionsSeen.some(o => o.service_types?.includes('_rp-scale._tcp.')));
});

test('preferred address probes its requested port first and rejects emulator addresses', () => {
  const targets = d.buildDirectProbeTargets(endpoint('192.168.1.30', 5000));
  assert.equal(targets[0].baseUrl, 'http://192.168.1.30:5000');
  assert.equal(targets.length, 11);
  assert.equal(d.buildDirectProbeTargets(endpoint('10.0.2.2')).length, 5);
  assert.equal(d.parseServerEndpoint('  example.local  ').baseUrl, 'http://example.local:39117');
});

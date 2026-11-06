const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../modules/accord-gscale/src/AccordGscaleModule.ts');
const calls = [];
let native = {
  discoverServices: async options => { calls.push(['nsd', options]); return [{ host: '192.168.1.5', http_port: 39117 }]; },
  discoverBonjourServices: async options => { calls.push(['bonjour', options]); return [{ host: '192.168.1.6', http_port: 39117 }]; },
  discoverAnnouncements: async options => { calls.push(['udp', options]); return [{ host: '192.168.1.7', server_ref: '5070' }]; },
};
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = name => name === 'expo'
  ? { NativeModule: class {}, requireOptionalNativeModule: () => native }
  : require(name);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { AccordGscale } = loaded.exports;

test('native discovery forwards V2 method arguments and records on both platforms', async () => {
  calls.length = 0;
  const options = { timeout_ms: 900, service_types: ['_gscale-mobileapi._tcp.', '_rp-scale._tcp.'] };
  assert.equal((await AccordGscale.discoverServices(options))[0].host, '192.168.1.5');
  assert.equal((await AccordGscale.discoverBonjourServices(options))[0].host, '192.168.1.6');
  assert.equal((await AccordGscale.discoverAnnouncements({ port: 18081, timeout_ms: 900 }))[0].server_ref, '5070');
  assert.deepEqual(calls, [
    ['nsd', options], ['bonjour', options], ['udp', { port: 18081, timeout_ms: 900 }],
  ]);
});

test('missing native module fails instead of returning a fake discovery result', () => {
  const saved = native;
  try {
    native = null;
    assert.throws(() => AccordGscale.discoverAnnouncements({ port: 18081, timeout_ms: 900 }), /development build/);
  } finally { native = saved; }
});

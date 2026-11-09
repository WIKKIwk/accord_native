const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), ts = require('typescript');
const filename = path.resolve('src/productionMapTransferApi.ts'), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
let active = 'A', resolveBody, signalBody; const bodyStarted = new Promise(resolve => { signalBody = resolve; }); const body = new Promise(resolve => { resolveBody = resolve; });
const events = [], mocks = {
  './authorizedFetch': { async authorizedFetch(_session, _url, _init, guard) { guard(); if (active !== 'A') throw new Error('inactive'); return { status: 200, json() { signalBody(); return body; } }; } },
  './sessionReadScope': { sessionReadScope: session => JSON.stringify([session.profile.role, session.profile.ref]) },
  './workerControlsApi': { isCanonicalApparatusId: () => true, productionMapResponseError() {}, WorkerControlException: Error },
  './workerProductionMapSaved': { productionMapSavedFromJson: saved => saved },
  './apparatusTransferCommandStore': { async retainTransferCommand(_scope, command) { return command; }, async acknowledgeTransferCommand() { events.push('ack'); } },
};
mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
(async () => {
 const session = { baseUrl: 'https://example.invalid', profile: { role: 'admin', ref: 'A' } };
 const pending = mod.exports.adminTransferProductionMapOrder(session, { order_id: 'order', from_apparatus: 'apparatus:default:a',
   to_apparatus: 'apparatus:default:b', reason: 'reason', idempotency_key: 'key' });
 await bodyStarted; active = 'B'; resolveBody({ saved: { map: { id: 'order' } } });
 const result = await pending; assert.equal(result.map.id, 'order'); assert.deepEqual(events, ['ack']);
 process.stdout.write('mock: result and acknowledgement completed after account switch\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), ts = require('typescript');
const filename = path.resolve(__dirname, '../../src/admin/adminProductionRequest.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
let sends = 0;
const mocks = { '../authorizedFetch': { async authorizedFetch(_session, _url, _init, guard) { guard(); sends++; return new Response('{}'); } },
  '../workerControlsApi': {}, '../shared/mobileApiException': {} };
mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const hostile = Promise.reject(new Error('hostile guard rejection'));
Object.defineProperty(hostile, 'constructor', { get() { throw new Error('hostile constructor'); } });
mod.exports.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', () => hostile).then(
  () => { process.stdout.write('unexpected success\n'); },
  error => { process.stdout.write(`${error.message};sends=${sends}\n`); },
);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const worker = load('workerLaminationRemainders', { './workerControlsApi': controls, './workerProgressBatch': {} });
const model = load('admin/layerRemainderModel', { '../workerLaminationRemainders': worker }), uri = load('admin/dartUri');
const source = { source_kind: 'progress_batch', source_id: 'source', session_id: 'session', revision: 7,
  source_net_kg: 50, source_meter: 1500 }, remainder = { operation_id: 'r', source_kind: 'progress_batch', source_id: 'source',
  remaining_net_kg: 20, remaining_meter: 600, recorded_by: { display_name: 'Operator' } };
// Dart SDK Uri.encodeQueryComponent source documents RFC 3986 unreserved bytes and '+' for spaces.
// These are source-derived Node mocks, not a new f119 Flutter recording.
test('query encoding follows Dart rules for all ASCII, Unicode and malformed UTF-16', () => {
  for (let code = 0; code < 128; code++) {
    const char = String.fromCharCode(code), expected = /[A-Za-z0-9._~-]/.test(char) ? char : code === 32 ? '+' : `%${code.toString(16).toUpperCase().padStart(2, '0')}`;
    assert.equal(uri.dartQueryComponent(char), expected, `ASCII ${code}`);
  }
  assert.equal(uri.dartQueryComponent("a ~*!()'&=é"), 'a+~%2A%21%28%29%27%26%3D%C3%A9');
  assert.equal(uri.dartQueryComponent('😀\ud800x\udc00'), '%F0%9F%98%80%EF%BF%BDx%EF%BF%BD');
});
test('snapshot reuses strict Worker parsers and preserves V2 list ordering', () => {
  const result = model.layerRemainderSnapshotFromJson({ sources: [source, { ...source, source_id: 'second' }], remainders: [remainder] });
  assert.deepEqual(result.sources.map(value => value.source_id), ['source', 'second']);
  assert.equal(result.remainders[0].recorded_by_name, 'Operator');
  assert.deepEqual(model.layerRemainderSnapshotFromJson({ sources: null, remainders: {} }), { sources: [], remainders: [] });
  assert.throws(() => model.layerRemainderSnapshotFromJson({ sources: [null] }), TypeError);
  assert.throws(() => model.layerRemainderSnapshotFromJson({ remainders: [4] }), TypeError);
});

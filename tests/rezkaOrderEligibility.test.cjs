const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaOrderEligibility.ts'), mod = new Module(file, module);
mod.filename = file; mod.paths = module.paths;
mod.require = id => id === '../workerControlsApi' ? { isCanonicalApparatusId: value => {
  const s = value.trim(), parts = s.split(':'); return !!s && s.length <= 128 && s === s.toLowerCase() && !/\s/.test(s) &&
    parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
} } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { rezkaLinearStageApparatus: stages, rezkaOrderSettingsVisibility: visible } = mod.exports;
const a = 'apparatus:default:a', b = 'apparatus:default:b', c = 'apparatus:default:c';
const node = (id, kind, apparatus = '', group = '', assigned = '') => ({ id, kind, title: id, apparatus_id: apparatus,
  alternative_group_id: group, alternative_assigned_apparatus_id: assigned });
const edge = (from, to, branch = '') => ({ from, to, branch });
const map = { id: 'order', nodes: [node('start', 'start'), node('choice', 'condition'), node('a', 'apparatus', a, 'alternatives'),
  node('b', 'apparatus', b, 'alternatives'), node('task', 'task'), node('c', 'apparatus', c), node('end', 'end'), node('away', 'apparatus', 'apparatus:default:away')],
  edges: [edge('start', 'choice'), edge('choice', 'a', 'ha'), edge('choice', 'away', 'maybe'), edge('a', 'task'), edge('b', 'task'),
    edge('task', 'c'), edge('c', 'end'), edge('c', 'choice')] };
const watch = { kind: 'watch', workerMode: true, isWorkerListPresentationOrder: false,
  apparatus: { id: ` ${a} `, operation: ' CUT ' }, frozen: false, lifecycleStatus: null };
const yes = { showPrintSide: true, showWorkOptions: true }, printOnly = { showPrintSide: true, showWorkOptions: false },
  no = { showPrintSide: false, showWorkOptions: false };

test('f119 linear work stages follow reachable conditional branches and alternative groups without cycles', () => {
  assert.deepEqual(stages(map), [a, b, c]);
  assert.deepEqual(stages({ ...map, nodes: map.nodes.filter(n => n.kind !== 'start') }), []);
  assert.deepEqual(stages({ id: 'x', nodes: [node('s', 'start'), node('x', 'apparatus', a, '', b)], edges: [edge('s', 'x')] }), [b]);
  assert.deepEqual(stages({ id: 'x', nodes: [node('s', 'start'), node('x', 'apparatus', 'bad')], edges: [edge('s', 'x')] }), []);
  assert.deepEqual(stages({ ...map, edges: map.edges.map(e => e.from === 'choice' && e.to === 'a' ? { ...e, branch: " Yo'Q " } : e) }), [a, b, c]);
});
test('f119 watch entry requires master, assigned reachable stage, assigned watch machine and cut operation', () => {
  assert.deepEqual(visible(map, watch, 'rezka_master', [a]), yes);
  assert.deepEqual(visible(map, watch, 'aparatchi', [a]), no);
  assert.deepEqual(visible({ ...map, id: ' training-1 ' }, watch, 'rezka_master', [a]), no);
  assert.deepEqual(visible({ ...map, id: 'template-1' }, watch, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, watch, 'rezka_master', ['apparatus:default:away', a.toUpperCase()]), no);
  assert.deepEqual(visible(map, { ...watch, workerMode: false }, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, { ...watch, isWorkerListPresentationOrder: true }, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, { ...watch, apparatus: { id: b, operation: 'cut' } }, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, { ...watch, apparatus: { id: a, operation: 'print' } }, 'rezka_master', [a]), no);
});
test('f119 frozen or finished orders permit only print side, and completed history uses its own operation condition', () => {
  assert.deepEqual(visible(map, { ...watch, frozen: true }, 'rezka_master', [a]), printOnly);
  for (const lifecycleStatus of ['production_completed', ' CLOSED ', 'Cancelled'])
    assert.deepEqual(visible(map, { ...watch, lifecycleStatus }, 'rezka_master', [a]), printOnly);
  assert.deepEqual(visible(map, { ...watch, lifecycleStatus: 'in_progress' }, 'rezka_master', [a]), yes);
  assert.deepEqual(visible(map, { kind: 'completed', isWorkerListPresentationOrder: false, apparatus: { operation: ' cut ' } }, 'rezka_master', [a]), printOnly);
  assert.deepEqual(visible(map, { kind: 'completed', isWorkerListPresentationOrder: false, apparatus: { operation: 'CUT' } }, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, { kind: 'completed', isWorkerListPresentationOrder: false, apparatus: null }, 'rezka_master', [a]), no);
  assert.deepEqual(visible(map, { kind: 'completed', isWorkerListPresentationOrder: true, apparatus: { operation: 'cut' } }, 'rezka_master', [a]), no);
});

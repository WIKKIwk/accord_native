const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts'), scope = load('sessionReadScope.ts');
// @v2-test test/aparatchi_work_instructions_screen_test.dart
test('worker guide reuses the existing instructions owner with limit 300 and a before-send session guard', async () => {
  const requests = []; let active = true;
  const { useWorkerWorkInstructions } = load('components/useWorkerWorkInstructions.ts', {
    react: { useMemo: fn => fn(), useCallback: fn => fn }, '../auth': { activeSessionToken: () => active ? 'token' : null },
    '../sessionReadScope': scope, '../shared/appRoutes': routes,
    '../apparatusApi': { adminApparatus: async (session, options) => { options.beforeSend(); requests.push(options.limit); return []; } },
    '../rezka/useRezkaWorkInstructions': { useApparatusWorkInstructions: (session, isCurrent, read) => ({ session, isCurrent, read }) },
  });
  const session = { token: 'token', profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['apparatus.queue.read'], assigned_apparatus: ['apparatus:default:print'] };
  const model = useWorkerWorkInstructions(session);
  assert.equal(model.session, session); assert.equal(model.isCurrent(), true); await model.read(); assert.deepEqual(requests, [300]);
  session.assigned_apparatus = []; assert.equal(model.isCurrent(), false); await assert.rejects(model.read(), /Session scope changed/);
  active = false; assert.equal(model.isCurrent(), false); assert.deepEqual(requests, [300]);
});

test('both worker platforms reuse their actual native instructions view and retain back navigation', () => {
  for (const platform of ['ios', 'android']) {
    const model = { content: { title: 'Guide' } }, back = [];
    const { WorkerWorkInstructions } = load(`components/WorkerWorkInstructions.${platform}.tsx`, {
      react: { useEffect: () => {} }, 'react-native': { BackHandler: {} },
      './useWorkerOrderText': { useWorkerOrderText: () => ({ t: value => value }) },
      '../rezka/RezkaWorkInstructions': { WorkInstructionsView: 'NativeGuide' },
      './useWorkerWorkInstructions': { useWorkerWorkInstructions: () => model },
    });
    const tree = WorkerWorkInstructions({ session: {}, onBack: () => back.push(true) });
    assert.equal(tree.type, 'NativeGuide'); assert.equal(tree.props.model, model); tree.props.navigation.onPress(); assert.equal(back.length, 1);
  }
});

test('worker instructions entry opens the iOS stack or the existing Android security-owned section', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/WorkerScreen.tsx'), 'utf8');
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let declaration;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'selectDestination') declaration = node; ts.forEachChild(node, visit); }; visit(ast);
  const js = ts.transpileModule(`${declaration.getText(ast)}; return selectDestination;`, {
    fileName: 'screen.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  for (const native of [true, false]) {
    const pushed = [], sections = [];
    const choose = new Function('nativeNavigation', 'router', 'setSection', js)(native, { push: route => pushed.push(route) }, section => sections.push(section));
    choose('instructions'); assert.deepEqual(pushed, native ? ['/ios-worker/instructions'] : []); assert.deepEqual(sections, native ? [] : ['instructions']);
  }
});

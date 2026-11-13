const fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '../../src');
function load(file, mocks = {}) {
  const filename = path.join(root, file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const ast = ts.createSourceFile('OrderScreen.tsx', fs.readFileSync(path.join(root, 'OrderScreen.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'OrderScreen');
// Only hook storage is discovered from the source. All expected UI behavior lives in the tests' V2 cases.
const stateNames = screen.body.statements.filter(ts.isVariableStatement).flatMap(node => node.declarationList.declarations)
  .filter(node => ts.isArrayBindingPattern(node.name) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useState')
  .map(node => node.name.elements[0].name.text);
const catalog = require('../../src/shared/localization/catalog.json');
const localize = load('shared/localization/index.ts', { './catalog.json': catalog });
const wording = load('workerOrderText.ts', { './shared/localization/catalog.json': catalog, './shared/localization': localize });
const rules = load('workerOrderLogic.ts', { './workerControlsApi': { cancelStartControl: () => null, temporaryPauseControl: () => null } });
const scope = load('sessionReadScope.ts');
const controls = load('workerControlsApi.ts', { './authorizedFetch': {}, './sessionReadScope': scope });
const paintModel = load('boyoqchi/returnedPaintModel.ts', { '../workerControlsApi': controls });
const paintRules = load('boyoqchi/returnedPaintRules.ts', { '../workerOrderLogic': rules, './returnedPaintModel': paintModel });
const paintReport = load('workerReturnedPaint.ts', { './workerOrderLogic': rules, './boyoqchi/returnedPaintModel': paintModel, './boyoqchi/returnedPaintRules': paintRules });
const reclose = load('workerOrderReclose.ts', { './workerControlsApi': controls, './sessionReadScope': scope });
const card = load('workerOrderCardState.ts'), blocking = load('workerOrderBlocking.ts'), materials = load('workerMaterialPresentation.ts');
const fab = load('workerFabQr.ts', { './workerControlsApi': controls, './workerOrderLogic': rules,
  './workerOutputProgress': { workerNextWorkStages: map => map.nodes ?? [], workerWipConsumerIds: map => map.consumers ?? [] } });
const merge = load('workerOrderMerge.ts', { './workerControlsApi': controls, './workerOrderLogic': rules, './workerFabQr': fab });
const presentation = load('workerOrderPresentation.ts');
const detailRecovery = load('workerDetailRecovery.ts');
const inputProgress = load('workerInputProgress.ts', { './workerControlsApi': controls, './workerOpeningWipCandidatesApi': {},
  './workerOutputProgress': {}, './workerPeremotka': load('workerPeremotka.ts'), './workerProgressBatch': {}, './workerProgressApi': {}, './workerWipApi': {} });
const api = load('workerApi.ts', { './authorizedFetch': {}, './workerQueueLimit': {}, './workerOrderAppearance': {}, './workerSnapshot': {},
  './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': {}, './workerQueueReadApi': {}, './workerQueueReadError': {} });
const instructions = load('workerOrderRezkaInstructions.ts', { './workerApi': api, './workerControlsApi': controls, './workerPeremotka': load('workerPeremotka.ts') });
const native = new Proxy({}, { get: (_target, key) => String(key) });
const row = barcode => ({ barcode, order_id: '0198', apparatus: 'apparatus:default:bosma_8', execution_status: 'ready' });
function harness(platform, input = {}, locale = 'uz') {
  const station = 'apparatus:default:bosma_8', values = new Map(), effects = [], actions = [], notices = [], closed = [], preflights = [], alerts = [], paintUploads = [], paintDeletes = [], sheetContents = [];
  let cursor = 0, refCursor = 0, memoCursor = 0, fresh = input.fresh !== false, mergeOptions, mergeFlow, savedPresentation = null, readScope = 'scope';
  const refs = [], layouts = [], layoutDeps = []; let layoutCursor = 0;
  const memos = [];
  const p = (key, parameters) => localize.productionText(key, locale, parameters);
  const text = { locale, p, t: value => wording.workerOrderText(value, locale) };
  const interaction = { mode: 'paused', start_materials_mode: 'hidden', material_intake_allowed: true,
    previous_wip_mode: 'not_required', opening_wip_mode: 'not_required', qolip_mode: 'not_required', blocking_reason_code: 'apparatus_busy', ...input.interaction };
  const control = { state: interaction.mode, stage_node_id: 'stage', allowed_actions: [], previous_stage: 'upstream', ...input.control, interaction };
  const bootstrap = { ok: true, control_state: { apparatus: station, order_id: '0198', epoch: 'epoch', rev: 1,
    order_control: 'active', ...input.controlState, control }, sections: {
    materials: { status: 'ready', data: { requires_material: false, assignments_satisfied: true, scan_satisfied: true,
      assignments: [row('A')], assigned_barcodes: [], staged_barcodes: [], ...input.requirements } },
    qolips: { status: 'ready', data: { qolip: { required_qolips: [] } } }, ...input.sections } };
  const overrides = { detail: { epoch: 'epoch', rev: 1, maps: [{ map: { id: '0198', order_number: '0198', title: 'mofun keks' } }] }, bootstrap, detailReadScope: 'scope',
    loading: false, attachedMaterials: [row('A')], attachedReadKey: JSON.stringify(['scope', station, '0198', 'epoch', 1, 0]),
    intakeCandidatesState: [row('B'), row('C'), row('D'), row('E')], intakeReadKey: JSON.stringify(['scope', station, '0198', 'epoch', 1, 0]), ...input.states };
  const mocks = {
    react: { useState(initial) { const name = stateNames[cursor++]; if (!values.has(name)) values.set(name, Object.hasOwn(overrides, name) ? overrides[name] : typeof initial === 'function' ? initial() : initial);
      return [values.get(name), value => values.set(name, typeof value === 'function' ? value(values.get(name)) : value)]; },
      useRef: value => refs[refCursor++] ?? (refs[refCursor - 1] = { current: value }), useContext: () => null, useCallback: callback => callback,
      useMemo: (create, deps) => { const i = memoCursor++, previous = memos[i];
        if (!previous || !deps || deps.some((value, index) => !Object.is(value, previous.deps[index]))) memos[i] = { value: create(), deps };
        return memos[i].value; },
      useEffect: callback => effects.push(callback), useLayoutEffect: (callback, deps) => {
        const index = layoutCursor++, previous = layoutDeps[index];
        if (!deps || !previous || deps.some((value, index) => !Object.is(value, previous[index]))) { layoutDeps[index] = deps; layouts.push(callback); }
      }, useEffectEvent: callback => callback },
    'react-native': { ...native, ActivityIndicator: 'ActivityIndicator', Alert: { alert: (...args) => alerts.push(args) }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Platform: { OS: platform, Version: 26 },
      PlatformColor: value => value, DynamicColorIOS: value => ({ dynamic: value }), StyleSheet: { create: value => value }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' },
    '@expo/ui': { Host: 'Host', TextInput: 'NativeInput', useNativeState: initial => ({ value: initial, set() {} }) },
    'expo-image': { Image: 'Image' }, 'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
    'expo-image-picker': native, 'expo-haptics': native, './auth': { activeSessionToken: () => 'token' },
    './sessionReadScope': { sessionReadScope: () => readScope }, './nativeSheet': { useNativeSheet: () => ({ open(content) { sheetContents.push(content); }, close() {}, update(content) { sheetContents.push(content); }, isOpen: () => false }) },
    './workerOrderLogic': { ...rules, validOrderControl: () => fresh, validWorkerOrderControl: () => fresh }, './workerOrderCardState': card, './workerOrderBlocking': blocking,
    './shared/mobileApiException': load('shared/mobileApiException.ts'),
    './shared/localization': localize,
    './workerMoldPresentation': load('workerMoldPresentation.ts'),
    './components/workerOrderLayout': load('components/workerOrderLayout.ts'),
    './workerReturnedPaint': paintReport,
    './workerCompletion': load('workerCompletion.ts'),
    './boyoqchi/BoyoqchiFormContent': { ReturnedPaintField: 'PaintField', ReturnedPaintNamedFieldDialog: 'PaintNamedDialog' },
    './components/WorkerReturnedPaintField': { WorkerReturnedPaintField: 'PaintField' },
    './boyoqchi/BoyoqchiImage': { BoyoqchiImage: 'PaintImage' },
    './boyoqchi/returnedPaintApi': {
      uploadReturnedPaintImage: async (...args) => { paintUploads.push(args); return input.uploadPaint ? input.uploadPaint(...args) : { image_id: 'new-image', image_url: '/new-image', image_name: 'photo.jpg', image_mime: 'image/jpeg', image_size_bytes: 1 }; },
      deleteReturnedPaintImage: async (...args) => { paintDeletes.push(args); return input.deletePaint?.(...args); },
    },
    './workerReturnedPaintPhoto': {
      selectWorkerReturnedPaintPhoto: async (...args) => input.pickPaintPhoto ? input.pickPaintPhoto(...args) : { uri: 'file:photo', width: 10, height: 10 },
      prepareWorkerReturnedPaintPhoto: async (...args) => input.preparePaintPhoto ? input.preparePaintPhoto(...args) : { bytes: new Uint8Array([1]), mime: 'image/jpeg', filename: 'photo.jpg' },
    },
    './workerOrderMerge': merge, './workerFabQrReads': { workerFabQrReads: () => input.mergeReads },
    './workerOrderPresentation': presentation,
    // This harness exercises the real order's presentation/commands. Input-progress
    // reads have their own hook tests; retain its real model for this view fixture.
    './components/useWorkerInputProgress': { useWorkerInputProgress: ({ source, label }) => inputProgress.workerInputProgressModel({ source, batches: [], loading: false, error: '' }, p, label) },
    './workerDetailRecovery': detailRecovery,
    './workerDetailRecoveryRead': {
      readWorkerDetailSnapshot: (...args) => input.readDetail ? input.readDetail(...args) : Promise.resolve(overrides.detail),
      // Existing presentation fixtures contain no full snapshot action controls.
      workerDetailInitialBootstrap: () => null,
    },
    './workerOrderRezkaInstructions': instructions,
    './components/useWorkerOrderPresentation': { useWorkerOrderPresentation(input, data) {
      const result = presentation.workerOrderPresentationFor(savedPresentation, input, data); savedPresentation = result.next;
      return { ...result, clear: () => { savedPresentation = null; } };
    } },
    './workerQueueAction': { adminApparatusQueueActionResult: async (_session, body, current) => { if (!current()) throw new Error('stale'); actions.push(body); return input.runQueueAction ? await input.runQueueAction(body) : input.runMerge ? await input.runMerge() : { has_states: true }; } },
    './workerPrintPreflight': { adminPrintPreflight: async (_session, body) => { preflights.push(body); return input.runPreflight ? await input.runPreflight(body) : {}; } },
    './workerScanBootstrap': { adminOrderScanBootstrap: async () => input.readBootstrap ? await input.readBootstrap() : structuredClone(bootstrap) },
    './workerScanSections': { completeWorkerScanSections: async (_session, value) => value },
    './components/useWorkerOrderMerge': { useWorkerOrderMerge(options) {
      mergeOptions = options;
      if (!mergeFlow) mergeFlow = new merge.WorkerOrderMergeFlow({ available: () => mergeOptions.available, current: () => mergeOptions.current(),
        reads: () => mergeOptions.reads(), target: () => mergeOptions.target, p: (key, values) => mergeOptions.p(key, values),
        write: (...args) => mergeOptions.write(...args), notice: message => mergeOptions.notice(message), changed() {} });
      return { state: mergeFlow.state, flow: mergeFlow, scanning: ['scanning', 'checking'].includes(mergeFlow.state.phase),
        pending: !['closed', 'scanning'].includes(mergeFlow.state.phase) };
    } },
    './workerMaterialPresentation': materials, './workerQr': { WorkerInitialQr: class { run() {} }, workerQrPayload: value => value },
    './workerOrderReclose': reclose, './workerLongPress': { workerLongPressMenu: () => ({ actions: ['reclose'] }),
      runWorkerMenuAction: async (...args) => { actions.push(args); await input.runReclose?.(); } },
    './workerLaminationWorkflow': { usesIntegratedLaminationReport: () => false }, './workerScannedWips': { scannedWipStage: () => '', canReadScannedWips: () => false },
    './workerApi': { workerOrderDetailFromSnapshot: value => value }, './components/useWorkerOrderText': { useWorkerOrderText: () => text },
    './components/useWorkerColors': { useWorkerColors: () => ({ field: '#111', surface: '#222', text: '#fff', muted: '#aaa' }) },
    './components/useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ element: null, selectDevice() {} }) },
  };
  const filename = path.join(root, 'OrderScreen.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'react/jsx-runtime' ? require(id) : native;
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const props = { session: { baseUrl: 'https://example.invalid', token: 'token', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: ['apparatus.queue.manage'], assigned_apparatus: [station] }, apparatusId: station, orderId: '0198',
    apparatus: { id: station, name: '8 ta rangli bosma apparat', operation: 'print', ...input.apparatus },
    apparatusCatalog: [{ id: 'upstream', name: 'Upstream' }], queueCursor: { epoch: 'epoch', rev: 1 }, busyOrderTitle: 'shashoqcha',
    onNotice: message => notices.push(message), onClose: () => closed.push(true), onChanged() {} };
  return { p, values, props, bootstrap, effects, actions, notices, closed, preflights, alerts, paintUploads, paintDeletes, sheetContents, setFresh: value => { fresh = value; }, setScope: value => { readScope = value; },
    render: () => { cursor = 0; refCursor = 0; memoCursor = 0; layoutCursor = 0; effects.length = 0; layouts.length = 0; const tree = mod.exports.OrderScreen(props); layouts.forEach(effect => effect()); return tree; } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function main(tree) { return nodes(tree, node => node.type === 'ScrollView')[0]; }
const buttons = tree => nodes(main(tree), node => node.type?.name === 'NativeButton' || node.type === 'WorkerPreflightButton');
module.exports = { harness, nodes, main, buttons, load, card, blocking, reclose, row, merge, fab, rules, presentation, api, instructions };

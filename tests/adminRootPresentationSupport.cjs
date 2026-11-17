/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { randomUUID } = require('node:crypto');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + (file.includes('.tsx') ? '' : '.ts')), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const guard = load('shared/camera/synchronousGuard'), tickets = load('admin/adminPresentationWindowTicket', { 'expo-crypto': { randomUUID } });
let originalNative = null;
const sheetProtocol = load('../modules/accord-admin-presentation/src/AccordAdminOwnedSheet', { expo: {
  requireOptionalNativeModule: () => originalNative, requireNativeView: () => function OriginalOwnedSheetView(props) { return { type: 'OriginalOwnedSheetView', props }; },
} });
const sheetRetirement = load('../modules/accord-admin-presentation/src/AccordAdminOwnedSheetRetirement', { './AccordAdminOwnedSheet': sheetProtocol });
const sheetTypes = load('admin/AdminRootSheetTypes'), sheetAuthority = load('admin/AdminRootSheetAuthority');
const profileGuard = load('shared/profileSessionGuard');
const sheetLifecycle = load('admin/adminRootSheetLifecycle', { '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet': sheetProtocol,
  '../shared/profileSessionGuard': profileGuard, './adminPresentationWindowTicket': tickets, './AdminRootSheetAuthority': sheetAuthority });
const parentDomain = load('admin/adminRootNativeParentOwner', { '../shared/camera/synchronousGuard': guard });
const sheetCoordinator = load('admin/adminRootSheetCoordinator', { '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheetRetirement': sheetRetirement,
  './AdminRootSheetAuthority': sheetAuthority, './adminPresentationWindowTicket': tickets, './adminRootSheetLifecycle': sheetLifecycle });
const core = load('admin/adminRootPresentationChain', { '../shared/camera/synchronousGuard': guard, './adminPresentationWindowTicket': tickets,
  './AdminRootSheetTypes': sheetTypes, '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet': sheetProtocol,
  '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheetRetirement': sheetRetirement, './adminRootNativeParentOwner': parentDomain,
  './adminRootSheetCoordinator': sheetCoordinator });
async function sheetCapability(platform, handlers = {}) {
  const calls = [], native = { async sheetCapability() { return { protocol: 1, platform, guarantee: platform === 'ios' ? 'owned-uikit-presentation-and-dismissal' : 'owned-android-presentation-and-dismissal', viewName: 'AdminSheetPortal' }; },
    async sheetRetirementCapability() { return { protocol: 1, platform, guarantee: 'owned-original-sheet-retirement' }; },
    async retireSheet(presentationTicket, parentTicket, retirementTicket) { calls.push([presentationTicket, parentTicket, retirementTicket]); return { protocol: 1, platform, presentationTicket, parentTicket, retirementTicket, receiptID: randomUUID(), disposition: 'removed' }; }, ...handlers };
  originalNative = native;
  const nativeCapability = await sheetProtocol.readAdminOwnedSheetCapability(platform), retirementCapability = await sheetRetirement.readAdminOwnedSheetRetirementCapability(nativeCapability);
  return { nativeCapability, retirementCapability, calls, native };
}
const presentation = Object.freeze({ transparent: false, animationType: 'none', presentationStyle: 'fullScreen' });
const content = outlet => ({ type: 'real-content-fixture', props: { children: outlet } });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(platform = 'android', extra = {}) {
  let current = true; const rootIdentity = {}, rootNative = {}, chain = new core.AdminRootPresentationChain({ platform, rootIdentity, isCurrent: () => current, ...extra });
  const rootStop = chain.attachNative(chain.root, rootNative, rootIdentity);
  const rootReady = () => { chain.nativeShown(chain.root, rootNative); if (platform === 'android') chain.nativeArmed(chain.root, rootNative); };
  const request = (changes = {}) => ({ parent: chain.top(), identity: {}, kind: 'page', presentation, renderContent: content, isCurrent: () => current, onRequestClose: () => {}, ...changes });
  const open = (changes = {}) => chain.open(request(changes));
  const native = value => { const identity = {}, stop = chain.attachNative(value, identity); return { identity, stop, shown: () => chain.nativeShown(value, identity), armed: () => chain.nativeArmed(value, identity),
    ready: () => { chain.nativeShown(value, identity); if (platform === 'android') chain.nativeArmed(value, identity); }, removed: () => chain.nativeRemoved(value, identity) }; };
  return { chain, rootIdentity, rootNative, rootStop, rootReady, request, open, native, current: value => { current = value; } };
}
module.exports = { load, guard, tickets, core, presentation, content, flush, deferred, fixture, sheetCapability, sheetProtocol, sheetRetirement, sheetTypes, sheetLifecycle, parentDomain };

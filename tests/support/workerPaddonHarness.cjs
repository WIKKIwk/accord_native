const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), ts = require('typescript');
const tick = () => new Promise(setImmediate);
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function hooks() {
  let index = 0; const slots = [], effects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const effect = (fn, deps) => { const i = index++, old = slots[i]; if (!old || changed(old.deps, deps)) { const next = slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); next.cleanup = fn(); }); } };
  const react = { useState(initial) { const i = index++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
    return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { return react.useMemo(() => ({ current: initial }), []); },
    useMemo(fn, deps) { const i = index++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useReducer: (reducer, initial) => { const [value, set] = react.useState(initial); return [value, action => set(previous => reducer(previous, action))]; },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps), useEffect: effect, useLayoutEffect: effect, useSyncExternalStore: (_sub, get) => get() };
  return { react, begin: () => { index = 0; }, flush: () => { while (effects.length) effects.shift()(); }, dispose: () => slots.forEach(s => s?.cleanup?.()) };
}
const batch = (id, extra = {}) => ({ batch_id: id, qr_payload: id, wip_status: 'waiting', payload_json: {}, bobina_kg: 1,
  produced_qty: 1, uom: 'kg', order_id: 'order', label_item_name: 'Film', apparatus: 'cut', ...extra });
function snapshot(code = 'P1', items = [], extra = {}) { return { paddon: { code, apparatus_id: 'cut', locked_at_unix: null, created_by_ref: 'worker',
  created_by_display_name: 'Worker', location: 'cut', contains_peremotka: false, note: '', total_gross_kg: null, total_net_kg: null, item_count: items.length },
  items, available_items: [batch('A'), batch('B')], can_manage_items: true, can_unlock: false, free_movement_enabled: false, ...extra }; }
async function setup(kind = 'detail', platform = 'ios') {
  const runner = hooks(), watches = new Set(), cache = new Map(), h = { version: 1, events: [], sheets: [], platform, kind };
  h.session = { baseUrl: 'https://example.test', token: 'one', profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['apparatus.queue.manage'], assigned_apparatus: ['cut', 'cut2'] };
  h.paddons = new Map([['P1', snapshot()], ['P2', snapshot('P2')]]);
  h.catalog = ['cut', 'cut2'].map(id => ({ id, name: id, lifecycle_state: 'active', operation: 'cut', sort_order: 0 }));
  h.props = { session: h.session, code: 'P1', apparatus: 'cut', onBack: () => h.events.push(['back']), onDetail: (...args) => h.events.push(['detail', ...args]), onTransfer: id => h.events.push(['transferRoute', id]) };
  const p = (key, values) => key + (values ? `|${JSON.stringify(values)}` : ''), guard = valid => { assert(valid()); };
  class Cancel extends Error {}
  const files = {
    auth: { currentSession: () => h.session, captureSessionWitness: () => ({ version: h.version }), isSessionWitnessCurrent: witness => witness.version === h.version,
      subscribeSessionWitness: fn => { watches.add(fn); return () => watches.delete(fn); } },
    apparatusApi: { adminApparatus: async (_session, options) => { options.beforeSend(); h.events.push(['catalog', options.limit]); return h.catalog; } },
    paddonManagementApi: {
      adminPaddonDetail: async (_session, code, options) => { options.beforeSend(); h.events.push(['read', code]); return h.paddons.get(code); },
      adminPaddonQrReport: async (_session, code, options) => { options.beforeSend(); h.events.push(['report', code]); return h.paddons.get(code); },
      adminPaddons: async (_session, options) => { options.beforeSend(); h.events.push(['list', options.apparatus, options.limit]); return [...h.paddons.values()].map(row => row.paddon).filter(row => row.apparatus_id === options.apparatus); },
      adminPaddonCreate: async (_session, options) => { options.beforeSend(); h.events.push(['create', options.apparatus]); return { ...snapshot('P3').paddon, apparatus_id: options.apparatus }; },
      adminPaddonDelete: async (_session, code, beforeSend) => { beforeSend(); h.events.push(['delete', code]); h.paddons.delete(code); },
    },
    paddonItemsApi: { adminPaddonAddWips: async (_session, input, valid) => { guard(valid); h.events.push(['add', input.progress_batch_ids]);
      const old = h.paddons.get(input.paddon_code), next = { ...old, items: [...old.items, ...input.progress_batch_ids.map(id => batch(id))] }; h.paddons.set(input.paddon_code, next); return next; },
      adminPaddonRemoveWip: async (_session, input, valid) => remove(input.paddon_code, [input.progress_batch_id], true, valid),
      adminPaddonRemoveWips: async (_session, input, valid) => remove(input.paddon_code, input.progress_batch_ids, false, valid) },
    workerProgressApi: { adminProgressQrLookup: async (_session, qr, options) => { guard(options.current); h.events.push(['lookup', qr]); return h.lookup ? h.lookup(qr) : batch(qr); } },
    paddonUnlockApi: { unlockPaddon: async (_session, code, valid) => { guard(valid); h.events.push(['unlock']); const old = h.paddons.get(code), next = { ...old, can_manage_items: true, paddon: { ...old.paddon, locked_at_unix: null } }; h.paddons.set(code, next); return next; } },
    paddonTransferApi: { transferPaddonItems: async (_session, from, to, ids, valid) => { guard(valid); h.events.push(['move', from, to, ids]); } },
    workerPrinting: { WorkerPrintCancelled: Cancel, workerPrinterFields: () => ({ print_transport: 'bluetooth' }),
      pickWorkerPrinter: async options => { guard(options.current); h.events.push(['pickPrinter']); if (h.cancelPrinter) throw new Cancel(); return h.printerSelection ? h.printerSelection() : {}; },
      printWorkerJobs: async (_data, _printer, valid) => { guard(valid); h.events.push(['physicalPrint']); if (h.printFailure) throw Error('print'); } },
    paddonPrintApi: { adminPaddonPrintQr: async (_session, input) => { input.beforeSend(); h.events.push(['preparePrint', input.code, input.print_transport]);
      return { ok: true, paddon: h.paddons.get(input.code).paddon, qr_payload: input.code, can_close_after_print: true, print_job: { epc: input.code, label_kind: 'paddon_code' } }; } },
    paddonConfirmPrintApi: { confirmPaddonPrint: async (_session, code, valid) => { guard(valid); h.events.push(['confirmPrint']); if (h.confirmFailure) throw Error('confirm');
      const old = h.paddons.get(code), next = { ...old, can_manage_items: false, can_unlock: true, paddon: { ...old.paddon, locked_at_unix: 2 } }; h.paddons.set(code, next);
      return { paddon: next.paddon, newly_locked: true, apparatus: null, apparatus_options: { cut: 'cut' } }; } },
    paddonSuccessorApi: { createActivePaddonSuccessor: async (_session, code, apparatus, valid) => { guard(valid); h.events.push(['successor', code, apparatus]); return snapshot('P3').paddon; } },
    'components/useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: v => v, locale: 'uz' }) },
    'components/useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ dialogs: null, selectDevice: async () => null }) },
    'components/WorkerPaddonPicker': { WorkerPaddonPicker: 'Picker' }, 'components/WorkerWipBatchDetails': { WorkerWipBatchDetails: 'WipDetails' },
    nativeSheet: { useNativeSheet: () => runner.react.useMemo(() => {
      const sheet = { content: null, options: null, shown: false, open(content, options) { sheet.content = content; sheet.options = options; sheet.shown = true; h.sheets.push(sheet); },
        close() { sheet.shown = false; }, isOpen: () => sheet.shown }; return sheet;
    }, []) },
  };
  function remove(code, ids, single, valid) { guard(valid); h.events.push(['remove', ids, single]); const old = h.paddons.get(code), next = { ...old, items: old.items.filter(row => !ids.includes(row.batch_id)) }; h.paddons.set(code, next); return next; }
  const packages = { react: runner.react, 'react/jsx-runtime': jsx, 'expo-router': { useFocusEffect: fn => runner.react.useEffect(fn, [fn]) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'success', Error: 'error' }, notificationAsync: async () => {} },
    'react-native': { Platform: { OS: platform }, ToastAndroid: { show: message => h.events.push(['toast', message]) } } };
  function load(name) {
    if (files[name]) return files[name]; if (cache.has(name)) return cache.get(name);
    if (name.endsWith('.json')) return require(path.resolve(__dirname, '../../src', name));
    const relative = [`${name}.ts`, `${name}.tsx`, `${name}/index.ts`, `${name}/index.tsx`].find(file => fs.existsSync(path.resolve(__dirname, '../../src', file)));
    assert(relative, name); const file = path.resolve(__dirname, '../../src', relative), mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
    mod.require = id => id.startsWith('.') ? load(path.posix.normalize(path.posix.join(path.posix.dirname(relative), id))) : Object.hasOwn(packages, id) ? packages[id] : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file); cache.set(name, mod.exports); return mod.exports;
  }
  h.load = load; h.runner = runner; h.packages = packages; h.files = files;
  const hookName = { detail: 'useWorkerPaddonDetail', list: 'useWorkerPaddonList', transfer: 'useWorkerPaddonTransfer' }[kind], hook = load(`components/${hookName}`)[hookName];
  h.render = () => { runner.begin(); h.model = hook(h.props); runner.flush(); return h.model; };
  h.expire = () => { h.version++; watches.forEach(fn => fn()); };
  h.close = async (value = 'confirm') => { h.model.presentation.close(value); h.render(); if (platform === 'ios') h.model.presentation.dismissed(); await tick(); return h.render(); };
  h.dispose = runner.dispose; h.render(); await tick(); h.render(); return h;
}
module.exports = { setup, hooks, tick, defer, batch, snapshot, jsx };

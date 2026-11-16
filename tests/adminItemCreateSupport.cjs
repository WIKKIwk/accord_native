const s = require('./adminUsersSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard');
const MobileApiException = s.load('shared/mobileApiException').MobileApiException;
const groups = s.load('admin/itemGroupModel', { './dartJsonString': s.strings });
const relevance = s.load('qolip/qolipSearchRelevance', { './qolipSearchEngine': s.load('qolip/qolipSearchEngine', { '../shared/searchNormalizer': s.load('shared/searchNormalizer') }) });
const model = s.load('admin/adminItemCreateModel', { './dartJsonString': s.strings, './itemGroupModel': groups,
  '../shared/mobileApiException': { MobileApiException }, '../qolip/qolipSearchRelevance': relevance });
const scope = s.load('admin/adminItemCreateScope', { '../shared/camera/synchronousGuard': strict });
const cache = s.load('admin/adminItemCreateCache');
const list = s.load('admin/adminItemCreateListController', { './adminItemCreateScope': scope, './adminItemCreateModel': model, './dartJsonString': s.strings, '../shared/camera/synchronousGuard': strict });
const form = s.load('admin/adminItemCreateFormController', { './adminItemCreateScope': scope, './adminItemCreateModel': model, './dartJsonString': s.strings, './itemGroupModel': groups });
const picker = s.load('admin/adminItemCreatePickerController', { './adminItemCreateScope': scope, './adminItemCreateModel': model, './dartJsonString': s.strings });
const coordinator = s.load('admin/adminItemCreateController', { './adminItemCreateFormController': form, './adminItemCreateListController': list,
  './adminItemCreateModel': model, './adminItemCreatePickerController': picker, './dartJsonString': s.strings });
const item = (code, patch = {}) => ({ code, name: `Name ${code}`, uom: 'PCS', item_group: '', warehouse: '', requires_dimensions: false, order_apparatus_options: [], order_microns: [], customer_names: [], ...patch });
const group = (name, parent = '', display = name) => ({ name, item_group_name: display, parent_item_group: parent, is_group: false });
function listOwner(overrides = {}) {
  const clock = s.scheduler(), memory = new cache.AdminItemCreateMemoryCache(), calls = []; let valid = true;
  const deps = { isCurrent: () => valid, namespace: 'one', cache: memory, page: async (...args) => { calls.push(args); return []; },
    move: async () => ({ updated_count: 0, failed_count: 0, updated_item_codes: [] }), canSelect: () => true, canOpenItem: () => true, openItem: async () => {}, setTimer: clock.set, clearTimer: clock.clear, ...overrides };
  const controller = new list.AdminItemCreateListController(deps); return { controller, calls, deps, clock, memory, valid: value => { valid = value; } };
}
function formOwner(overrides = {}) {
  const calls = []; let valid = true;
  const deps = { isCurrent: () => valid, sales: false, initialItemGroup: '', returnOnCreate: false, tree: async () => [group('All Item Groups'), group('Raw', 'All Item Groups'), group('Tayyor mahsulot', 'All Item Groups')],
    groups: async () => { throw new Error('unexpected fallback'); }, uoms: async () => ['PCS', 'kg'], duplicateItems: async () => [], create: async input => { calls.push(input); return item('CREATED'); }, clearItemCache() { calls.push('clear'); }, reloadItems: async () => { calls.push('reload'); }, ...overrides };
  const controller = new form.AdminItemCreateFormController(deps); return { controller, calls, deps, valid: value => { valid = value; } };
}
function pickerOwner(overrides = {}) {
  const calls = [], closed = [], clock = s.scheduler(); let valid = true;
  const deps = { isCurrent: () => valid, fetch: async (...args) => { calls.push(args); return []; }, title: value => value.name, subtitle: value => value.ref ?? '', onClosed: value => closed.push(value), setTimer: clock.set, clearTimer: clock.clear, ...overrides };
  return { controller: new picker.AdminItemCreatePickerController(deps), deps, calls, closed, clock, valid: value => { valid = value; } };
}
function owner(overrides = {}) {
  const f = formOwner(), l = listOwner(), returned = []; let valid = true;
  const deps = { isCurrent: () => valid, namespace: 'one', cache: l.memory, form: f.deps, list: l.deps, customers: async () => [], onReturnCreated: value => returned.push(value), ...overrides };
  return { controller: new coordinator.AdminItemCreateController(deps), deps, returned, memory: l.memory, valid: value => { valid = value; } };
}
module.exports = { ...s, strict, MobileApiException, groups, model, scope, cache, list, form, picker, coordinator, item, group, listOwner, formOwner, pickerOwner, owner };

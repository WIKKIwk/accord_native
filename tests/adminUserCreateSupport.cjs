const support = require('./adminUsersSupport.cjs');
const { load, strings, model: users } = support;
const sync = load('shared/camera/synchronousGuard'), exception = load('shared/mobileApiException');
const engine = load('qolip/qolipSearchEngine', { '../shared/searchNormalizer': load('shared/searchNormalizer') }), relevance = load('qolip/qolipSearchRelevance', { './qolipSearchEngine': engine });
const model = load('admin/adminUserCreateModel', { '../qolip/qolipSearchRelevance': relevance, '../shared/mobileApiException': exception, './adminUsersModel': users, './dartJsonString': strings });
const { AdminUserCreateController } = load('admin/adminUserCreateController', { '../shared/camera/synchronousGuard': sync, './adminUserCreateModel': model, './dartJsonString': strings });
const role = (id, base_role = null, capability_codes = [], system = true) => model.adminUserCreateRoleFromJson({ id, label: `Label ${id}`, base_role, capability_codes, system });
const settings = (patch = {}) => ({ erp_url: 'ERP', erp_api_key: 'key', erp_api_secret: 'secret', default_target_warehouse: 'A', default_uom: 'kg',
  werka_phone: ' original phone ', werka_name: ' Original ', werka_avatar_url: 'avatar', werka_code: ' original code ', werka_code_locked: true, werka_code_retry_after_sec: 0, admin_phone: 'admin phone', admin_name: 'admin', ...patch });
function fixture(options = {}, overrides = {}) {
  let current = true; const calls = [], timers = new Set(), roles = [role('aparatchi'), role('qolipchi', 'qolipchi'), role('prep-custom', 'tayyorlov_masteri', [], false), role('item_creator', null, [], false), role('item_other', null, [], false)];
  const deps = { current: () => current,
    roles: async (guard, witness) => { guard(); calls.push('roles'); if (!witness()) throw Error('witness'); return roles; },
    apparatus: async (guard, witness) => { guard(); calls.push('apparatus'); if (!witness()) throw Error('witness'); return [{ id: 'apparatus:default:A', name: 'A' }, { id: 'apparatus:default:B', name: 'B' }]; },
    groups: async (guard, witness) => { guard(); calls.push('groups'); if (!witness()) throw Error('witness'); return [' Kraska ', '', 'Kley', 'Kraska']; },
    settings: async guard => { guard(); calls.push('settings'); return settings(); }, updateSettings: async (value, guard) => { guard(); calls.push(['settings-update', value]); return settings({ werka_code: 'saved' }); },
    regenerateWerka: async guard => { guard(); calls.push('werka-regenerate'); return settings({ werka_code: 'regenerated', werka_code_retry_after_sec: 3 }); },
    customer: async (name, phone, guard) => { guard(); calls.push(['customer', name, phone]); return { ref: ' Customer Ref ', name: ' Returned name ', phone }; },
    supplier: async (name, phone, guard) => { guard(); calls.push(['supplier', name, phone]); return { ref: 'Supplier', name, phone, code: 'SUP-CODE' }; },
    material: async (name, phone, groups, guard) => { guard(); calls.push(['material', name, phone, groups]); return { code: 'MAT-CODE' }; },
    system: async (role, name, phone, guard) => { guard(); calls.push(['system', role, name, phone]); return { id: 'System ID' }; },
    regenerateCustomer: async (ref, guard) => { guard(); calls.push(['customer-regenerate', ref]); return { code: 'CUSTOMER-CODE' }; },
    regenerateSystem: async (id, guard) => { guard(); calls.push(['system-regenerate', id]); return { code: 'SYSTEM-CODE' }; },
    assign: async (value, guard) => { guard(); calls.push(['assign', value]); }, invalidateUsers: () => calls.push('invalidate-users'), invalidateCustomerPicker: () => calls.push('clear-customers'),
    copy: async (value, guard) => { guard(); calls.push(['copy', value]); }, customerCreated: customer => calls.push(['returned', customer]),
    everySecond: fn => { timers.add(fn); return fn; }, cancelTimer: fn => timers.delete(fn), ...overrides };
  const controller = new AdminUserCreateController(deps, { customerOnly: false, returnCustomer: false, initialName: '', principalRole: 'admin', capabilities: [], ...options });
  const start = async () => { controller.start(); await support.flush(); };
  const select = async predicate => { await controller.openRoles(() => true); const picker = controller.getSnapshot().picker, choice = controller.getSnapshot().choices.find(typeof predicate === 'function' ? predicate : value => value.role?.id === predicate || value.kind === predicate && !value.role);
    if (!choice) throw Error(`choice not found ${predicate}`); controller.chooseRole(picker.id, choice); controller.completePicker(picker.id); await support.flush(); return choice; };
  const finishCode = () => { const value = controller.getSnapshot().issuedCode; if (value) { controller.dismissCode(value.id); controller.completeCode(value.id); } };
  return { controller, deps, calls, timers, roles, start, select, finishCode, retire: () => { current = false; }, restore: () => { current = true; }, tick: () => [...timers].forEach(fn => fn()),
    name: value => controller.change(controller.getSnapshot().formId, 'name', value), phone: value => controller.change(controller.getSnapshot().formId, 'phone', value) };
}
module.exports = { ...support, users, sync, exception, model, AdminUserCreateController, role, settings, fixture };

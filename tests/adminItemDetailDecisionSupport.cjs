const base = require('./adminItemDetailSupport.cjs');
const { load, strings, sync } = base;
const edit = load('admin/adminItemDetailEditModel', { './dartJsonString': strings });
const group = load('admin/adminItemDetailGroupModel', { './dartJsonString': strings });
const customers = load('admin/adminItemDetailCustomersController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings });
const menuModel = load('admin/adminItemDetailActionMenuModel');
const decisions = load('admin/adminItemDetailDecisionController', { '../shared/camera/synchronousGuard': sync,
  './adminItemDetailActionMenuModel': menuModel,
  './adminItemDetailController': base.controller, './adminItemDetailCustomersController': customers, './adminItemDetailEditModel': edit,
  './adminItemDetailGroupModel': group, './adminItemDetailModel': base.model, './dartJsonString': strings });
function fixture(overrides = {}, initial = base.detail({ order_image_order_id: 'original image' })) {
  let current = true; const calls = [], reads = [];
  const deps = { isCurrent: () => current,
    read: async (code, guard, witness) => { guard(); if (!witness()) throw Error('witness'); reads.push(code); return initial; },
    rename: async (detail, draft, guard) => { guard(); calls.push(['rename', detail, draft]); return base.detail({ ...detail, ...draft, order_image_order_id: '' }); },
    remove: async (detail, guard) => { guard(); calls.push(['remove', detail]); },
    groups: async (guard, witness) => { guard(); if (!witness()) throw Error('witness'); calls.push(['groups']); return [' B ', 'A', 'b', '', ' Kraska ']; },
    moveGroup: async (detail, group, guard, witness) => { guard(); if (!witness()) throw Error('witness'); calls.push(['group', detail, group]); return base.detail({ ...detail, item_group: group, order_image_order_id: '' }); },
    customers: async (query, guard, witness) => { guard(); if (!witness()) throw Error('witness'); calls.push(['customers', query]); return [{ ref: 'C', name: 'Customer', phone: '' }]; },
    setCustomer: async (detail, customer, assigned, guard, witness) => { guard(); if (!witness()) throw Error('witness'); calls.push(['customer', detail, customer, assigned]); return base.detail({ ...detail, customers: assigned ? [customer] : [], order_image_order_id: '' }); }, ...overrides };
  const owner = new decisions.AdminItemDetailDecisionController(' Code ', deps);
  return { owner, deps, calls, reads, initial, start: async () => { owner.start(); await base.flush(); }, retire: () => { current = false; }, restore: () => { current = true; },
    dialog: id => owner.getSnapshot().dialogs.find(value => value.id === id), close: async (id, confirm) => { const ticket = owner.prepareClose(id, confirm); if (!ticket) throw Error('no close ticket'); return owner.completeClose(ticket); } };
}
const menus = load('admin/adminItemDetailActionMenuController', { '../shared/camera/synchronousGuard': sync, './adminItemDetailActionMenuModel': menuModel });
module.exports = { ...base, edit, group, customers, decisions, fixture, menuModel, menus };

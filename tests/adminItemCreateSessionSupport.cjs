const s = require('./adminItemCreateSupport.cjs');
const profile = s.load('shared/profileSessionGuard');
function fixture(overrides = {}) {
  const session = { token: 'original', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'Admin' }, capabilities: ['admin.access', 'catalog.item.create', 'catalog.item.bulk_move', 'party.customer.manage'] }, witness = { generation: 9, session };
  const authority = { epoch: 3, token: 'original', witness: true, scope: 'original scope', route: true, parent: true }, calls = [], memory = new s.cache.AdminItemCreateMemoryCache();
  const record = (name, result) => async (...args) => { calls.push([name, ...args]); const guard = [...args].reverse().find(value => typeof value === 'function' && value.length === 0); if (guard && guard() === false) throw Error('retired'); return typeof result === 'function' ? result(...args) : result; };
  const catalog = { adminCatalogItemsPage: record('items', []), adminCatalogItemUoms: record('uoms', ['PCS']), createAdminCatalogItem: record('create', s.item('created')), moveAdminCatalogItems: record('move', { updated_count: 0, failed_count: 0, updated_item_codes: [] }), ...overrides.catalog };
  const factory = s.load('admin/adminItemCreateSession', { '../auth': { activeSessionEpoch: () => authority.epoch, activeSessionToken: () => authority.token, isSessionWitnessCurrent: value => value === witness && authority.witness },
    '../sessionReadScope': { sessionReadScope: () => authority.scope }, '../shared/appRoutes': { appRoutes: s.routes.appRoutes, canOpenRoute: () => authority.route },
    '../shared/profileSessionGuard': profile, './adminItemCreateCacheNamespace': { adminItemCreateCacheNamespace: () => 'original namespace' }, './adminItemCreateController': s.coordinator,
    './adminItemCreateModel': s.model, './adminItemCreateRuntime': { adminItemCreateMemoryCache: memory }, './adminItemCatalogApi': catalog,
    './adminItemCreateCustomersApi': { readAdminItemCreateCustomers: record('customers', []) }, './itemGroupApi': { adminItemGroupTree: record('tree', [s.group('All Item Groups')]), adminItemGroups: record('groups', []) } });
  const props = { session, witness, isCurrent: () => authority.parent, onOpenItem: async () => {}, onCreateCustomer: async () => null, onReturnCreated: () => {}, onBack() {}, ...overrides.props };
  const owner = factory.createAdminItemCreateSession(props);
  return { ...s, owner, factory, props, session, witness, authority, calls, memory };
}
module.exports = { ...s, profile, fixture };

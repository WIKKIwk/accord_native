const base = require('./adminUserCreateSupport.cjs');
const { load, strings, checked, sync, exception, model: customerModel } = base;
const uri = load('admin/dartUri');
const model = load('admin/adminItemDetailModel', { './adminUserCreateModel': customerModel, './dartJsonString': strings });
const controller = load('admin/adminItemDetailController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings });
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': exception, './searchActivityStore': { SearchActivityStore: class {} } });
const groups = load('admin/itemGroupModel', { './dartJsonString': strings });
const customerDetail = load('admin/adminCustomerDetailModel', { '../shared/catalogApi': catalog, './dartJsonString': strings });
function api(transport) {
  const groupApi = load('admin/itemGroupApi', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': exception, './dartJsonString': strings, './itemGroupModel': groups });
  const catalogApi = load('admin/adminItemCatalogApi', { '../authorizedFetch': transport, '../shared/catalogApi': catalog, './adminProductionRequest': checked,
    './dartJsonString': strings, './dartUri': uri, './itemGroupApi': groupApi, './itemGroupModel': groups });
  const customersApi = load('admin/adminCustomerDetailApi', { '../authorizedFetch': transport, '../shared/catalogApi': catalog, '../shared/mobileApiException': exception,
    '../workerControlsApi': {}, './adminApiError': {}, './adminCustomerDetailModel': customerDetail, './adminProductionRequest': checked,
    './adminUsersApi': {}, './adminUsersModel': {}, './adminWarehouseSettingsApi': {}, './dartJsonString': strings, './dartUri': uri, './itemGroupApi': groupApi });
  return load('admin/adminItemDetailApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, './adminCustomerDetailApi': customersApi,
    './adminItemCatalogApi': catalogApi, './adminItemDetailModel': model, './adminProductionRequest': checked, './adminUserCreateModel': customerModel,
    './dartJsonString': strings, './dartUri': uri, './itemGroupApi': groupApi });
}
const detail = (patch = {}) => model.adminItemDetailFromJson({ code: 'Code', name: 'Name', uom: 'kg', item_group: 'Kraska', ...patch });
module.exports = { ...base, model, controller, api, detail };

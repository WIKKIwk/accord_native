const base = require('./adminItemDetailSupport.cjs');
const { load, strings, sync, exception } = base;
const uri = load('admin/dartUri');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const saved = load('workerProductionMapSaved', { './workerControlsApi': controls });
const template = load('workerOpenedOrderEditApi', { './authorizedFetch': {}, './workerControlsApi': controls, './workerProductionMapSaved': saved });
const presentation = load('admin/adminItemDetailComboPresentation', { './dartJsonString': strings, './dartUri': uri });
const controllers = load('admin/adminItemDetailComboController', { '../shared/camera/synchronousGuard': sync, './adminItemDetailComboPresentation': presentation, './dartJsonString': strings });
function api(transport) {
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  return load('admin/adminItemDetailComboApi', { '../workerOpenedOrderEditApi': template, '../workerProductionMapSaved': saved,
    './adminItemDetailApi': base.api(transport), './adminProductionRequest': request, './dartJsonString': strings, './dartUri': uri });
}
const product = (item_code = 'SKU', name = '', patch = {}) => saved.orderProductFromJson({ item_code, product: name, frame_product_size_mm: 12.25, frame_count: 3, ...patch });
const entry = (code = 'Combo') => { const combo = saved.comboFromJson({ item_code: code, id: 'combo', revision: 2 }); return { combo, template: { ...template.calculateOrderTemplateFromJson({ products: [{ item_code: 'SKU' }] }), combo } }; };
module.exports = { ...base, controls, saved, template, presentation, controllers, api, product, entry };

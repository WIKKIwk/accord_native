import { calculate, type CalculateInput } from '../calculateApi';
import { WorkerControlException } from '../workerControlsApi';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { comboFromJson, productionMapSavedFromJson } from '../workerProductionMapSaved';
import { openedOrderEditSourceFromJson, openedOrderEditResponseError } from '../workerOpenedOrderEditApi';
import { adminApiError } from './adminApiError';
import { adminProductionRequest } from './adminProductionRequest';
import { calculateOrderTemplateFromJson, calculateOrderTemplateToJson, calculateOrderTemplateEffectiveLayers, type CalculateOrderTemplate } from './calculateOrderTemplateModel';
import { productionMapDraftToJson, productionDraftJson, requireProductionMapApparatusIds, type ProductionMapDraft } from './productionMapDraftModel';
import { dartJsonString } from './dartJsonString';
import { MobileApiException } from '../shared/mobileApiException';
type Guard = () => void;
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => { if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected a response object'); return value as ObjectValue; };
const options = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: productionDraftJson(body) });
const result = (raw: unknown) => { const payload = object(raw); return { saved: productionMapSavedFromJson(payload.saved), template: payload.template && typeof payload.template === 'object' && !Array.isArray(payload.template) ? calculateOrderTemplateFromJson(payload.template) : null }; };
export async function adminSaveProductionMap(session: Session, map: ProductionMapDraft, guard: Guard) { guard(); requireProductionMapApparatusIds(map); const saved = await adminProductionRequest(session, '/v1/mobile/admin/production-maps', options('PUT', productionMapDraftToJson(map)), 'production_map_save', guard); guard(); return productionMapSavedFromJson(saved); }
export async function adminSaveProductionMapWithOrder(session: Session, map: ProductionMapDraft, template: CalculateOrderTemplate, pendingOrderId: string, templateAction: string, guard: Guard) { guard(); requireProductionMapApparatusIds(map); const raw = await adminProductionRequest(session, '/v1/mobile/admin/production-maps/with-order', options('PUT', { map: productionMapDraftToJson({ ...map, image_id: template.image_id.trim() }), template: calculateOrderTemplateToJson(template), ...(templateAction ? { template_action: templateAction } : {}), ...(pendingOrderId ? { pending_order_id: pendingOrderId } : {}) }), 'production_map_save', guard); guard(); return result(raw); }
export async function adminAutoOpenProductionMap(session: Session, template: CalculateOrderTemplate, duplicate: boolean, includeBobina: boolean, standard: boolean | null, guard: Guard) { guard(); const raw = await adminProductionRequest(session, '/v1/mobile/admin/production-maps/auto-open', options('POST', { template: calculateOrderTemplateToJson(template), duplicate_rezka_labels: duplicate, include_bobina_in_net: includeBobina, ...(standard !== null ? { standard_print_side: standard } : {}) }), 'production_map_auto_open', guard); guard(); return result(raw); }
export function productionComboLayoutSignature(template: CalculateOrderTemplate) { const options = template.production_options; return productionDraftJson({ customer_ref: template.customer_ref.trim(), products: template.products.map(product => ({ item_code: product.item_code.trim(), frame_product_size_mm: product.frame_product_size_mm, frame_count: product.frame_count })), layers: calculateOrderTemplateEffectiveLayers(template).map(layer => ({ ...((layer.material_id.trim()) ? { material_id: layer.material_id.trim() } : {}), material: layer.material.trim(), micron: layer.micron.trim() })), edge_allowance_mm: template.edge_allowance_mm, print_val_size_mm: template.print_val_size_mm, production_options: options ? { print_method: options.print_method, cold_glue: options.cold_glue, ...(options.diameter_mm !== null ? { diameter_mm: options.diameter_mm } : {}) } : null, roll_count: template.roll_count, status: template.status.trim().toLowerCase(), image_id: template.image_id, color: template.color }); }
export async function adminSaveProductionCombo(session: Session, name: string, template: CalculateOrderTemplate, comboId: string | null, guard: Guard) { guard(); const raw = object(await adminProductionRequest(session, '/v1/mobile/admin/combos', options('POST', { name: name.trim(), template: calculateOrderTemplateToJson(template), ...(comboId ? { combo_id: comboId } : {}) }), 'combo_save_failed', guard)); guard(); const combo = comboFromJson(raw.combo); if (!combo || !combo.id || !combo.item_code || combo.revision < 1)
    throw new TypeError('Incomplete combo revision response'); return combo; }
export async function orderPrintSidePreference(session: Session, template: CalculateOrderTemplate, guard: Guard) { guard(); const response = await authorizedFetch(session, '/v1/mobile/calculate/print-side', options('POST', calculateOrderTemplateToJson(template)), guard); guard(); if (response.status !== 200)
    throw await adminApiError(response, 'print_side_preference_failed', 'Saqlangan taraf yuklanmadi'); const payload = object(await response.json()); guard(); const value = payload.standard_print_side; if (value != null && typeof value !== 'boolean')
    throw new TypeError('Invalid saved print side'); return value ?? null; }
export async function uploadCalculateOrderImage(session: Session, bytes: Uint8Array, filename: string, guard: Guard) { guard(); const response = await authorizedFetch(session, '/v1/mobile/calculate/orders/image', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-file-name': filename }, body: new Uint8Array(bytes).buffer }, guard); guard(); let decoded: unknown; try {
    decoded = await response.json();
}
catch {
    decoded = {};
} guard(); const payload = decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded as ObjectValue : {}; if (response.status !== 200)
    throw new MobileApiException({ code: dartJsonString(payload.error ?? '').trim() || 'calculate_image_save', message: dartJsonString(payload.detail ?? '').trim() || 'Calculate image save failed', statusCode: response.status }); const raw = payload.image !== null && typeof payload.image === 'object' && !Array.isArray(payload.image) ? payload.image as ObjectValue : {}; const string = (key: string) => dartJsonString(raw[key] ?? '').trim(), size = raw.image_size_bytes; return { image_id: string('image_id'), image_name: string('image_name'), image_mime: string('image_mime'), image_size_bytes: typeof size === 'number' ? Math.trunc(size) : /^[+-]?\d+$/.test(String(size ?? '')) ? Number(size) : 0, image_url: string('image_url') }; }
export async function adminSaveOpenedOrderEdit(session: Session, source: ReturnType<typeof openedOrderEditSourceFromJson>, template: CalculateOrderTemplate, guard: Guard) { guard(); const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/order-edit?id=${encodeURIComponent(source.order_id)}`, options('PUT', { original: source.original, template: calculateOrderTemplateToJson(template) }), guard); guard(); let raw: unknown; try {
    raw = await response.json();
}
catch {
    raw = null;
} guard(); if (response.status !== 200) {
    const error = openedOrderEditResponseError(response.status, raw);
    throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode });
} return openedOrderEditSourceFromJson(raw); }
export async function calculateDraft(session: Session, input: CalculateInput, guard: Guard) { guard(); try {
    const value = await calculate(session, input, guard);
    guard();
    return value;
}
catch (error) {
    guard();
    if (error instanceof WorkerControlException)
        throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode });
    throw error;
} }

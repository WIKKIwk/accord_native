import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import { calculateOrderTemplateFromJson, calculateOrderTemplateEffectiveLayers, calculateOrderTemplateEffectivePrintMethod, type CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import type { CalculateInput } from '../calculateApi';
import { dartTrim } from '../admin/dartJsonString';
export type CalculateLayerDraft = {
    materialId: string;
    material: string;
    micron: string;
};
export type CalculateProductDraft = {
    id: string;
    itemCode: string;
    product: string;
    width: string;
    count: string;
};
export type CalculateDraft = {
    customerRef: string;
    customer: string;
    itemCode: string;
    product: string;
    multiple: boolean;
    products: CalculateProductDraft[];
    combo: CalculateOrderTemplate['combo'];
    orderType: string;
    options: NonNullable<CalculateOrderTemplate['production_options']>;
    kg: string;
    frame: string;
    count: string;
    edge: string;
    byVal: boolean;
    printVal: string;
    waste: string;
    rolls: string;
    layers: CalculateLayerDraft[];
    note: string;
    color: string;
    templateId: string;
    orderCode: string;
    sourceMapId: string;
    fork: boolean;
    variantId: string;
    imageId: string;
    imageName: string;
    imageMime: string;
    imageUrl: string;
    imageLocalPath: string;
    imageSize: number;
    duplicateLabels: boolean;
    includeBobina: boolean;
    standardSide: boolean | null;
    rememberedSide: boolean | null;
    editingAll: boolean;
};
let productSequence = 0;
export function newCalculateProduct(): CalculateProductDraft { return { id: `p-${nativeEpochMicroseconds()}-${productSequence++}`, itemCode: '', product: '', width: '', count: '' }; }
export function initialCalculateDraft(): CalculateDraft { return { customerRef: '', customer: '', itemCode: '', product: '', multiple: false, products: [], combo: null, orderType: 'Rulon', options: { print_method: 'metal', cold_glue: false, diameter_mm: null }, kg: '', frame: '', count: '', edge: '', byVal: false, printVal: '', waste: '5', rolls: '', layers: [{ materialId: '', material: '', micron: '' }], note: '', color: '', templateId: '', orderCode: '', sourceMapId: '', fork: false, variantId: '', imageId: '', imageName: '', imageMime: '', imageUrl: '', imageLocalPath: '', imageSize: 0, duplicateLabels: false, includeBobina: false, standardSide: null, rememberedSide: null, editingAll: true }; }
export function tryCalculateDouble(raw: string): number | null { const value = dartTrim(raw.replaceAll(',', '.')); if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(value))
    return null; return /^[+-]?NaN$/.test(value) ? NaN : Number(value); }
export function parseCalculateDouble(raw: string): number { const value = tryCalculateDouble(raw); if (value === null)
    throw new SyntaxError('Invalid double'); return value; }
export const optionalCalculateDouble = (raw: string) => dartTrim(raw) ? parseCalculateDouble(raw) : null;
export function calculateInputText(value: number) { return Object.is(value, -0) ? '-0' : Number.isInteger(value) && Math.abs(value) < 1e21 ? value.toFixed(0) : String(value); }
export function applyCalculateTemplate(old: CalculateDraft, template: CalculateOrderTemplate, keepKg = false): CalculateDraft {
    const method = calculateOrderTemplateEffectivePrintMethod(template) === 'flexo' ? 'flexo' : 'metal', products = template.products.map(row => ({ id: row.id, itemCode: row.item_code, product: row.product, width: calculateInputText(row.frame_product_size_mm), count: String(row.frame_count) }));
    return { ...old, templateId: template.id, orderCode: template.code, sourceMapId: template.source_map_id, fork: false, variantId: template.variant_id, customerRef: template.customer_ref, customer: template.customer, itemCode: template.item_code, product: template.product, products, multiple: products.length > 0, combo: template.combo, editingAll: products.length ? true : old.editingAll, orderType: ['rulon', 'paket'].includes(template.status.trim().toLowerCase()) ? template.status.trim() : 'Rulon', options: { print_method: method, cold_glue: template.production_options?.cold_glue ?? false, diameter_mm: template.production_options?.diameter_mm ?? null }, imageId: template.image_id, imageName: template.image_name, imageMime: template.image_mime, imageSize: template.image_size_bytes, imageUrl: template.image_url, imageLocalPath: '', kg: keepKg ? calculateInputText(template.kg) : '', color: template.color, frame: calculateInputText(template.frame_product_size_mm), count: calculateInputText(template.frame_count), edge: method === 'flexo' ? calculateInputText(template.edge_allowance_mm) : '', byVal: template.print_val_size_mm !== null, printVal: template.print_val_size_mm === null ? '' : calculateInputText(template.print_val_size_mm), waste: calculateInputText(template.waste_percent), rolls: template.roll_count === null ? '' : calculateInputText(template.roll_count), layers: (calculateOrderTemplateEffectiveLayers(template).length ? calculateOrderTemplateEffectiveLayers(template) : [{ material_id: '', material: '', micron: '' }]).map(row => ({ materialId: row.material_id, material: row.material, micron: row.micron })), note: template.note, standardSide: null };
}
export function calculateActiveProducts(draft: CalculateDraft) { return draft.multiple ? draft.products.map(row => { const parsed = tryCalculateDouble(row.width), width = parsed !== null && Number.isFinite(parsed) ? parsed : 0, count = /^[+-]?\d+$/.test(dartTrim(row.count)) ? Number(row.count) : 0; return { id: row.id, item_code: row.itemCode, product: row.product.trim(), frame_product_size_mm: width, frame_count: count }; }) : []; }
export const calculateUsefulWidth = (draft: CalculateDraft) => draft.multiple ? calculateActiveProducts(draft).reduce((total, row) => total + row.frame_product_size_mm * row.frame_count, 0) : parseCalculateDouble(draft.frame) * parseCalculateDouble(draft.count);
export const calculateFrameCount = (draft: CalculateDraft) => draft.multiple ? calculateActiveProducts(draft).reduce((total, row) => total + row.frame_count, 0) : parseCalculateDouble(draft.count);
export const calculateEdge = (draft: CalculateDraft) => draft.options.print_method === 'flexo' ? parseCalculateDouble(draft.edge) : 15;
export const calculateItemCode = (draft: CalculateDraft) => draft.multiple ? draft.combo?.item_code ?? draft.products[0]?.itemCode ?? '' : draft.itemCode;
export function calculateOrderName(draft: CalculateDraft, fallback: string) { if (draft.multiple && draft.combo)
    return draft.combo.name; return (draft.multiple ? calculateActiveProducts(draft).map(row => row.product).filter(Boolean).join(' + ') : draft.product.trim()) || fallback; }
/** Source freshness excludes note/color; a combo adds its own separate layout proof. */
export function calculateDraftSignature(draft: CalculateDraft, needsComboIdentity = draft.multiple) { return [String(draft.multiple), ...(needsComboIdentity ? [draft.customerRef.trim(), draft.imageId.trim(), draft.color.trim(), String(draft.options.cold_glue), draft.options.diameter_mm === null ? '' : String(draft.options.diameter_mm)] : []), JSON.stringify(calculateActiveProducts(draft)), draft.product.trim(), draft.kg.trim(), draft.frame.trim(), draft.count.trim(), draft.orderType.trim().toLowerCase(), draft.options.print_method, ...(draft.options.print_method === 'flexo' ? [draft.edge.trim()] : []), String(draft.byVal), ...(draft.byVal ? [draft.printVal.trim()] : []), draft.waste.trim(), draft.rolls.trim(), ...draft.layers.flatMap(row => [row.material.trim(), row.micron.trim()])].join('\u001f'); }
export function buildCalculateTemplate(draft: CalculateDraft, fallback: string, orderNumber = ''): CalculateOrderTemplate {
    const products = calculateActiveProducts(draft), layers = draft.layers.map(row => ({ material_id: row.materialId, material: row.material.trim(), micron: row.micron.trim() })), legacy = (index: number) => layers[index] ?? { material: '', micron: '' }, name = calculateOrderName(draft, fallback);
    return calculateOrderTemplateFromJson({ products, combo: draft.multiple ? draft.combo : null, production_options: draft.options, id: draft.templateId, code: draft.orderCode, name, saved_at: String(nativeEpochMicroseconds()), order_number: orderNumber, customer_ref: draft.customerRef, customer: draft.customer.trim(), item_code: calculateItemCode(draft), product: name, status: draft.orderType.trim(), material_display: '', color: draft.color.trim(), image_id: draft.imageId, image_name: draft.imageName, image_mime: draft.imageMime, image_size_bytes: draft.imageSize, image_url: draft.imageUrl, frame_product_size_mm: draft.multiple ? 0 : parseCalculateDouble(draft.frame), frame_count: calculateFrameCount(draft), print_val_size_mm: draft.byVal ? parseCalculateDouble(draft.printVal) : null, edge_allowance_mm: calculateEdge(draft), width_mm: calculateUsefulWidth(draft) + calculateEdge(draft), waste_percent: parseCalculateDouble(draft.waste), roll_count: optionalCalculateDouble(draft.rolls), layers, first_layer_material: legacy(0).material, first_layer_micron: legacy(0).micron, second_layer_material: legacy(1).material, second_layer_micron: legacy(1).micron, third_layer_material: legacy(2).material, third_layer_micron: legacy(2).micron, note: draft.note.trim(), kg: draft.kg.trim() ? parseCalculateDouble(draft.kg) : 0, source_map_id: draft.sourceMapId, variant_id: draft.variantId });
}
export function calculateRequestForDraft(draft: CalculateDraft, fallback: string): CalculateInput { return { products: calculateActiveProducts(draft), order_number: '', customer: draft.customer, product: calculateOrderName(draft, fallback), status: draft.orderType, material_display: '', color: '', kg: parseCalculateDouble(draft.kg), frame_product_size_mm: draft.multiple ? 0 : parseCalculateDouble(draft.frame), frame_count: calculateFrameCount(draft), edge_allowance_mm: calculateEdge(draft), waste_percent: parseCalculateDouble(draft.waste), roll_count: optionalCalculateDouble(draft.rolls), layers: draft.layers.map(row => ({ material_id: row.materialId, material: row.material.trim(), micron: row.micron.trim() })), note: draft.note }; }
export function calculateNumberError(value: string, { required = false, zero = false, finite = false, integer = false }: {
    required?: boolean;
    zero?: boolean;
    finite?: boolean;
    integer?: boolean;
} = {}): 'required' | 'invalid' | null { if (!value.trim())
    return required ? 'required' : null; const parsed = integer ? /^[+-]?\d+$/.test(value.trim()) ? Number(value) : null : tryCalculateDouble(value); return parsed === null || (zero ? parsed < 0 : parsed <= 0) || (finite && !Number.isFinite(parsed)) ? 'invalid' : null; }
export function calculateProductsError(draft: CalculateDraft): string | null { if (!draft.multiple)
    return null; if (!draft.customerRef)
    return 'calculate.products_customer'; const products = calculateActiveProducts(draft); if (!products.length || calculateFrameCount(draft) > 1024 || !Number.isFinite(calculateUsefulWidth(draft)))
    return 'calculate.products_invalid'; return products.some(row => !row.item_code || !row.product || !Number.isFinite(row.frame_product_size_mm) || row.frame_product_size_mm <= 0 || row.frame_count < 1 || row.frame_count > 1024) ? 'calculate.products_invalid' : null; }

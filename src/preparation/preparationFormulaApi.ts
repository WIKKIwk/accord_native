import type { Session } from '../auth';
import { WorkerControlException } from '../workerControlsApi';
import { preparationFormulaCatalogEntryFromJson, preparationFormulaFromJson, preparationFormulaListFromJson,
  preparationFormulaSetFromJson, preparationFormulaSharesComplete, preparationFormulaVariantFromJson } from './preparationModel';
import { invalidResponse, preparationRequest, withQuery } from './preparationRequest';

const root = '/v1/mobile/preparation';
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
type Scope = { materialId: string; savedOnly?: boolean; variantId?: string; orderId?: string };
const formulaPath = (savedOnly?: boolean) => `${root}/formulas${savedOnly ? '/saved' : ''}`;
function optionalQuery(options: Scope) {
  return { ...(options.variantId ? { variant_id: options.variantId } : {}),
    ...(!options.savedOnly && options.orderId ? { order_id: options.orderId } : {}) };
}
/** @v2 preparationFormulas */
export async function preparationFormulas(session: Session, productCode: string, options: Scope) {
  return (await preparationFormulaDetails(session, productCode, options)).formulas;
}
/** @v2 preparationFormulaDetails */
export async function preparationFormulaDetails(session: Session, productCode: string, options: Scope) {
  const code = productCode.trim(), material = options.materialId.trim();
  if (!code) throw new WorkerControlException('preparation_invalid', 'Mahsulot kodi topilmadi');
  if (!material && !options.savedOnly) throw new WorkerControlException('preparation_invalid', 'Homashyo tanlanmadi');
  const data = await preparationRequest(session, withQuery(formulaPath(options.savedOnly),
    { product_code: code, material_id: material, ...optionalQuery(options) }));
  if (data.variant_name != null && typeof data.variant_name !== 'string') throw new TypeError('Invalid variant name');
  if (data.recipe_key != null && typeof data.recipe_key !== 'string') throw new TypeError('Invalid recipe key');
  return { formulas: preparationFormulaListFromJson(data), variant_name: data.variant_name ?? null, recipe_key: data.recipe_key ?? null };
}
/** @v2 preparationFormulaCatalog */
export async function preparationFormulaCatalog(session: Session, options: { productCode?: string; materialId?: string; orderId?: string } = {}) {
  const query: Record<string, string> = {};
  if (options.productCode?.trim()) query.product_code = options.productCode.trim();
  if (options.materialId?.trim()) query.material_id = options.materialId.trim();
  if (options.orderId?.trim()) query.order_id = options.orderId.trim();
  const data = await preparationRequest(session, withQuery(`${root}/formula-catalog`, query), {}, true);
  if (!Array.isArray(data.formulas)) invalidResponse('Formulalar yuklanmadi');
  return data.formulas.map(preparationFormulaCatalogEntryFromJson);
}
/** @v2 preparationFormulaSets */
export async function preparationFormulaSets(session: Session) {
  const data = await preparationRequest(session, `${root}/formula-sets`, {}, true);
  if (!Array.isArray(data.sets)) throw new TypeError('Invalid formula sets');
  return data.sets.map(preparationFormulaSetFromJson);
}
/** @v2 preparationRenameFormulaSet */
export async function preparationRenameFormulaSet(session: Session, setId: string, name: string) {
  const data = await preparationRequest(session, `${root}/formula-sets`, json('PATCH', { set_id: setId, name: name.trim() }), true);
  if (data.set_id !== setId || typeof data.name !== 'string' || !data.name.trim()) invalidResponse('Komplekt nomi o‘zgargani tasdiqlanmadi. Ro‘yxatni yangilang');
  return data.name as string;
}
/** @v2 preparationUpsertFormula */
export async function preparationUpsertFormula(session: Session, productCode: string, lines: Record<string, string>[], options: Scope & { name?: string | null }) {
  const body = { product_code: productCode.trim(), material_id: options.materialId.trim(),
    ...(options.name == null ? {} : { name: options.name.trim() }), lines };
  return preparationFormulaFromJson(await preparationRequest(session, withQuery(formulaPath(options.savedOnly), optionalQuery(options)),
    json(options.savedOnly ? 'PATCH' : 'POST', body)));
}
/** @v2 preparationDeleteFormula */
export async function preparationDeleteFormula(session: Session, productCode: string, name: string, options: Scope) {
  const data = await preparationRequest(session, withQuery(formulaPath(options.savedOnly),
    { product_code: productCode.trim(), name: name.trim(), material_id: options.materialId.trim(), ...optionalQuery(options) }), { method: 'DELETE' });
  if (options.savedOnly && data.deleted !== true) invalidResponse('Formula o‘chirilgani tasdiqlanmadi. Ro‘yxatni yangilang');
}
/** @v2 preparationUpdateFormulaShares */
export async function preparationUpdateFormulaShares(session: Session, options: Scope & { productCode: string; shares: Record<string, string>[] }) {
  const data = await preparationRequest(session, withQuery(`${formulaPath(options.savedOnly)}/shares`, optionalQuery(options)), json('PATCH',
    { product_code: options.productCode.trim(), material_id: options.materialId.trim(), shares: options.shares }));
  const formulas = preparationFormulaListFromJson(data), expected = new Map(options.shares.map(value => [value.name, value.percent]));
  if (data.product_code !== options.productCode.trim() || data.material_id !== options.materialId.trim() ||
      formulas.length !== options.shares.length || new Set(formulas.map(value => value.name)).size !== expected.size ||
      !preparationFormulaSharesComplete(formulas) || formulas.some(value => value.share_percent !== expected.get(value.name))) {
    invalidResponse('Shnek ulushlari saqlangani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
  return formulas;
}
/** @v2 preparationFormulaVariants */
export async function preparationFormulaVariants(session: Session, options: { productCode: string; materialId: string; savedOnly?: boolean; orderId?: string }) {
  const query = { product_code: options.productCode.trim(), material_id: options.materialId.trim(),
    ...(options.savedOnly ? { saved_only: 'true' } : {}), ...(options.orderId?.trim() ? { order_id: options.orderId.trim() } : {}) };
  const data = await preparationRequest(session, withQuery(`${root}/formula-variants`, query));
  if (!Array.isArray(data.variants)) invalidResponse('Shnek variantlari yuklanmadi');
  return data.variants.map(preparationFormulaVariantFromJson);
}
type VariantWrite = { productCode: string; materialId: string; variantId: string; orderId: string; recipeKey?: string | null; name?: string };
async function writeVariant(session: Session, options: VariantWrite) {
  const query = { product_code: options.productCode.trim(), material_id: options.materialId.trim(), variant_id: options.variantId,
    ...(options.orderId ? { order_id: options.orderId } : {}), ...(options.recipeKey == null ? {} : { recipe_key: options.recipeKey }) };
  const init = options.name == null ? { method: 'POST' } : json('PATCH', { name: options.name });
  const data = await preparationRequest(session, withQuery(`${root}/formula-variants${options.name == null ? '/order' : ''}`, query), init, true);
  if (data.id !== options.variantId || typeof data.name !== 'string' || !data.name || (options.orderId && typeof data.revision_id !== 'number')) {
    invalidResponse('Shnek formulasi saqlangani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
  return preparationFormulaVariantFromJson(data);
}
/** @v2 preparationSelectFormulaVariant */
export function preparationSelectFormulaVariant(session: Session, options: Omit<VariantWrite, 'name'>) { return writeVariant(session, options); }
/** @v2 preparationRenameFormulaVariant */
export function preparationRenameFormulaVariant(session: Session, options: Omit<VariantWrite, 'orderId' | 'recipeKey'> & { name: string; orderId?: string }) {
  return writeVariant(session, { ...options, orderId: options.orderId ?? '' });
}
/** @v2 preparationCreateFormulaVariant */
export async function preparationCreateFormulaVariant(session: Session, options: { productCode: string; materialId: string; name: string; requestId: string }) {
  const data = await preparationRequest(session, `${root}/formula-variants`, json('POST', { product_code: options.productCode.trim(),
    material_id: options.materialId.trim(), name: options.name, request_id: options.requestId }));
  if (typeof data.id !== 'string' || !data.id || data.name !== options.name || data.product_code !== options.productCode.trim() || data.material_id !== options.materialId.trim()) {
    invalidResponse('Shnek varianti saqlangani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
  return preparationFormulaVariantFromJson(data);
}
/** @v2 preparationReuseFormulaVariant */
export async function preparationReuseFormulaVariant(session: Session, options: { productCode: string; materialId: string; sourceVariantId: string; orderId?: string }) {
  const data = await preparationRequest(session, withQuery(`${root}/formula-variants/reuse`, options.orderId?.trim() ? { order_id: options.orderId.trim() } : {}),
    json('POST', { product_code: options.productCode.trim(), material_id: options.materialId.trim(), source_variant_id: options.sourceVariantId.trim() }));
  if (typeof data.id !== 'string' || !data.id || typeof data.name !== 'string' || !data.name.trim() ||
      data.product_code !== options.productCode.trim() || data.material_id !== options.materialId.trim()) {
    invalidResponse('Shnek varianti qo‘shilgani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
  return preparationFormulaVariantFromJson(data);
}
/** @v2 preparationRemoveFormulaVariantFromOrder */
export async function preparationRemoveFormulaVariantFromOrder(session: Session, options: { productCode: string; materialId: string; variantId: string; orderId: string }) {
  const data = await preparationRequest(session, withQuery(`${root}/formula-variants/order`, { order_id: options.orderId.trim(),
    product_code: options.productCode.trim(), material_id: options.materialId.trim(), variant_id: options.variantId.trim() }), { method: 'DELETE' });
  if (data.removed !== true || data.order_id !== options.orderId.trim() || data.variant_id !== options.variantId.trim()) {
    invalidResponse('Shnek varianti olib tashlangani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
}

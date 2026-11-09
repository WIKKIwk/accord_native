import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { qolipCatalogRuntimeFor } from '../shared/qolipCatalogRuntime';
import { jsonObject, optionalInteger, qolipApiResponseError, trimDart } from './qolipApiCommon';

type Product = ReturnType<typeof qolipProductFromJson>;
/** @v2 QolipProductSpecBatchItem */
export type QolipProductSpecBatchItem = { qolipCode: string; size: number; qolipColor?: string };

async function send(session: Session, path: string, method: 'POST' | 'DELETE', body: Record<string, unknown>): Promise<Response> {
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  return authorizedFetch(session, path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function responseData(response: Response): Promise<Record<string, unknown>> {
  const data = jsonObject(await response.json());
  if (!data) throw new TypeError('Expected JSON object');
  return data;
}
function applyCatalogIfCurrent(session: Session, scope: string, data: Record<string, unknown>): void {
  if (activeSessionToken(session) && scope === sessionReadScope(session)) {
    qolipCatalogRuntimeFor(session).applyResponse(data, scope);
  }
}

/** @v2 qolipSaveProductSpec */
export async function qolipSaveProductSpec(session: Session, input: {
  warehouse?: string; product: Product; qolipCode: string; size: number; qolipColor?: string; previousQolipCode?: string | null;
  qolipSetId?: string | null;
}): Promise<Product> {
  const scope = sessionReadScope(session), warehouse = trimDart(input.warehouse ?? ''), previous = trimDart(input.previousQolipCode ?? '');
  const response = await send(session, '/v1/mobile/qolip/product-specs', 'POST', {
    item_code: trimDart(input.product.code), item_name: trimDart(input.product.name), item_group: trimDart(input.product.item_group),
    qolip_code: trimDart(input.qolipCode), warehouse: warehouse || input.product.warehouse,
    color: trimDart(input.qolipColor ?? ''), ...(previous ? { previous_qolip_code: previous } : {}), size: input.size,
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_product_spec_save_failed', 'Qolip tahrirlanmadi');
  const data = await responseData(response);
  applyCatalogIfCurrent(session, scope, data);
  return qolipProductFromJson(data.product);
}

/** @v2 qolipSaveProductSpecsBatch */
export async function qolipSaveProductSpecsBatch(session: Session, input: {
  warehouse?: string; product: Product; specs: QolipProductSpecBatchItem[];
}): Promise<Product[]> {
  const scope = sessionReadScope(session);
  if (!input.specs.length) throw new MobileApiException({ code: 'qolip_code_required', message: 'qolip_code_required' });
  const response = await send(session, '/v1/mobile/qolip/product-specs/batch', 'POST', { specs: input.specs.map(spec => ({
    item_code: trimDart(input.product.code), item_name: trimDart(input.product.name), item_group: trimDart(input.product.item_group),
    qolip_code: trimDart(spec.qolipCode), warehouse: trimDart(input.warehouse ?? ''), color: trimDart(spec.qolipColor ?? ''), size: spec.size,
  })) });
  if (response.status !== 200) throw await qolipApiResponseError(response,
    'qolip_product_specs_batch_save_failed', 'Qoliplar saqlanmadi');
  const data = await responseData(response);
  applyCatalogIfCurrent(session, scope, data);
  return Array.isArray(data.products) ? data.products.map(qolipProductFromJson) : [];
}

/** @v2 qolipDeleteProductSpecs */
export async function qolipDeleteProductSpecs(session: Session, qolipCodes: string[]): Promise<number> {
  const scope = sessionReadScope(session), codes = [...new Set(qolipCodes.map(trimDart).filter(Boolean))];
  if (!codes.length) return 0;
  const response = await send(session, '/v1/mobile/qolip/product-specs', 'DELETE', { qolip_codes: codes });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_delete_failed', 'Qoliplar o‘chirilmadi.');
  const data = await responseData(response);
  applyCatalogIfCurrent(session, scope, data);
  return optionalInteger(data.deleted_count) ?? 0;
}

/** @v2 qolipTransferProducts */
export async function qolipTransferProducts(session: Session, input: {
  requestId: string; fromItemCode: string; toItemCode: string; qolipCodes: string[];
}): Promise<Product[]> {
  const scope = sessionReadScope(session);
  if (session.profile?.role !== 'qolipchi') throw new MobileApiException({ code: 'forbidden', message: 'forbidden' });
  const codes = [...new Set(input.qolipCodes.map(code => trimDart(code).toLowerCase()))].sort();
  const response = await send(session, '/v1/mobile/qolip/product-transfer', 'POST', {
    request_id: input.requestId, from_item_code: trimDart(input.fromItemCode), to_item_code: trimDart(input.toItemCode), qolip_codes: codes,
  });
  if (response.status !== 200) throw await qolipApiResponseError(response,
    'qolip_product_transfer_failed', 'Qoliplarni mahsulotga ko‘chirib bo‘lmadi');
  const data = await responseData(response);
  if (!Array.isArray(data.specs)) throw new TypeError('Invalid transfer response');
  const saved = data.specs.map(value => {
    const spec = jsonObject(value);
    if (!spec) throw new TypeError('Invalid transfer product');
    return qolipProductFromJson({ ...spec, code: spec.item_code, name: spec.item_name, has_qolip_spec: true });
  });
  const returnedCodes = new Set(saved.map(product => trimDart(product.qolip_code).toLowerCase()));
  if (returnedCodes.size !== codes.length || codes.some(code => !returnedCodes.has(code)) ||
      saved.some(product => trimDart(product.code).toLowerCase() !== trimDart(input.toItemCode).toLowerCase())) {
    throw new MobileApiException({ code: 'qolip_product_transfer_failed', message: 'Incomplete transfer response' });
  }
  applyCatalogIfCurrent(session, scope, data);
  return saved;
}

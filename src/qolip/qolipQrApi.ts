import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { qolipProducts } from '../qolipProductsApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartQuery, jsonObject, optionalInteger, optionalText, qolipApiResponseError, trimDart } from './qolipApiCommon';
import { qolipLocationFromJson, type QolipLocationEntry } from './qolipLocationsApi';

/** @v2 QolipCellQr */
export type QolipCellQr = { id: string; block: string; warehouse: string; row_letter: string;
  column_number: number; location_label: string; qr_payload: string };
type Product = ReturnType<typeof qolipProductFromJson>;
/** @v2 QolipScanResult */
export type QolipScanResult =
  | { kind: 'cell'; cell_qr: QolipCellQr; product: null; location: null }
  | { kind: 'qolip'; cell_qr: null; product: Product; location: QolipLocationEntry | null };

export function qolipCellQrFromJson(value: unknown): QolipCellQr {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip cell QR');
  return { id: optionalText(row.id), block: optionalText(row.block), warehouse: optionalText(row.warehouse),
    row_letter: optionalText(row.row_letter), column_number: optionalInteger(row.column_number) ?? 0,
    location_label: optionalText(row.location_label), qr_payload: optionalText(row.qr_payload) };
}

export function qolipScanResultFromJson(value: unknown): QolipScanResult {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip scan result');
  if (trimDart(optionalText(row.kind)).toLowerCase() === 'cell') {
    return { kind: 'cell', cell_qr: qolipCellQrFromJson(row.cell_qr), product: null, location: null };
  }
  return { kind: 'qolip', cell_qr: null, product: qolipProductFromJson(row.product),
    location: jsonObject(row.location) ? qolipLocationFromJson(row.location) : null };
}

async function cellQrError(response: Response): Promise<MobileApiException> {
  let code = 'qolip_cell_qr_lookup_failed', message = 'Yachayka QR tekshirishda xatolik.';
  try {
    const data = jsonObject(await response.json());
    if (data) {
      code = optionalText(data.error ?? data.code ?? code);
      const serverMessage = trimDart(optionalText(data.message));
      if (serverMessage) message = serverMessage;
      else if (code === 'cell_qr_not_found') message = 'Bu QR yachayka uchun topilmadi.';
      else if (code === 'qr_required') message = 'Yachayka QR bo‘sh.';
    }
  } catch { /* V2 retains its default when the server body is not valid JSON. */ }
  return new MobileApiException({ code, message, statusCode: response.status });
}

async function get(session: Session, path: string): Promise<Response> {
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  return authorizedFetch(session, path);
}

/** @v2 qolipCellQrLookup */
export async function qolipCellQrLookup(session: Session, qrPayload: string): Promise<QolipCellQr> {
  const qr = trimDart(qrPayload);
  if (!qr) throw new MobileApiException({ code: 'qolip_cell_qr_required', message: 'Yachayka QR bo‘sh.' });
  const query = dartQuery({ qr });
  const response = await get(session, `/v1/mobile/qolip/cell-qr?${query}`);
  if (response.status !== 200) throw await cellQrError(response);
  const data = jsonObject(await response.json());
  return qolipCellQrFromJson(data?.cell_qr);
}

/** @v2 qolipScanQr */
export async function qolipScanQr(session: Session, qrPayload: string): Promise<QolipScanResult> {
  const qr = trimDart(qrPayload);
  if (!qr) throw new MobileApiException({ code: 'qolip_qr_required', message: 'QR bo‘sh.' });
  const query = dartQuery({ qr });
  const response = await get(session, `/v1/mobile/qolip/scan?${query}`);
  if (response.status !== 200) throw await qolipApiResponseError(response,
    'qolip_scan_failed', 'QR bo‘yicha qolip yoki yacheyka topilmadi.');
  return qolipScanResultFromJson(await response.json());
}

/** @v2 qolipProductByQr */
export async function qolipProductByQr(session: Session, qrPayload: string): Promise<Product> {
  const code = trimDart(qrPayload);
  if (!code) throw new MobileApiException({ code: 'qolip_code_required', message: 'Qolip QR bo‘sh.' });
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  const products = await qolipProducts(session, { query: code, limit: 20, with_qolip_only: true });
  for (const product of products) if (trimDart(product.qolip_code).toLowerCase() === code.toLowerCase()) return product;
  throw new MobileApiException({ code: 'qolip_code_not_found', message: 'Qolip QR topilmadi.' });
}

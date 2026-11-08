import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { qolipProductFromJson } from '../qolipCatalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { jsonObject, optionalText, qolipApiResponseError, trimDart } from './qolipApiCommon';
import type { QolipBlock } from './qolipBlocksApi';

/** @v2 QolipLocationEntry */
export type QolipLocationEntry = {
  id: string; block: string; warehouse: string; item_code: string; item_name: string; qolip_code: string;
  size: number; quantity: number; row_letter: string; column_number: number | null; location_label: string;
};

function optionalInteger(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected number');
  return Math.trunc(value);
}

export function qolipLocationFromJson(value: unknown): QolipLocationEntry {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip location');
  return { id: optionalText(row.id), block: optionalText(row.block), warehouse: optionalText(row.warehouse),
    item_code: optionalText(row.item_code), item_name: optionalText(row.item_name), qolip_code: optionalText(row.qolip_code),
    size: optionalInteger(row.size) ?? 0, quantity: optionalInteger(row.quantity) ?? 0, row_letter: optionalText(row.row_letter),
    column_number: optionalInteger(row.column_number), location_label: optionalText(row.location_label) };
}

async function send(session: Session, path: string, body?: Record<string, unknown>): Promise<Response> {
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  return authorizedFetch(session, path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

/** @v2 qolipLocations */
export async function qolipLocations(session: Session, block: string): Promise<QolipLocationEntry[]> {
  const query = new URLSearchParams({ block: trimDart(block) });
  const response = await send(session, `/v1/mobile/qolip/locations?${query}`);
  if (response.status !== 200) throw new Error('Qolip locations failed');
  const data = jsonObject(await response.json());
  if (!data) throw new TypeError('Invalid Qolip locations');
  return Array.isArray(data.locations) ? data.locations.map(qolipLocationFromJson) : [];
}

type Product = ReturnType<typeof qolipProductFromJson>;
/** @v2 qolipSaveLocation */
export async function qolipSaveLocation(session: Session, input: {
  block: QolipBlock; product?: Product | null; qolipCode?: string; size?: number; quantity: number;
  rowLetter?: string; columnNumber?: number | null;
}): Promise<QolipLocationEntry> {
  const code = trimDart(input.qolipCode ?? '') || trimDart(input.product?.qolip_code ?? '');
  const size = (input.size ?? 0) > 0 ? input.size! : input.product?.size ?? 0;
  const row = trimDart(input.rowLetter ?? '');
  const payload = { block: trimDart(input.block.name), warehouse: trimDart(input.block.warehouse),
    ...(input.product ? { item_code: trimDart(input.product.code), item_name: trimDart(input.product.name) } : {}),
    ...(code ? { qolip_code: code } : {}), ...(size > 0 ? { size } : {}), quantity: input.quantity,
    ...(row ? { row_letter: row } : {}), ...(input.columnNumber != null ? { column_number: input.columnNumber } : {}) };
  const response = await send(session, '/v1/mobile/qolip/locations', payload);
  if (response.status !== 200) throw new Error('Qolip location save failed');
  const data = jsonObject(await response.json());
  return qolipLocationFromJson(data?.location);
}

function moveBody(locationId: string, targetBlock: QolipBlock, quantity: number, rowLetter: string, columnNumber: number) {
  return { location_id: trimDart(locationId), block: trimDart(targetBlock.name), warehouse: trimDart(targetBlock.warehouse),
    quantity, row_letter: trimDart(rowLetter).toUpperCase(), column_number: columnNumber };
}

/** @v2 qolipMoveLocation */
export async function qolipMoveLocation(session: Session, input: {
  locationId: string; targetBlock: QolipBlock; quantity: number; rowLetter: string; columnNumber: number;
}): Promise<QolipLocationEntry> {
  const response = await send(session, '/v1/mobile/qolip/locations/move',
    moveBody(input.locationId, input.targetBlock, input.quantity, input.rowLetter, input.columnNumber));
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_location_move_failed', 'Ko‘chirish amalga oshmadi.');
  const data = jsonObject(await response.json());
  return qolipLocationFromJson(data?.location);
}

/** @v2 qolipMoveLocations */
export async function qolipMoveLocations(session: Session, input: {
  locations: QolipLocationEntry[]; targetBlock: QolipBlock; rowLetter: string; columnNumber: number;
}): Promise<QolipLocationEntry[]> {
  const ids = new Set<string>();
  for (const location of input.locations) {
    const id = trimDart(location.id);
    if (!id || ids.has(id)) throw new MobileApiException({ code: 'location_invalid', message: 'location_invalid' });
    ids.add(id);
  }
  if (!input.locations.length) throw new MobileApiException({ code: 'location_invalid', message: 'location_invalid' });
  const response = await send(session, '/v1/mobile/qolip/locations/move-batch', {
    moves: input.locations.map(location => moveBody(location.id, input.targetBlock, location.quantity, input.rowLetter, input.columnNumber)),
  });
  if (response.status !== 200) throw await qolipApiResponseError(response,
    'qolip_location_move_batch_failed', 'Tanlangan qoliplar ko‘chirilmay qoldi.');
  const data = jsonObject(await response.json()), locations = data?.locations;
  if (!Array.isArray(locations) || locations.length !== input.locations.length) {
    throw new MobileApiException({ code: 'qolip_location_move_batch_invalid_response',
      message: 'Tanlangan qoliplar ko‘chirish javobi noto‘g‘ri.' });
  }
  return locations.map(qolipLocationFromJson);
}

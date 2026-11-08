import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { assertQolipReadCurrent, dartString, jsonObject, optionalText, qolipApiResponseError, trimDart, type QolipReadGuard } from './qolipApiCommon';

/** @v2 QolipBlock */
export type QolipBlock = { name: string; warehouse: string };
/** @v2 QolipBlocksResult */
export type QolipBlocksResult = { warehouses: string[]; blocks: QolipBlock[]; supports_cross_block_move: boolean };

export function qolipBlockFromJson(value: unknown): QolipBlock {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip block');
  return { name: optionalText(row.name), warehouse: optionalText(row.warehouse) };
}

export function qolipBlocksResultFromJson(value: unknown): QolipBlocksResult {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip blocks');
  return {
    warehouses: Array.isArray(row.warehouses) ? row.warehouses.map(dartString) : [],
    blocks: Array.isArray(row.blocks) ? row.blocks.map(qolipBlockFromJson) : [],
    supports_cross_block_move: row.supports_cross_block_move === true,
  };
}

async function send(session: Session, init: RequestInit = {}, guard?: QolipReadGuard): Promise<Response> {
  assertQolipReadCurrent(guard);
  // V2 checks test mode before the request. Its in-memory branch is deferred.
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  const beforeSend = () => {
    assertQolipReadCurrent(guard);
    if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  };
  return guard === undefined ? authorizedFetch(session, '/v1/mobile/qolip/blocks', init)
    : authorizedFetch(session, '/v1/mobile/qolip/blocks', init, beforeSend);
}

function jsonBody(method: 'POST' | 'PUT' | 'DELETE', body: Record<string, string>): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** @v2 qolipBlocksData */
export async function qolipBlocksData(session: Session, guard?: QolipReadGuard): Promise<QolipBlocksResult> {
  const response = await send(session, {}, guard);
  assertQolipReadCurrent(guard);
  if (response.status !== 200) throw new Error('Qolip blocks failed');
  const data: unknown = await response.json();
  assertQolipReadCurrent(guard);
  const result = qolipBlocksResultFromJson(data);
  assertQolipReadCurrent(guard);
  return result;
}

/** @v2 qolipBlocks */
export async function qolipBlocks(session: Session, guard?: QolipReadGuard): Promise<QolipBlock[]> {
  return (await qolipBlocksData(session, guard)).blocks;
}

/** @v2 qolipCreateBlock */
export async function qolipCreateBlock(session: Session, input: { warehouse: string; block: string }): Promise<QolipBlock> {
  const response = await send(session, jsonBody('POST', { warehouse: trimDart(input.warehouse), block: trimDart(input.block) }));
  if (response.status !== 200) throw new Error('Qolip block create failed');
  const data = jsonObject(await response.json());
  return qolipBlockFromJson(data?.block);
}

/** @v2 qolipUpdateBlock */
export async function qolipUpdateBlock(session: Session, block: QolipBlock, newName: string): Promise<QolipBlock> {
  const name = trimDart(newName);
  if (!name) throw new MobileApiException({ code: 'block_required', message: 'block_required' });
  const response = await send(session, jsonBody('PUT', {
    warehouse: trimDart(block.warehouse), block: trimDart(block.name), new_block: name,
  }));
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_block_update_failed', 'Blok tahrirlanmadi.');
  const data = jsonObject(await response.json());
  return qolipBlockFromJson(data?.block);
}

/** @v2 qolipDeleteBlock */
export async function qolipDeleteBlock(session: Session, block: QolipBlock): Promise<void> {
  const response = await send(session, jsonBody('DELETE', { warehouse: trimDart(block.warehouse), block: trimDart(block.name) }));
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_block_delete_failed', 'Blok o‘chirilmadi.');
}

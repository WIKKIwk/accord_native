import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { assertQolipReadCurrent, dartString, jsonObject, optionalText, type QolipReadGuard } from './qolipApiCommon';

export type QolipBlock = { name: string; warehouse: string };
export type QolipBlocksResult = { warehouses: string[]; blocks: QolipBlock[]; supports_cross_block_move: boolean };
function blockFromJson(value: unknown): QolipBlock {
  const row = jsonObject(value); if (!row) throw new TypeError('Invalid Qolip block');
  return { name: optionalText(row.name), warehouse: optionalText(row.warehouse) };
}
/** Initial read only. The required guard is checked before initial/401-retry sends and results. */
export async function qolipBlocksData(session: Session, guard: QolipReadGuard): Promise<QolipBlocksResult> {
  try {
    assertQolipReadCurrent(guard); await Promise.resolve();
    const beforeSend = () => {
      assertQolipReadCurrent(guard);
      if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
    };
    const response = await authorizedFetch(session, '/v1/mobile/qolip/blocks', {}, beforeSend);
    assertQolipReadCurrent(guard); const status = response.status; assertQolipReadCurrent(guard);
    if (status !== 200) throw new Error('Qolip blocks failed');
    const data = jsonObject(await response.json()); assertQolipReadCurrent(guard);
    if (!data) throw new TypeError('Invalid Qolip blocks');
    const warehouses = data.warehouses, blocks = data.blocks, cross = data.supports_cross_block_move;
    assertQolipReadCurrent(guard);
    const result = { warehouses: Array.isArray(warehouses) ? warehouses.map(dartString) : [],
      blocks: Array.isArray(blocks) ? blocks.map(blockFromJson) : [], supports_cross_block_move: cross === true };
    assertQolipReadCurrent(guard); return result;
  } catch (error) { assertQolipReadCurrent(guard); throw error; }
}

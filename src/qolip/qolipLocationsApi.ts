import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { assertQolipReadCurrent, dartQuery, jsonObject, optionalInteger, optionalText, trimDart, type QolipReadGuard } from './qolipApiCommon';

export type QolipLocationEntry = { id: string; block: string; warehouse: string; item_code: string; item_name: string;
  qolip_code: string; size: number; quantity: number; row_letter: string; column_number: number | null; location_label: string };
function locationFromJson(value: unknown): QolipLocationEntry {
  const row = jsonObject(value); if (!row) throw new TypeError('Invalid Qolip location');
  return { id: optionalText(row.id), block: optionalText(row.block), warehouse: optionalText(row.warehouse),
    item_code: optionalText(row.item_code), item_name: optionalText(row.item_name), qolip_code: optionalText(row.qolip_code),
    size: optionalInteger(row.size) ?? 0, quantity: optionalInteger(row.quantity) ?? 0, row_letter: optionalText(row.row_letter),
    column_number: optionalInteger(row.column_number), location_label: optionalText(row.location_label) };
}
/** Initial/search read only. The required guard is checked before initial/401-retry sends and results. */
export async function qolipLocations(session: Session, block: string, guard: QolipReadGuard): Promise<QolipLocationEntry[]> {
  try {
    assertQolipReadCurrent(guard); const query = dartQuery({ block: trimDart(block) }); await Promise.resolve();
    const beforeSend = () => {
      assertQolipReadCurrent(guard);
      if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
    };
    const response = await authorizedFetch(session, `/v1/mobile/qolip/locations?${query}`, {}, beforeSend, undefined, { readWitness: guard });
    assertQolipReadCurrent(guard); const status = response.status; assertQolipReadCurrent(guard);
    if (status !== 200) throw new Error('Qolip locations failed');
    const data = jsonObject(await response.json()); assertQolipReadCurrent(guard);
    if (!data) throw new TypeError('Invalid Qolip locations');
    const rows = data.locations; assertQolipReadCurrent(guard);
    const result = Array.isArray(rows) ? rows.map(locationFromJson) : [];
    assertQolipReadCurrent(guard); return result;
  } catch (error) { assertQolipReadCurrent(guard); throw error; }
}

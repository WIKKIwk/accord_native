import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { productionMapResponseError } from './workerControlsApi';
import { comboFromJson } from './workerProductionMapSaved';
import { calculateOrderTemplateFromJson } from './workerOpenedOrderEditApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminProductionCombo */
export async function adminProductionCombo(session: Session, itemCode: string) {
  const scope = sessionReadScope(session);
  const checkScope = () => {
    if (!activeSessionToken(session) || sessionReadScope(session) !== scope) throw new Error('Combo account changed');
  };
  checkScope();
  const query = new URLSearchParams({ item_code: itemCode });
  const response = await authorizedFetch(session, `/v1/mobile/admin/combos?${query}`, {}, checkScope);
  checkScope();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'combo_load_failed');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Incomplete combo catalog response');
  const combo = comboFromJson(payload.combo);
  if (!combo || combo.item_code !== itemCode || !object(payload.template)) throw new TypeError('Incomplete combo catalog response');
  return { combo, template: { ...calculateOrderTemplateFromJson(payload.template), combo } };
}

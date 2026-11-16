import type { Session } from '../auth';
import { calculateOrderTemplateFromJson } from '../workerOpenedOrderEditApi';
import { comboFromJson } from '../workerProductionMapSaved';
import { adminItemDetail } from './adminItemDetailApi';
import { adminProductionRequest, checkedAdminGuard } from './adminProductionRequest';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';

export type AdminItemDetailCombo = Readonly<{ combo: NonNullable<ReturnType<typeof comboFromJson>>; template: ReturnType<typeof calculateOrderTemplateFromJson> }>;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const requiredGuard = (guard: () => void) => {
  const check = checkedAdminGuard(guard); if (!check) throw new TypeError('Item combo read requires its original guard'); return check;
};
export const canReadAdminItemDetailCombo = (session: Pick<Session, 'capabilities'>): boolean =>
  ['admin.access', 'production.map.manage', 'qolip.manage'].some(code => session.capabilities.includes(code));

/** @v2 adminProductionCombo; canonical template/products/combo decoders are shared, legacy callers remain unchanged. */
export async function adminItemDetailCombo(session: Session, itemCode: string, guard: () => void, witness: () => boolean): Promise<AdminItemDetailCombo> {
  const check = requiredGuard(guard); if (typeof witness !== 'function') throw new TypeError('Item combo read requires its original witness'); check();
  const value = await adminProductionRequest(session, `/v1/mobile/admin/combos?item_code=${dartQueryComponent(itemCode)}`, undefined, 'combo_load_failed', check, witness); check();
  try {
    if (!object(value)) throw new TypeError('Incomplete combo catalog response'); const combo = comboFromJson(value.combo);
    if (!combo || combo.item_code !== itemCode || !object(value.template)) throw new TypeError('Incomplete combo catalog response');
    const template = calculateOrderTemplateFromJson(value.template);
    return Object.freeze({ combo, template: { ...template, combo } });
  } finally { check(); }
}

/** @v2 _ComboItemProductRowState._loadName; unavailable/equal-code names resolve to source unnamed state, never a fake SKU name. */
export async function adminItemDetailComboProductName(session: Session, itemCode: string, guard: () => void, witness: () => boolean): Promise<string | null> {
  const check = requiredGuard(guard); if (typeof witness !== 'function') throw new TypeError('Item product-name read requires its original witness'); check();
  const code = dartTrim(itemCode); if (!code) return null;
  try {
    const detail = await adminItemDetail(session, code, {}, check, witness); check(); const name = dartTrim(detail.name);
    check(); return !name || dartPartialLower(name) === dartPartialLower(code) ? null : name;
  } catch { check(); return null; }
}

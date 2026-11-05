import type { Session } from './auth';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { completeQolips } from './workerScanBootstrap';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value).trim();
const invalid = () => new WorkerControlException('qolip_automatic_confirmation_invalid', 'Qoliplarni avtomatik tasdiqlash ma’lumoti tasdiqlanmadi');

export function parseQolipRequirements(raw: unknown, automaticRequested: boolean): Obj {
  const payload = object(raw);
  if (!payload) throw new TypeError('Invalid qolip validation response');
  const qolip = object(payload.qolip);
  if (!qolip) {
    if (automaticRequested) throw invalid();
    return { qolip_code: '', required_qolips: [], required_qolip_codes: [], required_qolip_count: 0,
      automatic_confirmation_enabled: false, policy_revision: 0, blocking_reason_code: '', sets: [], reused_qolip_codes: [] };
  }
  if (qolip.automatic_confirmation_enabled != null && typeof qolip.automatic_confirmation_enabled !== 'boolean') throw invalid();
  const automatic = qolip.automatic_confirmation_enabled === true;
  // The standalone decoder trims each mold code before comparing it to the
  // server's code list; the aggregate section has a stricter raw comparison.
  const normalizedForValidation = { ...payload, qolip: { ...qolip,
    required_qolips: Array.isArray(qolip.required_qolips) ? qolip.required_qolips.map((entry: unknown) => {
      const mold = object(entry);
      return mold && typeof mold.qolip_code === 'string' ? { ...mold, qolip_code: mold.qolip_code.trim() } : entry;
    }) : qolip.required_qolips,
  } };
  if ((qolip.policy_revision != null && (!Number.isInteger(qolip.policy_revision) || qolip.policy_revision < 0)) ||
      (automatic && (!automaticRequested || payload.ok !== true || !completeQolips(normalizedForValidation, {
        qolip_automatic_confirmation: true, qolip_policy_revision: qolip.policy_revision,
      })))) throw invalid();
  if (qolip.required_qolips != null && !Array.isArray(qolip.required_qolips)) throw new TypeError('Invalid qolip requirements');
  const required = (qolip.required_qolips ?? []).flatMap((rawMold: unknown) => {
    const mold = object(rawMold);
    if (!mold) return [];
    const code = text(mold.qolip_code);
    return code ? [{ qolip_code: code, color: text(mold.color), in_use: mold.in_use === true,
      qolip_set_id: text(mold.qolip_set_id), is_extension: mold.is_extension === true,
      ready: mold.ready === true, blocking_reason_code: text(mold.blocking_reason_code) }] : [];
  });
  const reused = qolip.reused_qolip_codes;
  if (reused != null && (!Array.isArray(reused) || reused.some((item: unknown) => typeof item !== 'string' || !item.trim()))) throw invalid();
  const reusedCodes = (reused ?? []).map((item: string) => item.trim());
  if (reusedCodes.length) {
    const used = new Set(reusedCodes.map((item: string) => item.toLowerCase()));
    const requiredCodes = new Set(required.map((item: Obj) => item.qolip_code.toLowerCase()));
    if (used.size !== reusedCodes.length || used.size !== requiredCodes.size || [...used].some(item => !requiredCodes.has(item))) throw invalid();
  }
  return { qolip_code: text(qolip.qolip_code), required_qolips: required,
    required_qolip_codes: required.map((item: Obj) => item.qolip_code), required_qolip_count: required.length,
    automatic_confirmation_enabled: automatic, policy_revision: qolip.policy_revision ?? 0,
    blocking_reason_code: text(qolip.blocking_reason_code), sets: automatic ? qolip.sets : [], reused_qolip_codes: reusedCodes };
}

/** @v2 adminProductionMapQolipRequirements */
export async function adminProductionMapQolipRequirements(session: Session, apparatus: string, orderId: string,
  automaticConfirmation = false): Promise<Obj> {
  const station = apparatus.trim();
  if (!isCanonicalApparatusId(station)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const response = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/qolip-validate', {
    apparatus: station, order_id: orderId.trim(), qolip_code: '', ...(automaticConfirmation ? { automatic_confirmation: true } : {}),
  }, null, false, 'qolip_code_not_found');
  return parseQolipRequirements(response, automaticConfirmation);
}

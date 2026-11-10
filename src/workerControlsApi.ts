import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';

type JsonObject = Record<string, unknown>;

export class WorkerControlException extends Error {
  constructor(readonly code: string, message: string, readonly statusCode?: number,
    readonly diagnostics: JsonObject = {}, readonly requestId?: string) {
    super(message);
    this.name = 'MobileApiException';
  }
  get orderTitle(): string { return typeof this.diagnostics.order_title === 'string' ? this.diagnostics.order_title : ''; }
}

const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
const hexToken = (value: string) => /^[a-fA-F0-9]{64}$/.test(value);
const operator = (role: unknown) => role === 'aparatchi' || role === 'rezka_master';

/** @v2 isCanonicalApparatusId */
export function isCanonicalApparatusId(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || normalized !== normalized.toLowerCase() || /\s/.test(normalized)) return false;
  const parts = normalized.split(':');
  return parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
}

function requireApparatus(value: string): string {
  if (!isCanonicalApparatusId(value)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return value.trim();
}

/** @v2 AdminTemporaryPauseControl */
export type AdminTemporaryPauseControl = { session_id: string; token: string };
export function temporaryPauseControl(raw: unknown): AdminTemporaryPauseControl | null {
  const value = object(raw);
  if (typeof value?.session_id !== 'string' || typeof value.token !== 'string') return null;
  const id = value.session_id;
  if (!id.trim() || id !== id.trim() || id.length > 512 || !hexToken(value.token)) return null;
  return { session_id: id, token: value.token };
}

/** @v2 AdminCancelStartControl */
export type AdminCancelStartControl = AdminTemporaryPauseControl & { worker_ref: string; previous_state: 'pending' | 'completed' };
export function cancelStartControl(raw: unknown): AdminCancelStartControl | null {
  const value = object(raw);
  const base = temporaryPauseControl(raw);
  if (!base || typeof value?.worker_ref !== 'string' || !value.worker_ref || value.worker_ref !== value.worker_ref.trim() ||
      value.worker_ref.length > 512 || (value.previous_state !== 'pending' && value.previous_state !== 'completed')) return null;
  return { ...base, worker_ref: value.worker_ref, previous_state: value.previous_state };
}

/** @v2 AdminResumePauseControl */
export type AdminResumePauseControl = { resume_id: string; worker_role: 'aparatchi' | 'rezka_master'; worker_ref: string };
export function resumePauseControl(raw: unknown): AdminResumePauseControl | null {
  const value = object(raw);
  if (typeof value?.resume_id !== 'string' || typeof value.worker_ref !== 'string' ||
      (value.worker_role !== 'aparatchi' && value.worker_role !== 'rezka_master')) return null;
  const id = value.resume_id.trim(), ref = value.worker_ref.trim();
  return id && id.length <= 512 && ref ? { resume_id: id, worker_role: value.worker_role, worker_ref: ref } : null;
}

/** @v2 AdminReactivationRecloseControl */
export type AdminReactivationRecloseControl = { session_id: string; stage_node_id: string; token: string;
  worker_role: 'aparatchi' | 'rezka_master'; worker_ref: string; readScope: string };
export function reactivationRecloseControl(raw: unknown, session: Session, preserveReadScope = true): AdminReactivationRecloseControl | null {
  const value = object(raw);
  if (!value || (value.worker_role !== 'aparatchi' && value.worker_role !== 'rezka_master') ||
      typeof value.session_id !== 'string' || typeof value.stage_node_id !== 'string' ||
      typeof value.token !== 'string' || typeof value.worker_ref !== 'string' ||
      !value.session_id.trim() || !value.stage_node_id.trim() || !value.token.trim() || !value.worker_ref.trim() ||
      !/^[a-f0-9]{64}$/.test(value.token) || value.session_id.length > 4096 || value.stage_node_id.length > 512) return null;
  return { session_id: value.session_id, stage_node_id: value.stage_node_id, token: value.token,
    worker_role: value.worker_role, worker_ref: value.worker_ref,
    readScope: preserveReadScope && typeof value.readScope === 'string' ? value.readScope : sessionReadScope(session) };
}

const denied = () => new WorkerControlException('queue_action_not_allowed', '');
const scopeChanged = () => new WorkerControlException('session_scope_changed', '');
const belongsTo = (control: AdminReactivationRecloseControl, session: Session) =>
  control.readScope === sessionReadScope(session) && operator(session.profile?.role) &&
  control.worker_role === session.profile?.role && control.worker_ref === session.profile?.ref;

export function productionMapResponseError(status: number, payload: unknown, fallback: string): WorkerControlException {
  const data = object(payload);
  const code = typeof data?.error === 'string' && data.error.trim() ? data.error.trim() : fallback;
  const operation = fallback === 'queue_action_not_allowed' ? 'Order navbat amali bajarilmadi' : 'So‘ralgan amal bajarilmadi';
  const advice = status >= 500 ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.'
    : '. Oynani yangilang va qayta urinib ko‘ring.';
  const known: Record<string, string> = {
    print_preflight_active: 'Buyurtmaning rang sinovi rezervi faol. Hozir bu amalni bajarib bo‘lmaydi.',
    print_preflight_not_found: 'Rang chiqarish sinovi topilmadi. Oynani yangilang va qayta urinib ko‘ring.',
    print_preflight_not_ready: 'Rang chiqarish natijasi hali tayyor emas. Avval “Rang chiqdi” yoki “Chiqmadi” tugmasini bosing.',
    print_preflight_action_not_allowed: 'Rang chiqarish uchun bu amal hozir mumkin emas. Oynani yangilang va qayta urinib ko‘ring.',
    print_preflight_requires_print_apparatus: 'Rang chiqarish faqat bosma apparatida ishlaydi.',
    print_preflight_action_invalid: 'Rang chiqarish amali noto‘g‘ri. Oynani yangilang va qayta urinib ko‘ring.',
    progress_batch_not_accepted: 'Bu QR oldingi bosqich mahsulotiga mos emas',
    wip_route_source_unresolved: 'WIP chiqarilgan bosqich xaritada aniqlanmadi. Admin xaritadagi yo‘nalishni tekshirsin; shu QR saqlanadi.',
    wip_route_destination_unresolved: 'WIP uchun keyingi bosqich xaritada aniqlanmadi. Admin yo‘nalishni tekshirsin; shu QR saqlanadi.',
    wip_route_ambiguous: 'WIP yo‘nalishini bir ma’noda aniqlab bo‘lmadi. Admin xaritadagi bosqichlarni tekshirsin; shu QR saqlanadi.',
    wip_route_changed: 'Ishlab chiqarish xaritasi yangilandi. Oynani yangilang va shu QRni qayta skanerlang.',
  };
  const apparatusName = data?.apparatus_name == null ? '' : String(data.apparatus_name).trim();
  if (code.toLowerCase() === 'progress_batch_already_used') return new WorkerControlException(code,
    `Bu rulon ${apparatusName ? `${apparatusName} apparatida ` : ''}allaqachon ishlatilgan. Qayta ish boshlash uchun ishlatilmagan rulon QR sini skanerlang.`, status, data ?? {});
  if (code.toLowerCase() === 'progress_batch_in_use') return new WorkerControlException(code,
    `Bu rulon hozir ${apparatusName ? `${apparatusName} apparatida ` : ''}ishlatilmoqda. Uni qayta ishga olib bo‘lmaydi.`, status, data ?? {});
  const message = code.toLowerCase() === 'queue_action_not_allowed'
    ? 'Faqat navbatdagi zakazni boshlash yoki tugatish mumkin' : code.toLowerCase() === 'order_not_started'
      ? 'Boshlanmagan buyurtmani muzlatib bo‘lmaydi'
      : known[code.toLowerCase()] ?? (code.toLowerCase() === fallback.toLowerCase() ? `${operation}${advice}`
        : `${operation}. Server xato kodi: ${code} (HTTP ${status})${advice}`);
  return new WorkerControlException(code, message, status, data ?? {});
}

export async function postWorkerApiRequest(session: Session, path: string, body: JsonObject, scope: string | null,
  checkAfter: boolean, fallback: string, extraGuard?: () => boolean, contentType = 'application/json'): Promise<unknown> {
  const guard = () => {
    if ((scope !== null && scope !== sessionReadScope(session)) || (extraGuard && !extraGuard())) throw scopeChanged();
  };
  // V2 checks test-mode storage asynchronously before sending the command.
  await Promise.resolve();
  guard();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, path, {
      method: 'POST', headers: { 'Content-Type': contentType },
      body: JSON.stringify(body), signal: controller.signal,
    }, guard);
    if (checkAfter) guard();
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      if (checkAfter) guard();
      throw productionMapResponseError(response.status, payload, fallback);
    }
    const data: unknown = await response.json();
    if (checkAfter) guard();
    return data;
  } finally { clearTimeout(timer); }
}

async function postControl(session: Session, path: string, body: JsonObject, scope: string,
  checkAfter: boolean, extraGuard?: () => boolean): Promise<void> {
  const data = object(await postWorkerApiRequest(session, path, body, scope, checkAfter, 'queue_action_not_allowed', extraGuard));
  if (data?.ok !== true) throw denied();
}

/** @v2 adminTemporarilyPauseWork */
export async function adminTemporarilyPauseWork(session: Session, apparatus: string, orderId: string,
  control: AdminTemporaryPauseControl, current?: () => boolean): Promise<void> {
  const scope = sessionReadScope(session), machine = requireApparatus(apparatus), order = orderId.trim();
  if (!order || order.startsWith('training-') || !temporaryPauseControl(control)) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/temporary-pause',
    { apparatus: machine, order_id: order, session_id: control.session_id, token: control.token }, scope, true, current);
}

/** @v2 adminCancelStartedWork */
export async function adminCancelStartedWork(session: Session, apparatus: string, orderId: string,
  control: AdminCancelStartControl): Promise<void> {
  const scope = sessionReadScope(session), machine = requireApparatus(apparatus), order = orderId.trim();
  if (!order || order.startsWith('training-') || !operator(session.profile?.role) ||
      session.profile?.ref !== control.worker_ref || !cancelStartControl(control)) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/cancel-start',
    { apparatus: machine, order_id: order, session_id: control.session_id, token: control.token }, scope, true);
}

/** @v2 adminRePauseResumedWork */
export async function adminRePauseResumedWork(session: Session, apparatus: string, orderId: string, resumeId: string): Promise<void> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!resumeId.trim() || resumeId.length > 512 || !orderId.trim() || orderId.startsWith('training-')) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/re-pause',
    { apparatus, order_id: orderId, resume_id: resumeId }, scope, false);
}

/** @v2 adminRecloseReactivatedWork */
export async function adminRecloseReactivatedWork(session: Session, apparatus: string, orderId: string,
  control: AdminReactivationRecloseControl): Promise<void> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!belongsTo(control, session) || !orderId.trim() || orderId.startsWith('training-')) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/reactivation/reclose',
    { apparatus, order_id: orderId, session_id: control.session_id, stage_node_id: control.stage_node_id, token: control.token },
    scope, false, () => belongsTo(control, session));
}

/** @v2 AdminWorkReactivationTarget */
export type AdminWorkReactivationTarget = { apparatus: string; order_id: string; batch_id: string;
  session_id: string; stage_node_id: string; token: string; readScope: string };
/** @v2 AdminWorkReactivationPreview */
export type AdminWorkReactivationPreview = { available: false; denial_reason: string; target: null } |
  { available: true; denial_reason: ''; target: AdminWorkReactivationTarget };

/** @v2 adminWorkReactivationPreview */
export async function adminWorkReactivationPreview(session: Session, apparatus: string, orderId: string,
  batchId = ''): Promise<AdminWorkReactivationPreview> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!orderId.trim() || orderId.startsWith('training-')) throw new WorkerControlException('reactivation_unavailable', '');
  const raw = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/reactivation/preview',
    { apparatus, order_id: orderId, ...(batchId ? { batch_id: batchId } : {}) }, scope, true, 'reactivation_unavailable'));
  if (!raw) throw new Error('Invalid reactivation response');
  if (raw.available === false) {
    if (typeof raw.denial_reason !== 'string' || !raw.denial_reason.trim()) throw new Error('Missing reactivation denial');
    return { available: false, denial_reason: raw.denial_reason, target: null };
  }
  const target = object(raw.target);
  if (raw.available !== true || !target) throw new Error('Invalid reactivation preview');
  for (const key of ['apparatus', 'order_id', 'batch_id', 'session_id', 'stage_node_id', 'token']) {
    if (typeof target[key] !== 'string' || (key !== 'batch_id' && !(target[key] as string).trim())) throw new Error(`Invalid reactivation ${key}`);
  }
  if (target.apparatus !== apparatus || target.order_id !== orderId || target.batch_id !== batchId) throw new Error('Reactivation target mismatch');
  return { available: true, denial_reason: '', target: {
    apparatus: target.apparatus as string, order_id: target.order_id as string, batch_id: target.batch_id as string,
    session_id: target.session_id as string, stage_node_id: target.stage_node_id as string, token: target.token as string, readScope: scope,
  } };
}

/** @v2 adminReactivateCompletedWork */
export async function adminReactivateCompletedWork(session: Session, target: AdminWorkReactivationTarget): Promise<void> {
  const scope = sessionReadScope(session);
  if (target.readScope !== scope) throw new WorkerControlException('reactivation_unavailable', '');
  const raw = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/reactivation', {
    apparatus: target.apparatus, order_id: target.order_id, ...(target.batch_id ? { batch_id: target.batch_id } : {}),
    session_id: target.session_id, stage_node_id: target.stage_node_id, token: target.token,
  }, scope, true, 'reactivation_unavailable'));
  if (raw?.ok !== true) throw new Error('Reactivation was not acknowledged');
}

export type ReturnedPaintItemInput = { usage: string; category: string; name: string; values: Record<string, string> };

/** @v2 adminBosmaAstatkaReport */
export async function adminBosmaAstatkaReport(session: Session, input: {
  apparatus: string; order_id: string; total_waste: number | null; finished_goods_meter?: number | null;
  finished_goods_kg?: number | null; bobina_kg?: number | null; returned_paint_items: ReturnedPaintItemInput[];
  returned_paint_image_id?: string; description?: string;
}): Promise<JsonObject> {
  const apparatus = input.apparatus.trim(), order = input.order_id.trim();
  const image = (input.returned_paint_image_id ?? '').trim();
  const metrics = [input.finished_goods_meter, input.finished_goods_kg, input.bobina_kg];
  if (!isCanonicalApparatusId(apparatus) || !order || input.total_waste == null || !Number.isFinite(input.total_waste) ||
      input.total_waste < 0 || metrics.some(value => value != null && (!Number.isFinite(value) || value <= 0)) ||
      (!input.returned_paint_items.length && !image)) {
    throw new WorkerControlException('progress_input_invalid', 'Astatka hisobotini to‘liq va to‘g‘ri kiriting');
  }
  const body: JsonObject = {
    apparatus, order_id: order, total_waste: input.total_waste,
    ...(input.finished_goods_meter != null ? { finished_goods_meter: input.finished_goods_meter } : {}),
    ...(input.finished_goods_kg != null ? { finished_goods_kg: input.finished_goods_kg } : {}),
    ...(input.bobina_kg != null ? { bobina_kg: input.bobina_kg } : {}),
    returned_paint_items: input.returned_paint_items.map(item => ({ usage: item.usage, category: item.category, name: item.name, values: item.values })),
    returned_paint_image_id: image, description: (input.description ?? '').trim(),
  };
  const payload = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/bosma-astatka', body,
    null, false, 'bosma_astatka_report_failed'));
  const report = object(payload?.report);
  if (report?.report_id != null && typeof report.report_id !== 'string') throw new TypeError('Invalid report_id');
  if (!report || !report.report_id) throw new WorkerControlException('bosma_astatka_invalid_response', 'Astatka qaydi javobi noto‘g‘ri');
  return report;
}

/** @v2 OrderAlertKind */
export type OrderAlertKind = 'rawMaterial' | 'qolip';

/** @v2 sendOrderAlert */
export async function sendOrderAlert(session: Session, input: {
  order_id: string; apparatus: string; kind: OrderAlertKind; request_id: string;
}): Promise<void> {
  // Test-mode sessions are handled in the shared test-mode port.
  await Promise.resolve();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/order-alert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ order_id: input.order_id, apparatus: input.apparatus,
        kind: input.kind === 'rawMaterial' ? 'raw_material' : 'qolip', request_id: input.request_id }),
    });
    let payload: JsonObject = {};
    try { payload = object(await response.json()) ?? {}; } catch { /* V2 uses an empty payload for non-JSON responses. */ }
    if (response.status === 200 && payload.ok === true) return;
    const code = payload.error == null ? 'order_alert_send_failed' : String(payload.error);
    throw new WorkerControlException(code, code === 'order_alert_no_recipients'
      ? 'Xabar yuboriladigan faol xodim topilmadi' : 'Xabar yuborilmadi. Qayta urinib ko‘ring', response.status);
  } finally { clearTimeout(timer); }
}

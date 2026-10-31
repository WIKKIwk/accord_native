import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { validOrderControl, type QueueCursor } from './workerOrderLogic';

type Obj = Record<string, any>;
export type WorkerMenuAction = 'temporary_pause' | 're_pause' | 'reclose' | 'astatka' | 'finish' | 'reopen';
export type WorkerMenu = { kind: 'none' | 'bosma' | 'astatka' | 'reopen'; actions: WorkerMenuAction[]; control: Obj };
export type ReactivationTarget = { apparatus: string; order_id: string; batch_id: string; session_id: string; stage_node_id: string; token: string };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function workerActionRequest(session: Session, path: string, body?: Obj): Promise<Obj> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await authorizedFetch(session, path, { signal: controller.signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(text(result?.detail) || text(result?.message) || text(result?.error) || `Server xatosi (${response.status})`);
    return result;
  } finally { clearTimeout(timer); }
}

export async function readWorkerActionControl(session: Session, apparatus: string, orderId: string, getCursor: () => QueueCursor | null): Promise<Obj> {
  const params = new URLSearchParams({ apparatus, order_id: orderId, include_sections: 'false' });
  const data = await workerActionRequest(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}`);
  const cursor = getCursor();
  if (!cursor || typeof cursor.epoch !== 'string' || !cursor.epoch || !Number.isInteger(cursor.rev) ||
      !validOrderControl(data, apparatus, orderId, cursor)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
  return data;
}

export function workerLongPressMenu(data: Obj, session: Session, apparatus: string, orderId: string, cursor: QueueCursor | null): WorkerMenu {
  const control = data?.control_state?.control ?? {};
  const none: WorkerMenu = { kind: 'none', actions: [], control };
  if (!cursor || !session.assigned_apparatus.includes(apparatus) || !validOrderControl(data, apparatus, orderId, cursor) ||
      data.control_state.order_control !== 'active' || ['frozen', 'freeze_requested'].includes(control.stage_control_state)) return none;
  const role = text(session.profile.role), ref = text(session.profile.ref);
  const allowed = Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const hold = control.print_preflight;
  if (!orderId.startsWith('training-') && control.state === 'print_preflight' && hold?.status === 'passed' &&
      hold.order_id === orderId && hold.apparatus === apparatus &&
      ['admin.access', 'production.map.manage', 'apparatus.queue.manage'].some(capability => session.capabilities.includes(capability))) {
    return { kind: 'reopen', actions: ['reopen'], control };
  }
  const ownedWorker = role === 'aparatchi' && !!ref && !orderId.startsWith('training-');
  const temporary = control.temporary_pause;
  const canTemporary = ownedWorker && session.capabilities.includes('apparatus.queue.manage') && control.state === 'in_progress' &&
    typeof temporary?.session_id === 'string' && !!temporary.session_id && temporary.session_id === temporary.session_id.trim() && temporary.session_id.length <= 512 &&
    typeof temporary.token === 'string' && /^[a-fA-F0-9]{64}$/.test(temporary.token);
  const rePause = control.re_pause;
  const canRePause = ownedWorker && control.state === 'in_progress' && rePause?.worker_role === 'aparatchi' && text(rePause.worker_ref) === ref &&
    !!text(rePause.resume_id) && text(rePause.resume_id).length <= 512;
  const reclose = control.reclose;
  const canReclose = ownedWorker && control.state === 'paused' && reclose?.worker_role === 'aparatchi' && reclose.worker_ref === ref &&
    reclose.stage_node_id === control.stage_node_id && !!text(reclose.stage_node_id) && text(reclose.stage_node_id).length <= 512 &&
    !!text(reclose.session_id) && text(reclose.session_id).length <= 4096 && typeof reclose.token === 'string' && /^[a-f0-9]{64}$/.test(reclose.token);
  if (control.stage_work?.astatka_available === true && !canTemporary && !canRePause && !canReclose) {
    return { kind: 'astatka', actions: ['astatka'], control };
  }
  if (!['in_progress', 'paused', 'completed'].includes(control.state)) return none;
  const actions: WorkerMenuAction[] = [];
  if (canTemporary) actions.push('temporary_pause');
  if (canRePause) actions.push('re_pause');
  if (canReclose) actions.push('reclose');
  actions.push('astatka');
  if (allowed.includes('complete') || canReclose) actions.push('finish');
  return { kind: 'bosma', actions, control };
}

export async function runWorkerMenuAction(session: Session, apparatus: string, orderId: string, action: WorkerMenuAction, previous: WorkerMenu, getCursor: () => QueueCursor | null) {
  const current = await readWorkerActionControl(session, apparatus, orderId, getCursor);
  const menu = workerLongPressMenu(current, session, apparatus, orderId, getCursor());
  if (!menu.actions.includes(action)) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
  const old = previous.control, next = menu.control;
  let path = '', body: Obj = { apparatus, order_id: orderId };
  if (action === 'temporary_pause') {
    if (old.temporary_pause?.session_id !== next.temporary_pause?.session_id || old.temporary_pause?.token !== next.temporary_pause?.token) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    path = 'temporary-pause'; body = { ...body, session_id: next.temporary_pause.session_id, token: next.temporary_pause.token };
  } else if (action === 're_pause') {
    if (old.re_pause?.resume_id !== next.re_pause?.resume_id) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    path = 're-pause'; body = { ...body, resume_id: text(next.re_pause.resume_id) };
  } else if (action === 'reclose' || (action === 'finish' && menu.actions.includes('reclose'))) {
    if (old.reclose?.token !== next.reclose?.token || old.reclose?.session_id !== next.reclose?.session_id || old.reclose?.stage_node_id !== next.reclose?.stage_node_id) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    path = 'reactivation/reclose'; body = { ...body, session_id: next.reclose.session_id, stage_node_id: next.reclose.stage_node_id, token: next.reclose.token };
  } else if (action === 'reopen') {
    if (old.print_preflight?.hold_id !== next.print_preflight?.hold_id || old.print_preflight?.revision !== next.print_preflight?.revision) throw new Error('Rang holati o‘zgardi. Qayta urining.');
    path = 'print-preflight'; body = { ...body, action: 'reopen', hold_id: next.print_preflight.hold_id, expected_revision: next.print_preflight.revision, include_control: true };
  } else throw new Error('Amal mavjud emas.');
  const result = await workerActionRequest(session, `/v1/mobile/admin/production-maps/${path}`, body);
  if (action === 'reopen') {
    if (result.hold?.hold_id !== body.hold_id || result.hold?.order_id !== orderId || result.hold?.apparatus !== apparatus || result.hold?.status !== 'running') throw new Error('Rang holati tasdiqlanmadi.');
  } else if (result.ok !== true) throw new Error('Amal tasdiqlanmadi.');
}

export function reactivationTarget(preview: Obj, detail: Obj, apparatus: string, orderId: string, cursor: QueueCursor | null): { target: ReactivationTarget | null; reason: string; stage: string } {
  if (preview?.available === false) return { target: null, reason: text(preview.denial_reason) || 'unavailable', stage: '' };
  const target = preview?.target;
  const map = detail?.maps?.[0]?.map;
  if (!cursor || preview?.available !== true || !target || target.apparatus !== apparatus || target.order_id !== orderId || target.batch_id !== '' ||
      !text(target.session_id) || !text(target.stage_node_id) || !text(target.token) ||
      !Array.isArray(detail.maps) || detail.maps.length !== 1 || map?.id !== orderId || !Array.isArray(map.nodes) ||
      (detail.projection && detail.projection !== 'worker_detail_v1') || typeof detail.scope !== 'string' || !detail.scope ||
      typeof detail.epoch !== 'string' || !detail.epoch || !Number.isInteger(detail.rev) || detail.rev < 0 ||
      detail.epoch !== cursor.epoch || typeof cursor.rev !== 'number' || !Number.isInteger(cursor.rev) || detail.rev < cursor.rev) return { target: null, reason: 'unavailable', stage: '' };
  const nodes = map.nodes.filter((node: Obj) => node.id === target.stage_node_id && node.kind === 'apparatus' && node.apparatus_id === apparatus);
  if (nodes.length !== 1) return { target: null, reason: 'stale_target', stage: '' };
  return { target: { apparatus, order_id: orderId, batch_id: '', session_id: target.session_id, stage_node_id: target.stage_node_id, token: target.token }, reason: '', stage: text(nodes[0].title) };
}

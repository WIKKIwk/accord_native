import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { validOrderControl, type QueueCursor } from './workerOrderLogic';
import { sessionReadScope } from './sessionReadScope';
import { adminCancelStartedWork, adminRecloseReactivatedWork, adminRePauseResumedWork, adminTemporarilyPauseWork,
  cancelStartControl, reactivationRecloseControl, resumePauseControl, temporaryPauseControl, type AdminWorkReactivationTarget } from './workerControlsApi';
import { apparatusUsesLaminationWorkflow } from './apparatusApi';
import { adminPrintPreflight } from './workerPrintPreflight';
import { adminOrderScanBootstrap } from './workerScanBootstrap';
import { legacyWorkerScanControl } from './workerLegacyScan';

type Obj = Record<string, any>;
export type WorkerMenuAction = 'temporary_pause' | 'cancel_start' | 're_pause' | 'reclose' | 'astatka' | 'finish' | 'reopen';
export type WorkerMenu = { kind: 'none' | 'bosma' | 'astatka' | 'reopen'; actions: WorkerMenuAction[]; control: Obj; readScope: string; operation: string };
export type ReactivationTarget = AdminWorkReactivationTarget;
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
  const scope = sessionReadScope(session);
  const data = await adminOrderScanBootstrap(session, { apparatus, orderId, includeSections: false, automaticQolipConfirmation: true }) ??
    await legacyWorkerScanControl(session, apparatus, orderId);
  const cursor = getCursor();
  if (scope !== sessionReadScope(session) || !data || !cursor || typeof cursor.epoch !== 'string' || !cursor.epoch || !Number.isInteger(cursor.rev) ||
      !validOrderControl(data, apparatus, orderId, cursor)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
  return data;
}

export function workerLongPressMenu(data: Obj, session: Session, apparatus: string, orderId: string, cursor: QueueCursor | null, operation = 'print'): WorkerMenu {
  const control = data?.control_state?.control ?? {};
  const readScope = sessionReadScope(session);
  const none: WorkerMenu = { kind: 'none', actions: [], control, readScope, operation };
  if (!cursor || !session.assigned_apparatus.includes(apparatus) || !validOrderControl(data, apparatus, orderId, cursor) ||
      data.control_state.order_control !== 'active' || ['frozen', 'freeze_requested'].includes(control.stage_control_state)) return none;
  const role = text(session.profile.role), ref = text(session.profile.ref);
  const allowed = Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const hold = control.print_preflight;
  if (!orderId.startsWith('training-') && control.state === 'print_preflight' && hold?.status === 'passed' &&
      hold.order_id === orderId && hold.apparatus === apparatus &&
      ['admin.access', 'production.map.manage', 'apparatus.queue.manage'].some(capability => session.capabilities.includes(capability))) {
    return { kind: 'reopen', actions: ['reopen'], control, readScope, operation };
  }
  const ownedWorker = role === 'aparatchi' && !!ref && !orderId.startsWith('training-');
  const temporary = temporaryPauseControl(control.temporary_pause);
  const canTemporary = ownedWorker && session.capabilities.includes('apparatus.queue.manage') && control.state === 'in_progress' &&
    temporary !== null;
  const rePause = resumePauseControl(control.re_pause);
  const canRePause = ownedWorker && control.state === 'in_progress' && rePause?.worker_role === 'aparatchi' && text(rePause.worker_ref) === ref &&
    !!text(rePause.resume_id) && text(rePause.resume_id).length <= 512;
  const reclose = reactivationRecloseControl(control.reclose, session);
  const canReclose = ownedWorker && control.state === 'paused' && reclose?.worker_role === 'aparatchi' && reclose.worker_ref === ref &&
    reclose.stage_node_id === control.stage_node_id && !!text(reclose.stage_node_id) && text(reclose.stage_node_id).length <= 512 &&
    !!text(reclose.session_id) && text(reclose.session_id).length <= 4096 && typeof reclose.token === 'string' && /^[a-f0-9]{64}$/.test(reclose.token);
  // @v2 _AdminProductionMapOrdersScreenState._workerCancelStartControl
  const cancel = cancelStartControl(control.cancel_start);
  const canCancel = (apparatusUsesLaminationWorkflow(operation) || operation === 'cut') &&
    ['aparatchi', 'rezka_master'].includes(role) && !!ref && !orderId.startsWith('training-') &&
    session.capabilities.includes('apparatus.queue.manage') && control.state === 'in_progress' && cancel?.worker_ref === ref;
  if (control.stage_work?.astatka_available === true && !canTemporary && !canRePause && !canReclose && !canCancel) {
    return { kind: 'astatka', actions: ['astatka'], control, readScope, operation };
  }
  if (!['in_progress', 'paused', 'completed'].includes(control.state)) return none;
  const actions: WorkerMenuAction[] = [];
  if (canCancel) actions.push('cancel_start');
  if (canTemporary) actions.push('temporary_pause');
  if (canRePause) actions.push('re_pause');
  if (canReclose) actions.push('reclose');
  actions.push('astatka');
  if (allowed.includes('complete') || canReclose) actions.push('finish');
  return { kind: 'bosma', actions, control, readScope, operation };
}

export async function runWorkerMenuAction(session: Session, apparatus: string, orderId: string, action: WorkerMenuAction, previous: WorkerMenu, getCursor: () => QueueCursor | null) {
  if (previous.readScope !== sessionReadScope(session)) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
  const current = await readWorkerActionControl(session, apparatus, orderId, getCursor);
  if (previous.readScope !== sessionReadScope(session)) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
  const menu = workerLongPressMenu(current, session, apparatus, orderId, getCursor(), previous.operation);
  if (!menu.actions.includes(action)) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
  const old = previous.control, next = menu.control;
  if (action === 'cancel_start') {
    const before = cancelStartControl(old.cancel_start), after = cancelStartControl(next.cancel_start);
    if (!before || !after || before.token !== after.token || before.session_id !== after.session_id ||
        before.worker_ref !== after.worker_ref || before.previous_state !== after.previous_state) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    return adminCancelStartedWork(session, apparatus, orderId, after);
  } else if (action === 'temporary_pause') {
    if (old.temporary_pause?.session_id !== next.temporary_pause?.session_id || old.temporary_pause?.token !== next.temporary_pause?.token) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    const control = temporaryPauseControl(next.temporary_pause);
    if (!control) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    return adminTemporarilyPauseWork(session, apparatus, orderId, control);
  } else if (action === 're_pause') {
    if (old.re_pause?.resume_id !== next.re_pause?.resume_id) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    const control = resumePauseControl(next.re_pause);
    if (!control) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    return adminRePauseResumedWork(session, apparatus, orderId, control.resume_id);
  } else if (action === 'reclose' || (action === 'finish' && menu.actions.includes('reclose'))) {
    if (old.reclose?.token !== next.reclose?.token || old.reclose?.session_id !== next.reclose?.session_id || old.reclose?.stage_node_id !== next.reclose?.stage_node_id) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    const control = reactivationRecloseControl(next.reclose, session);
    if (!control) throw new Error('Buyurtma holati o‘zgardi. Qayta urining.');
    return adminRecloseReactivatedWork(session, apparatus, orderId, control);
  } else if (action === 'reopen') {
    if (old.print_preflight?.hold_id !== next.print_preflight?.hold_id || old.print_preflight?.revision !== next.print_preflight?.revision) throw new Error('Rang holati o‘zgardi. Qayta urining.');
    const result = await adminPrintPreflight(session, { apparatus, order_id: orderId, action: 'reopen',
      hold_id: next.print_preflight.hold_id, expected_revision: next.print_preflight.revision });
    if (result.hold.hold_id !== next.print_preflight.hold_id || result.hold.order_id !== orderId ||
        result.hold.apparatus !== apparatus || result.hold.status !== 'running') throw new Error('Rang holati tasdiqlanmadi.');
    return;
  } else throw new Error('Amal mavjud emas.');
}

export function reactivationTarget(preview: Obj, detail: Obj, apparatus: string, orderId: string, cursor: QueueCursor | null): { target: ReactivationTarget | null; reason: string; stage: string } {
  if (preview?.available === false) return { target: null, reason: text(preview.denial_reason) || 'unavailable', stage: '' };
  const target = preview?.target;
  const map = detail?.maps?.[0]?.map;
  if (!cursor || preview?.available !== true || !target || target.apparatus !== apparatus || target.order_id !== orderId || target.batch_id !== '' ||
      !text(target.session_id) || !text(target.stage_node_id) || !text(target.token) || typeof target.readScope !== 'string' ||
      !Array.isArray(detail.maps) || detail.maps.length !== 1 || map?.id !== orderId || !Array.isArray(map.nodes) ||
      (detail.projection && detail.projection !== 'worker_detail_v1') || typeof detail.scope !== 'string' || !detail.scope ||
      typeof detail.epoch !== 'string' || !detail.epoch || !Number.isInteger(detail.rev) || detail.rev < 0 ||
      detail.epoch !== cursor.epoch || typeof cursor.rev !== 'number' || !Number.isInteger(cursor.rev) || detail.rev < cursor.rev) return { target: null, reason: 'unavailable', stage: '' };
  const nodes = map.nodes.filter((node: Obj) => node.id === target.stage_node_id && node.kind === 'apparatus' && node.apparatus_id === apparatus);
  if (nodes.length !== 1) return { target: null, reason: 'stale_target', stage: '' };
  return { target: { apparatus, order_id: orderId, batch_id: '', session_id: target.session_id, stage_node_id: target.stage_node_id, token: target.token, readScope: target.readScope }, reason: '', stage: text(nodes[0].title) };
}

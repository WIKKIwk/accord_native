import { dartTrim } from './dartJsonString';
import { adminProgressQrSourceLowercase } from './adminProgressQrSourceLowercase';
import { adminProgressQrMaterialStatus, adminProgressQrQuantityParts } from './adminProgressQrTechnicalMaterialPresentation';
import { adminProgressQrQueueStateLabel } from './adminProgressQrInfoSectionsPresentation';
import type { AdminProgressQrLinesSection } from './AdminProgressQrInfoSectionsTypes';
import type { AdminProgressQrMaterialAssignmentProps, AdminProgressQrMaterialStatusProps, AdminProgressQrMaterialText } from './AdminProgressQrMaterialSectionsTypes';

/** @v2 _stateDescription */
export function adminProgressQrStateDescription(value: string, p: AdminProgressQrMaterialText): string {
  const keys: Readonly<Record<string, string>> = {
    start: 'worker.qr.state.started', pause: 'worker.qr.state.paused', detach_roll: 'worker.qr.state.roll_removed', roll_detached: 'worker.qr.state.roll_removed', resume: 'worker.qr.state.resumed',
    complete: 'worker.qr.state.completed', completed: 'worker.qr.state.completed', pending: 'worker.qr.state.waiting_start', waiting: 'worker.qr.state.waiting_start',
    in_progress: 'worker.qr.state.in_progress', in_use: 'worker.qr.state.in_progress', active: 'worker.qr.state.in_progress', paused: 'worker.qr.state.paused',
    stopped: 'worker.qr.state.stopped', cancelled: 'worker.qr.state.stopped', processed: 'worker.qr.state.used_next', consumed_by_next_stage: 'worker.qr.state.used_next',
    free_wip: 'worker.qr.state.waiting_stock', finished_pending_acceptance: 'worker.qr.state.waiting_stock', accepted_to_stock: 'worker.qr.status.accepted_stock', waiting_next_stage: 'worker.qr.state.waiting_next',
  };
  const normalized = dartTrim(value); return Object.hasOwn(keys, normalized) ? p(keys[normalized]) : adminProgressQrSourceLowercase(adminProgressQrQueueStateLabel(value, p));
}
/** @v2 _rawMaterialStatusSentence */
export function adminProgressQrMaterialStatusSentence(value: string, p: AdminProgressQrMaterialText): string {
  const normalized = dartTrim(value); if (!normalized) return '';
  if (['available', 'in_use', 'consumed', 'reserved'].includes(normalized)) return adminProgressQrMaterialStatus(value, p);
  return p('worker.qr.material.status_generic', { status: adminProgressQrSourceLowercase(adminProgressQrMaterialStatus(value, p)) });
}
function section(id: AdminProgressQrLinesSection['id'], title: string, lines: readonly string[]): AdminProgressQrLinesSection {
  return Object.freeze({ id, title, lines: Object.freeze(lines.filter(line => !!dartTrim(line))) });
}
/** @v2 _RawMaterialStatusSection */
export function adminProgressQrMaterialStatusSection(report: AdminProgressQrMaterialStatusProps['report'], queueState: string, p: AdminProgressQrMaterialText): AdminProgressQrLinesSection {
  const name = dartTrim(report.item_name) || dartTrim(report.item_code) || 'Homashyo';
  const lines = [p('worker.qr.material.recorded', { name, quantity: adminProgressQrQuantityParts(report.qty, report.uom) })];
  if (dartTrim(report.item_group)) lines.push(p('worker.qr.material.group', { group: dartTrim(report.item_group) }));
  if (dartTrim(report.warehouse)) lines.push(p('worker.qr.material.warehouse', { warehouse: dartTrim(report.warehouse) }));
  lines.push(adminProgressQrMaterialStatusSentence(report.status, p));
  if (dartTrim(queueState)) lines.push(p('worker.qr.material.queue_state', { state: adminProgressQrStateDescription(queueState, p) }));
  return section('material-status', p('worker.qr.report.material_status'), lines);
}
/** @v2 _RawMaterialAssignmentSection */
export function adminProgressQrMaterialAssignmentSection(props: Omit<AdminProgressQrMaterialAssignmentProps, 'isCurrent'>): AdminProgressQrLinesSection {
  const { assignment, orderTitle, orderNumber, queueState, apparatusNamesById, p } = props;
  if (assignment === null) return section('assignment', p('worker.qr.report.where_used'), [p('worker.qr.material.unassigned')]);
  const title = dartTrim(orderTitle) || dartTrim(assignment.order_id), number = dartTrim(orderNumber), apparatus = dartTrim(assignment.apparatus), name = apparatus ? dartTrim(apparatusNamesById.get(apparatus) ?? '') : '';
  const lines = [number ? p('worker.qr.material.assigned_order_number', { number, order: title }) : p('worker.qr.material.assigned_order', { order: title }),
    p('worker.qr.material.assigned_apparatus', { apparatus: name || apparatus }), p('worker.qr.apparatus.purpose.next')];
  if (dartTrim(queueState)) lines.push(p('worker.qr.material.queue_state', { state: adminProgressQrStateDescription(queueState, p) }));
  if (dartTrim(assignment.assigned_by_name)) lines.push(p('worker.qr.material.assigned_by', { name: dartTrim(assignment.assigned_by_name) }));
  if (dartTrim(assignment.assigned_at)) lines.push(p('worker.qr.material.assigned_at', { time: dartTrim(assignment.assigned_at) }));
  return section('assignment', p('worker.qr.report.where_used'), lines);
}

import type { AdminApparatus } from '../apparatusApi';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { adminText, productionText } from '../shared/localization';
import { werkaDeliveryQuantity } from '../werka/werkaDeliveryPresentation';
import type { AdminWorkerDetailProfile } from './adminWorkerDetailModel';
import { dartTrim } from './dartJsonString';

export type AdminWorkerProfileCard = { title: string; rows: readonly { label: string; value: string }[] };
/** @v2 _WorkerProfileBody */
export function adminWorkerProfileCards(detail: AdminWorkerDetailProfile, apparatus: readonly Pick<AdminApparatus, 'id' | 'name'>[], locale: string): readonly AdminWorkerProfileCard[] {
  const a = (key: string) => adminText(key, locale), names = new Map<string, string>();
  for (const item of apparatus) { const id = dartTrim(item.id), name = dartTrim(item.name); if (id && name) names.set(id, name); }
  const label = (value: string) => { const id = dartTrim(value); return id ? names.get(id) ?? id : ''; };
  const rows = (values: readonly { label: string; value: string }[]) => values.map(row => ({ ...row, value: dartTrim(row.value) || a('profile.entered') }));
  const card = (title: string, values: readonly { label: string; value: string }[]): AdminWorkerProfileCard => ({ title, rows: rows(values) });
  const empty = (key: string) => [{ label: a('label.status'), value: a(key) }];
  const join = (values: readonly string[]) => values.filter(value => dartTrim(value)).join(' • '), worker = detail.worker;
  const assigned = [...new Set(detail.assigned_apparatus.filter(isCanonicalApparatusId).map(dartTrim))].map(label).sort();
  const action = (raw: string) => {
    const value = dartTrim(raw), keys: Record<string, string> = { start: 'detail.action_start', pause: 'detail.action_pause', detach_roll: 'detail.action_detach_roll',
      resume: 'detail.action_resume', roll_complete: 'detail.action_roll_complete', complete: 'detail.action_complete' };
    return value === 'merge' ? productionText('worker.action.merge', locale) : Object.hasOwn(keys, value) ? a(keys[value]) : value || a('detail.action_generic');
  };
  return [
    card(worker.name, [{ label: a('detail.ref'), value: worker.id }, { label: a('profile.phone'), value: worker.phone },
      { label: a('detail.level'), value: worker.level }, { label: a('detail.item_code'), value: worker.code }]),
    card(a('label.apparatus'), [{ label: a('label.status'), value: assigned.length ? assigned.join(', ') : a('detail.assigned_none') }]),
    card(a('detail.worker_groups'), detail.assigned_groups.length ? detail.assigned_groups.map(group => ({ label: label(group.apparatus_id),
      value: join([group.group_code, group.shift, `${group.start_time}-${group.end_time}`, `${group.work_days_per_week} ${a('worker.day_count')}`]) })) : empty('detail.assigned_none')),
    card(a('detail.active_jobs'), detail.active_sessions.length ? detail.active_sessions.map(session => ({ label: label(session.apparatus), value: `${session.order_id} • ${session.status}` })) : empty('detail.active_none')),
    card(a('detail.progress_batches'), detail.recent_batches.length ? detail.recent_batches.map(batch => ({ label: batch.order_id, value: join([label(batch.apparatus), batch.status,
      dartTrim(`${werkaDeliveryQuantity(batch.produced_qty)} ${batch.uom}`), ...(batch.finished_goods_kg != null ? [`kg ${werkaDeliveryQuantity(batch.finished_goods_kg)}`] : []),
      ...(batch.finished_goods_meter != null ? [`m ${werkaDeliveryQuantity(batch.finished_goods_meter)}`] : [])]) })) : empty('detail.batch_none')),
    card(a('detail.logs'), detail.recent_logs.length ? detail.recent_logs.map(log => ({ label: `${action(log.action)} • ${label(log.apparatus)}`,
      value: join([log.order_id, `${log.from_state} → ${log.to_state}`, ...(log.completed_with_issue ? [a('detail.problem_closed')] : [])]) })) : empty('detail.log_none')),
  ];
}

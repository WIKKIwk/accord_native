type Obj = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminProgressBatchIsFinishedGoodsOutput */
export function adminProgressBatchIsFinishedGoodsOutput(input: { action: string; status: string; next_apparatus: string }): boolean {
  if (input.next_apparatus.trim()) return false;
  const action = input.action.trim(), status = input.status.trim();
  if (action === 'pause') return status === 'paused' || status === 'resumed';
  if (action === 'detach_roll') return status === 'roll_detached' || status === 'resumed';
  return (action === 'roll_complete' || action === 'complete') && status === 'completed';
}

/** @v2 AdminProgressBatchStatusDetail */
export type AdminProgressBatchStatusDetail = { work_status: string; wip_status: string; flow_status: string; stock_status: string };
export function progressBatchStatusDetail(batch: Obj): AdminProgressBatchStatusDetail {
  const supplied = object(batch.status_detail);
  if (supplied) return { work_status: text(supplied.work_status), wip_status: text(supplied.wip_status),
    flow_status: text(supplied.flow_status), stock_status: text(supplied.stock_status) };
  const status = text(batch.status).trim(), action = text(batch.action).trim(), wip = text(batch.wip_status).trim();
  const next = text(batch.next_apparatus).trim(), processed = text(batch.processed_by_apparatus).trim();
  const work = status === 'resumed' ? 'in_progress' : status;
  const finished = adminProgressBatchIsFinishedGoodsOutput({ action, status, next_apparatus: next });
  const flow = wip === 'waiting' ? (finished ? 'free_wip' : 'waiting_next_stage')
    : wip === 'in_use' ? 'in_progress'
      : wip === 'processed' ? (processed.toLowerCase().startsWith('warehouse:') ? 'accepted_to_stock' : 'consumed_by_next_stage') : '';
  return { work_status: work, wip_status: wip, flow_status: flow, stock_status: flow === 'accepted_to_stock' ? 'accepted' : '' };
}

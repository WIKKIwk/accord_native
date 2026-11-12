import type { Session } from './auth';
import { WorkerControlException } from './workerControlsApi';
import { adminOpeningWipCandidates } from './workerOpeningWipCandidatesApi';
import { workerWipConsumerIds } from './workerOutputProgress';
import { workerRawQuantity } from './workerPeremotka';
import { progressBatchFromJson } from './workerProgressBatch';
import { adminProgressQrLookup } from './workerProgressApi';
import { adminWipBatches } from './workerWipApi';

type Batch = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export type WorkerInputSelection = { id: string; qr: string; stage: string; batch: Batch; opening: boolean };
export type WorkerInputProgressSource = { apparatusId: string; orderId: string; stageId: string; previousStage: string;
  previousRequired: boolean; openingRequired: boolean; map: Batch; section?: Batch; selected: WorkerInputSelection | null };
type Reads = { production(): Promise<Batch[]>; opening(): Promise<Batch[]>; validate(qr: string): Promise<Batch> };
export type WorkerInputProgressModel = { title: string; subtitle: string; ready: boolean; products: string; summary: string;
  loading: boolean; error: string; empty: string; rows: { id: string; selected: boolean; available: boolean; title: string; status: string; qr: string }[] };

/** @v2 _openingWipAsProgressBatch */
export function openingWipAsInputProgress(batch: Batch, previousStage: string): Batch {
  return { ...batch, apparatus: previousStage, action: '',
    produced_qty: batch.finished_goods_meter ?? batch.quantity ?? batch.finished_goods_kg ?? 0,
    uom: batch.finished_goods_meter != null ? 'm' : text(batch.uom) || 'kg',
    payload_json: { input_wip_source_kind: 'opening_wip' },
    wip_status: text(batch.wip_status).toLowerCase() };
}

/** @v2 _fetchInputProgressBatches */
export function workerInputProgressCandidates(batches: Batch[], source: WorkerInputProgressSource): Batch[] {
  if (source.orderId.startsWith('training-')) return batches;
  return batches.filter(batch => text(batch.order_id) === source.orderId && text(batch.wip_status).toLowerCase() === 'waiting' &&
    workerWipConsumerIds(source.map, text(batch.next_apparatus), text(batch.payload_json?.next_stage_node_id), source.stageId).includes(source.apparatusId));
}

/** @v2 _loadInputProgressBatches */
export async function readWorkerInputProgress(session: Session, source: WorkerInputProgressSource, current: () => boolean,
  reads: Reads = {
    production: () => adminWipBatches(session, { status: 'waiting', orderId: source.orderId, limit: 500,
      ...(source.orderId.startsWith('training-') ? { apparatus: source.previousStage, nextApparatus: source.apparatusId } : {}), current }),
    opening: () => adminOpeningWipCandidates(session, { apparatus: source.apparatusId, order_id: source.orderId }),
    validate: qr => adminProgressQrLookup(session, qr, { apparatus: source.apparatusId, orderId: source.orderId, requireActiveOrder: true, current }),
  }): Promise<{ batches: Batch[]; selected: WorkerInputSelection | null }> {
  const check = () => { if (!current()) throw new WorkerControlException('session_scope_changed', ''); };
  check();
  const section = source.section;
  const prepared = !source.orderId.startsWith('training-') && section?.status === 'ready' && section.apparatus === source.apparatusId &&
    section.order_id === source.orderId && section.stage_node_id === source.stageId && section.limit === 500 &&
    section.status_filter === 'waiting' && Array.isArray(section.data?.batches) ? section.data.batches.map((batch: unknown) => progressBatchFromJson(batch)) as Batch[] : null;
  const [production, opening] = await Promise.all([
    source.previousRequired ? prepared ?? reads.production() : [],
    source.openingRequired ? reads.opening() : [],
  ]);
  check();
  const batches = workerInputProgressCandidates(production, source);
  let selected = source.selected?.stage === source.stageId ? source.selected : null;
  if (selected && !selected.opening && !batches.some(batch => text(batch.batch_id) === selected!.id)) {
    // A validated FAB result may be newer than this list or have historical route IDs.
    const validated = await reads.validate(selected.qr);
    check();
    if (text(validated.order_id) === source.orderId && text(validated.batch_id) === selected.id &&
        text(validated.qr_payload).toUpperCase() === selected.qr.toUpperCase() && text(validated.wip_status).toLowerCase() === 'waiting') batches.push(validated);
    else selected = null;
  }
  const openingBatches = opening.map(batch => openingWipAsInputProgress(batch, source.previousStage));
  const matching = selected ? (selected.opening ? openingBatches : batches).find(batch =>
    text(batch.batch_id) === selected!.id || text(batch.qr_payload).toUpperCase() === selected!.qr.toUpperCase()) : null;
  if (selected) selected = matching ? { ...selected, batch: matching } : null;
  const rows = [...batches, ...openingBatches];
  // _acceptPreparedFabScan / _handleQuickScan place the exact validated roll first.
  if (selected) {
    const selectedId = selected.id;
    const group = selected.opening ? openingBatches : batches;
    const ordered = [selected.batch, ...group.filter(batch => text(batch.batch_id) !== selectedId)];
    return { batches: selected.opening ? [...batches, ...ordered] : [...ordered, ...openingBatches], selected };
  }
  return { batches: rows, selected };
}

/** @v2 _PreviousProgressQrTile */
export function workerInputProgressModel(input: { source: WorkerInputProgressSource; batches: Batch[]; loading: boolean; error: string },
  p: Text, label: (id: string) => string): WorkerInputProgressModel {
  const { source, loading, error } = input;
  const selected = source.selected?.stage === source.stageId ? source.selected : null;
  const selectedBatch = selected ? selected.opening ? openingWipAsInputProgress(selected.batch, source.previousStage) : selected.batch : null;
  let batches = input.batches;
  if (selected && selectedBatch) {
    // Accepting another QR updates the visible selection immediately, without a second list read.
    const isOpening = (batch: Batch) => batch.payload_json?.input_wip_source_kind === 'opening_wip';
    const production = batches.filter(batch => !isOpening(batch)), opening = batches.filter(isOpening);
    const group = selected.opening ? opening : production;
    const ordered = [selectedBatch, ...group.filter(batch => text(batch.batch_id) !== selected.id)];
    batches = selected.opening ? [...production, ...ordered] : [...ordered, ...opening];
  }
  const stage = label(source.previousStage), available = (batch: Batch) => ['', 'waiting'].includes(text(batch.wip_status).toLowerCase());
  const open = batches.filter(available).length, used = batches.length - open;
  const summaryKey = !batches.length ? 'empty' : !used ? 'unused' : !open ? 'used_all' : 'mixed';
  return { title: p(selected ? 'worker.progress.previous.confirmed' : 'worker.progress.previous.qr'),
    subtitle: selectedBatch ? `${label(text(selectedBatch.apparatus))} • ${workerRawQuantity(selectedBatch.produced_qty)} ${text(selectedBatch.uom)}` : stage,
    ready: !!selected, products: p('worker.progress.products'), loading, error,
    summary: !loading && !error && batches.length ? p(`worker.progress.summary.${summaryKey}`, { stage, total: batches.length, open, used }) : '',
    empty: p('worker.progress.none', { stage }),
    rows: loading || error ? [] : batches.map((batch, index) => {
      const sourceId = text(batch.apparatus), action = text(batch.action).toLowerCase();
      const actionKey = ['complete', 'pause', 'detach_roll', 'roll_complete'].includes(action) ? action : 'output';
      const isAvailable = available(batch);
      return { id: `${text(batch.batch_id)}:${index}`, available: isAvailable,
        selected: !!selected && (selected.id === text(batch.batch_id) || selected.qr.toUpperCase() === text(batch.qr_payload).toUpperCase()),
        title: sourceId ? p('worker.progress.batch_title', { source: label(sourceId), action: p(`worker.progress.action.${actionKey}`) })
          : text(batch.label_item_name) || text(batch.order_id) || text(batch.batch_id),
        status: p('worker.progress.batch_status', { status: p(isAvailable ? 'worker.progress.scan_required' : 'worker.progress.used'),
          qty: workerRawQuantity(batch.produced_qty), uom: text(batch.uom) }),
        qr: p('worker.progress.qr', { qr: text(batch.qr_payload) }) };
    }) };
}

/** @v2 _readOnlyQueueActionErrorText */
export function workerInputProgressError(error: unknown, p: Text): string {
  const value = error as { name?: string; code?: string; statusCode?: number };
  if (['AbortError', 'TimeoutError'].includes(value?.name ?? '')) return p('worker.error.network_timeout');
  if (value?.code?.startsWith('wip_route_')) {
    const route = value.code.slice('wip_route_'.length);
    if (['source_unresolved', 'destination_unresolved', 'ambiguous', 'changed'].includes(route)) return p(`worker.error.wip_route_${route.replace('_unresolved', '')}`);
  }
  return p(value?.statusCode === 403 || value?.code === 'forbidden' ? 'worker.wip.access_denied' : 'worker.wip.load_failed');
}

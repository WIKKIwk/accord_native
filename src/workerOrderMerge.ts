import { WorkerControlException } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';
import { workerFabChanged, workerFabConsumers, workerFabErrorText, workerFabExistingText, WorkerFabGuidance, type WorkerFabContext, type WorkerFabReads } from './workerFabQr';

type Obj = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
type Link = { input_batch_id: string; sequence_no: number; status: string };
export type WorkerMergeTarget = { apparatus: string; order: string; orderLabel: string; apparatusLabel: string; label: (id: string) => string };
export type WorkerMergeProof = { context: WorkerFabContext; batch: Obj; stage: string; lineage: Link[] };
export type WorkerMergeState = {
  phase: 'closed' | 'scanning' | 'checking' | 'confirmation' | 'saving' | 'guidance';
  qr?: string; qrLabel?: string; labels?: Record<string, string>; message?: string;
};

/** @v2 _sameMergeInputLineage */
export function sameWorkerMergeLineage(before: Link[], after: Link[]): boolean {
  return before.length === after.length && before.every(link => after.some(next => next.input_batch_id === link.input_batch_id &&
    next.sequence_no === link.sequence_no && next.status === link.status));
}

/** @v2 _rezkaMergeControlAdvanced */
export function workerMergeAdvanced(before: Link[], after: Link[]): boolean {
  const oldActive = before.find(link => link.status === 'in_use')?.input_batch_id;
  const newActive = after.find(link => link.status === 'in_use')?.input_batch_id;
  return after.length > before.length && !!oldActive && !!newActive && oldActive !== newActive &&
    before.every(link => after.some(next => next.input_batch_id === link.input_batch_id)) &&
    after.some(link => link.input_batch_id === oldActive && link.status === 'processed');
}

/** @v2 _workerWipScanErrorText */
export function workerOrderMergeError(error: unknown, p: Text): string {
  if (error instanceof WorkerFabGuidance) return error.message;
  const code = String((error as Obj)?.code ?? '');
  const diagnostics = (error as Obj)?.diagnostics;
  if (code === 'merge_input_frame_count_mismatch' && Number.isInteger(diagnostics?.active_kadr_count) && Number.isInteger(diagnostics?.scanned_kadr_count))
    return p('worker.error.merge_input_frame_count_mismatch_detail', { active: diagnostics.active_kadr_count, scanned: diagnostics.scanned_kadr_count });
  const keys: Record<string, string> = {
    progress_batch_in_use: 'worker.error.wip_in_use', progress_batch_already_used: 'worker.error.wip_used',
    opening_wip_qr_mismatch: 'worker.opening_wip.qr_mismatch', opening_wip_lookup: 'worker.opening_wip.qr_mismatch',
    opening_wip_qr_not_found: 'worker.qr.not_found', opening_wip_not_found: 'worker.qr.not_found',
    queue_action_not_allowed: 'worker.qr.scan_state_changed', order_scan_bootstrap_stale: 'worker.qr.scan_state_changed',
    production_map_snapshot_contract_invalid: 'worker.qr.scan_state_changed', apparatus_not_assigned: 'worker.qr.forbidden',
    merge_input_required: 'worker.error.merge_input_required', merge_input_same: 'worker.error.merge_input_same',
    merge_input_already_used: 'worker.error.merge_input_already_used', merge_input_not_accepted: 'worker.error.merge_input_not_accepted',
    merge_input_frame_count_mismatch: 'worker.error.merge_input_frame_count_mismatch',
  };
  return keys[code] ? p(keys[code]) : workerFabErrorText(error, p);
}

/** @v2 _ReadOnlyOrderDetailSheetState._checkWorkerWipScan */
export async function prepareWorkerOrderMerge(target: WorkerMergeTarget, qr: string, reads: WorkerFabReads, p: Text): Promise<WorkerMergeProof> {
  const check = () => { if (!reads.current()) throw workerFabChanged(); };
  check();
  const wip = await reads.identify(qr); check();
  if (!wip) throw new WorkerFabGuidance(p('worker.qr.not_found'));
  const batch = wip.batch, scannedOrder = String(batch.order_id ?? '').trim();
  if (!scannedOrder) throw workerFabChanged();
  const context = await reads.context(scannedOrder, wip.opening ? '' : qr); check();
  const map = context.snapshot.maps?.find((row: Obj) => row.map?.id === scannedOrder)?.map;
  if (!map) throw workerFabChanged();
  const state = context.bootstrap.control_state, control = state?.control;
  const orderLabel = String(map.title || map.order_number || scannedOrder);
  if (state.order_control !== 'active' || ['frozen', 'freeze_requested'].includes(control?.stage_control_state)) {
    throw new WorkerFabGuidance(p(state.order_control === 'frozen' || control?.stage_control_state === 'frozen'
      ? 'worker.freeze.named' : 'worker.qr.freeze_requested', { order: orderLabel }));
  }
  const status = String(batch.wip_status ?? '').toLowerCase();
  if (status === 'void') throw new WorkerFabGuidance(p('worker.qr.roll_void'));
  if (status !== 'waiting') throw new WorkerControlException(status === 'in_use' ? 'progress_batch_in_use' : 'progress_batch_already_used',
    status === 'void' ? p('worker.qr.roll_void') : '');
  if (batch.input_route_error) throw new WorkerControlException(batch.input_route_error, '');
  const consumers = workerFabConsumers(wip, map);
  if (!consumers.length) throw new WorkerControlException('wip_route_destination_unresolved', '');
  if (!consumers.includes(target.apparatus)) {
    const name = (id: string) => target.label(id) !== id ? target.label(id) : String(map.nodes?.find((node: Obj) => node.apparatus_id === id)?.title || id);
    const destination = [...new Set(consumers.map(id => {
      const node = map.nodes?.find((node: Obj) => node.apparatus_id === id);
      return node?.alternative_group_id && node?.alternative_group_label ? node.alternative_group_label : name(id);
    }))].join(', '), source = String(wip.opening?.intake.source_apparatus ?? batch.apparatus ?? '');
    throw new WorkerFabGuidance(`${p(source ? 'worker.qr.route_source_destination' : 'worker.qr.route_destination', { source: name(source), destination })} ${p('worker.qr.wrong_stage', { current: target.apparatusLabel })}`);
  }
  if (scannedOrder !== target.order) throw new WorkerFabGuidance(`${p('worker.qr.wrong_order_context', { opened: target.orderLabel, order: orderLabel })} ${workerFabExistingText(context.bootstrap, target.apparatusLabel, orderLabel, true, p)}`);
  if (!control?.allowed_actions?.includes('merge')) throw new WorkerFabGuidance(workerFabExistingText(context.bootstrap, target.apparatusLabel, orderLabel, true, p));
  // A context lookup is not a substitute for the scoped, current-order WIP proof.
  const validated = await reads.validate(wip, qr, target.order); check();
  if (validated.batch_id !== batch.batch_id || validated.order_id !== target.order || String(validated.qr_payload ?? '').trim() !== String(batch.qr_payload ?? '').trim())
    throw new WorkerControlException('progress_qr_invalid_response', '');
  if (validated.wip_status !== 'waiting') throw new WorkerControlException(validated.wip_status === 'in_use' ? 'progress_batch_in_use' : 'progress_batch_already_used', '');
  const latest = await reads.context(target.order, ''); check();
  const latestState = latest.bootstrap.control_state, latestControl = latestState?.control;
  if (!validOrderControl(latest.bootstrap, target.apparatus, target.order, reads.snapshot()) || latestState.order_control !== 'active' ||
      ['frozen', 'freeze_requested'].includes(latestControl?.stage_control_state) || !latestControl?.allowed_actions?.includes('merge'))
    throw new WorkerFabGuidance(p('worker.qr.scan_state_changed'));
  const latestMap = latest.snapshot.maps?.find((row: Obj) => row.map?.id === target.order)?.map;
  if (!latestMap || !workerFabConsumers({ ...wip, batch: validated }, latestMap).includes(target.apparatus))
    throw new WorkerFabGuidance(p('worker.error.machine_flow'));
  return { context: latest, batch: validated, stage: String(latestControl.stage_node_id ?? ''),
    lineage: (latestControl.rezka_input_lineage ?? []).map((link: Link) => ({ ...link })) };
}

type Dependencies = {
  current(): boolean; available(): boolean; target(): WorkerMergeTarget; reads(): WorkerFabReads; p: Text;
  write(qr: string, proof: WorkerMergeProof, current: () => boolean): Promise<boolean>;
  changed(state: WorkerMergeState): void; notice(message: string): void;
};

/** @v2 _ReadOnlyOrderDetailSheetState._toggleMergeScanMode */
export class WorkerOrderMergeFlow {
  state: WorkerMergeState = { phase: 'closed' };
  private generation = 0;
  private proof: WorkerMergeProof | null = null;
  constructor(private deps: Dependencies) {}
  configure(deps: Dependencies) { this.deps = deps; }
  private set(state: WorkerMergeState) { this.state = state; this.deps.changed(state); }
  private current(generation: number) { return generation === this.generation && this.deps.current(); }
  cancel() {
    if (this.state.phase === 'closed' && !this.proof) return;
    this.generation++; this.proof = null; this.set({ phase: 'closed' });
  }
  toggle() {
    if (!this.deps.available() || !['closed', 'scanning'].includes(this.state.phase)) return;
    if (this.state.phase === 'scanning') this.cancel(); else this.set({ phase: 'scanning' });
  }
  async scan(qr: string, qrLabel = qr.trim()) {
    if (!qr.trim() || this.state.phase !== 'scanning' || !this.deps.available()) return;
    const generation = ++this.generation;
    this.set({ phase: 'checking' });
    try {
      const proof = await prepareWorkerOrderMerge(this.deps.target(), qr.trim(), this.deps.reads(), this.deps.p);
      if (!this.current(generation)) return;
      const current = proof.lineage.find(link => link.status === 'in_use');
      const labels = { current: this.deps.p(current ? 'worker.merge.roll' : 'worker.merge.current_roll', { index: current?.sequence_no }),
        next: this.deps.p('worker.merge.roll', { index: Math.max(0, ...proof.lineage.map(link => link.sequence_no)) + 1 }) };
      this.proof = proof;
      this.set({ phase: 'confirmation', qr: qr.trim(), qrLabel, labels });
    } catch (error) { if (this.current(generation)) this.set({ phase: 'guidance', message: workerOrderMergeError(error, this.deps.p) }); }
  }
  async confirm() {
    if (this.state.phase !== 'confirmation' || !this.proof || !this.deps.current()) return;
    const before = this.proof, { qr, labels } = this.state, generation = ++this.generation;
    this.set({ phase: 'checking' });
    let writeAttempted = false;
    try {
      const proof = await prepareWorkerOrderMerge(this.deps.target(), qr!, this.deps.reads(), this.deps.p);
      if (!this.current(generation)) return;
      if (before.stage !== proof.stage || before.context.bootstrap.control_state.epoch !== proof.context.bootstrap.control_state.epoch ||
          !sameWorkerMergeLineage(before.lineage, proof.lineage)) throw new WorkerFabGuidance(this.deps.p('worker.qr.merge_changed'));
      this.set({ phase: 'saving' });
      writeAttempted = true;
      try {
        const acknowledged = await this.deps.write(qr!, proof, () => this.current(generation));
        if (!this.current(generation)) return;
        if (!acknowledged) { this.proof = null; this.set({ phase: 'scanning' }); return; }
      }
      catch (error) {
        if (!this.current(generation)) return;
        if (!['AbortError', 'TimeoutError'].includes((error as Obj)?.name)) throw error;
        let advanced = false;
        try {
          const reconciled = await this.deps.reads().context(this.deps.target().order, '');
          advanced = validOrderControl(reconciled.bootstrap, this.deps.target().apparatus, this.deps.target().order, this.deps.reads().snapshot()) &&
            workerMergeAdvanced(proof.lineage, reconciled.bootstrap.control_state.control.rezka_input_lineage ?? []);
        } catch { /* The uncertain write is never replayed. The next task requires a fresh contract. */ }
        if (!this.current(generation)) return;
        if (!advanced) { this.cancel(); this.deps.notice(this.deps.p('worker.notice.action_sent')); return; }
      }
      if (!this.current(generation)) return;
      this.cancel();
      this.deps.notice(this.deps.p('worker.notice.merge_complete', labels));
    } catch (error) {
      if (!this.current(generation)) return;
      let message = workerOrderMergeError(error, this.deps.p);
      if (writeAttempted && ['queue_action_not_allowed', 'apparatus_busy', 'order_frozen', 'order_freeze_requested', 'order_scan_bootstrap_stale'].includes((error as Obj)?.code)) {
        try {
          const target = this.deps.target(), fresh = await this.deps.reads().context(target.order, '');
          message = workerFabExistingText(fresh.bootstrap, target.apparatusLabel, target.orderLabel, true, this.deps.p);
        } catch { /* Keep the original server rejection if the follow-up read fails. */ }
      }
      if (this.current(generation)) this.set({ phase: 'guidance', message });
    }
  }
}

/** @v2 _rezkaMergeStateLines */
export function workerMergeStateLines(links: Link[], p: Text): string[] {
  if (links.length < 2) return [];
  const sorted = [...links].sort((a, b) => a.sequence_no - b.sequence_no), active = sorted.find(link => link.status === 'in_use');
  const roll = (link: Link) => p('worker.merge.roll', { index: link.sequence_no });
  return [p('worker.notice.merge_complete', { next: roll(sorted.at(-1)!), current: roll(sorted.at(-2)!) }),
    ...(active ? [p('worker.merge_state.current', { batch: roll(active) })] : []),
    ...(links.length > 2 ? [p('worker.merge_state.count', { count: links.length })] : [])];
}

import { laminationAstatkaInputRoll, laminationLabelPrints, type laminationAstatkaSnapshotFromJson, type laminationAstatkaResultFromJson } from './workerLaminationRemainders';
import { printJobFromJson, type WorkerPrintJob } from './workerPrintJob';
type Snapshot = ReturnType<typeof laminationAstatkaSnapshotFromJson>;
export type LaminationReceipt = ReturnType<typeof laminationAstatkaResultFromJson>;
type Request = Record<string, unknown>;
export type LaminationValues = Record<'meter' | 'kg' | 'bobina' | 'wip' | 'film' | 'waste' | 'note', string>;
export type LaminationReportContext = { apparatus: string; orderId: string; stage: string; complete: boolean; fullReport: boolean };
const numeric = (value: string) => value.trim() ? Number(value.trim().replaceAll(',', '.')) : NaN;

export function usesIntegratedLaminationReport(input: { operation: string; action: string; training: boolean; testMode: boolean;
  freezeRequested: boolean; fullReport: boolean }) {
  return input.operation.trim().toLowerCase() === 'laminate' && !input.training && !input.testMode && !input.freezeRequested &&
    (input.action === 'astatka' || (input.action === 'complete' && input.fullReport));
}

/** @v2 _ProgressQtyDialogState._submit */
export function laminationReportInput(context: LaminationReportContext, snapshot: Snapshot, values: LaminationValues, requestId: string): Request {
  const wip = numeric(values.wip), film = numeric(values.film), waste = numeric(values.waste);
  if (![wip, film, waste].every(value => Number.isFinite(value) && value >= 0)) throw new Error('worker.daily.invalid_number');
  const outputRequired = context.complete || snapshot.session_status === 'active';
  const meter = numeric(values.meter), kg = numeric(values.kg), bobina = numeric(values.bobina);
  const empty = !context.complete && meter === 0 && kg === 0;
  if (outputRequired && !empty && (!(meter > 0) || !Number.isFinite(meter) || !(kg > 0) || !Number.isFinite(kg) ||
      !Number.isFinite(bobina) || bobina < 0 || (context.complete && bobina <= 0) || kg <= bobina)) throw new Error('worker.lamination_astatka.output_required');
  const wipSource = laminationAstatkaInputRoll(snapshot, 'wip'), filmSource = laminationAstatkaInputRoll(snapshot, 'film');
  return { ...(context.complete ? { action: 'complete', full_completion_report_required: context.fullReport } : {}),
    apparatus: context.apparatus, order_id: context.orderId, session_id: snapshot.session_id, request_id: requestId,
    lamination_print_leftover_rolls: wip, lamination_film_leftover_rolls: film, total_waste: waste,
    ...(outputRequired ? { finished_goods_meter: meter, finished_goods_kg: kg, ...(!empty && bobina > 0 ? { bobina_kg: bobina } : {}) } : {}),
    description: values.note.trim(), layer_remainder_weights: { wip_net_kg: wip, film_net_kg: film,
      ...(wipSource ? { wip_source_id: wipSource.source_id } : {}), ...(filmSource ? { film_source_id: filmSource.source_id } : {}),
      expected_sources: snapshot.sources.map(source => ({ source_kind: source.source_kind, source_id: source.source_id, expected_revision: source.revision })) },
    print_transport: 'offline', print_count: 1 };
}

/** Validate every enabled label identity before sending anything to a local printer. */
export function laminationReceiptJobs(receipt: LaminationReceipt): WorkerPrintJob[] {
  const expected = new Set(receipt.progress_batches.map(batch => String(batch.qr_payload ?? '')));
  for (const row of receipt.remainders) if (row.remaining_net_kg > 0 && row.qr_payload && laminationLabelPrints(receipt.label_settings, row.source_kind)) expected.add(row.qr_payload);
  expected.delete('');
  if (!expected.size) return [];
  const printed = new Set<string>(), jobs: WorkerPrintJob[] = [];
  for (const raw of receipt.prints) {
    const qr = String(raw.qr_payload ?? '');
    if (raw.ok !== true || !expected.has(qr) || printed.has(qr)) throw new Error('worker.layer_remainder.print_failed');
    const job = printJobFromJson(raw);
    if (job.epc !== qr) throw new Error('worker.layer_remainder.print_failed');
    printed.add(qr); jobs.push(job);
  }
  if (printed.size !== expected.size) throw new Error('worker.layer_remainder.print_pending');
  return jobs;
}

type State = { phase: 'loading' | 'edit' | 'pending' | 'saving' | 'receipt' | 'error'; snapshot: Snapshot | null;
  receipt: LaminationReceipt | null; values: LaminationValues; error: string; resumeGuidance: boolean; issueNotice: string };
type Dependencies = { context: LaminationReportContext; key: string; current(): boolean; newRequestId(): string;
  read(requestId: string): Promise<Snapshot>; save(request: Request, current: () => boolean): Promise<LaminationReceipt>;
  store: { get(key: string): Promise<Request | null>; set(key: string, request: Request | null, expectedId?: string): Promise<void> };
  freeze(note: string, current: () => boolean): Promise<{ completion_request?: unknown }>; attempted(): void; committed(): void };

/** @v2 _IntegratedLaminationAstatka._runIntegratedLaminationAstatka */
export class WorkerLaminationWorkflow {
  private state: State = { phase: 'loading', snapshot: null, receipt: null, values: { meter: '', kg: '', bobina: '', wip: '', film: '', waste: '', note: '' }, error: '', resumeGuidance: false, issueNotice: '' };
  private listeners = new Set<() => void>();
  private request: Request | null = null;
  private generation = 0;
  private retired = false;
  private loading = false;
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  current = () => !this.retired && this.deps.current();
  private set(state: State) { this.state = state; for (const listener of this.listeners) listener(); }
  invalidate() { this.retired = true; this.generation++; this.set({ ...this.state, phase: 'error', snapshot: null, receipt: null, error: '' }); }
  change = (field: keyof LaminationValues, value: string) => {
    if (this.current() && this.state.phase === 'edit') this.set({ ...this.state, values: { ...this.state.values, [field]: value }, error: '' });
  };
  load = async () => {
    if (!this.current() || this.loading || this.state.phase === 'saving') return;
    this.loading = true; const generation = ++this.generation;
    this.set({ ...this.state, phase: 'loading', error: '' });
    try {
      const request = await this.deps.store.get(this.deps.key);
      if (!this.current() || generation !== this.generation) return;
      if (request && (request.apparatus !== this.deps.context.apparatus || request.order_id !== this.deps.context.orderId || !String(request.request_id ?? '').trim() ||
          (request.action === 'complete') !== this.deps.context.complete)) throw new Error('worker.error.sync');
      const snapshot = await this.deps.read(String(request?.request_id ?? ''));
      if (!this.current() || generation !== this.generation) return;
      this.request = request;
      if (snapshot.request_result) {
        this.deps.committed(); this.set({ ...this.state, snapshot, receipt: snapshot.request_result, phase: 'receipt' });
        if (request) await this.deps.store.set(this.deps.key, null, String(request.request_id));
      } else if (!snapshot.supports_remainder_weights) throw new Error('worker.lamination_label.backend_required');
      else if (request) this.set({ ...this.state, snapshot, phase: 'pending' });
      else if ((this.deps.context.complete || snapshot.session_status === 'active') && !snapshot.sources.length && !snapshot.allow_empty_sources) throw new Error('worker.lamination_astatka.sources_missing');
      else if ((this.deps.context.complete && snapshot.session_status === 'completed') || !['active', 'paused', 'roll_detached', 'completed'].includes(snapshot.session_status) ||
          (['paused', 'roll_detached'].includes(snapshot.session_status) && !snapshot.sources.length && !snapshot.allow_empty_sources))
        this.set({ ...this.state, snapshot, phase: 'receipt', resumeGuidance: ['paused', 'roll_detached'].includes(snapshot.session_status) });
      else this.set({ ...this.state, snapshot, phase: 'edit' });
    } catch (reason) { if (this.current() && generation === this.generation) this.set({ ...this.state, phase: this.state.receipt ? 'receipt' : 'error', error: reason instanceof Error && reason.message.startsWith('worker.') ? reason.message : 'worker.error.sync' }); }
    finally { this.loading = false; }
  };
  submit = async () => {
    const state = this.state;
    if (!this.current() || !state.snapshot || !['edit', 'pending'].includes(state.phase)) return;
    const generation = this.generation;
    let submitted = false, committed = false;
    try {
      if (state.phase === 'edit' && this.deps.context.complete && state.values.note.trim()) {
        this.set({ ...state, phase: 'saving', error: '' }); this.deps.attempted(); submitted = true;
        const result = await this.deps.freeze(state.values.note.trim(), this.current);
        if (!this.current() || generation !== this.generation) return;
        this.deps.committed(); committed = true;
        this.set({ ...this.state, phase: 'receipt', issueNotice: result.completion_request ? 'worker.notice.completion_request_sent' : 'worker.notice.action_sent' });
        return;
      }
      const request = this.request ?? laminationReportInput(this.deps.context, state.snapshot, state.values, this.deps.newRequestId());
      this.set({ ...state, phase: 'saving', error: '' });
      if (!this.request) {
        await this.deps.store.set(this.deps.key, request);
        if (!this.current() || generation !== this.generation) return;
        this.request = request;
      }
      this.deps.attempted(); submitted = true;
      const receipt = await this.deps.save({ ...request, print_transport: 'offline', print_count: 1 }, this.current);
      committed = true;
      if (this.current() && generation === this.generation) { this.deps.committed(); this.set({ ...this.state, receipt, phase: 'receipt' }); }
      await this.deps.store.set(this.deps.key, null, String(request.request_id));
      if (this.current() && generation === this.generation) { this.request = null; this.set({ ...this.state, receipt, phase: 'receipt' }); }
    } catch (reason) {
      const status = (reason as { statusCode?: number } | null)?.statusCode;
      if (submitted && !committed && [400, 403, 404, 409, 422].includes(status ?? 0) && this.current()) {
        try { await this.deps.store.set(this.deps.key, null, String(this.request?.request_id ?? '')); this.request = null; } catch { /* Keep the original request if removal failed. */ }
      }
      if (this.current() && generation === this.generation) this.set({ ...this.state, phase: committed ? 'receipt' : submitted ? 'error' : 'edit',
        error: reason instanceof Error && reason.message.startsWith('worker.') ? reason.message : 'worker.error.sync' });
    }
  };
}

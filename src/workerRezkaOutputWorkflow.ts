import type { AdminRezkaOutputReport } from './workerRezkaReport';
import { rezkaFrameAt, rezkaFrameIssueNote, rezkaFramePeremotkaReason } from './workerRezkaReport';
import { emptyRezkaFrame, rezkaFrameInput, rezkaOutputBody, rezkaOutputDeviations, rezkaQty, rezkaSavedDraft, rezkaSavedInput, rezkaSavedMatches,
  type RezkaFrameDraft, type RezkaOutputDeviation, type RezkaOutputWaste } from './workerRezkaOutputModel';

type Obj = Record<string, any>;
export type RezkaOutputSnapshot = { report: AdminRezkaOutputReport; kadr_counts: number[]; epoch: string; revision: number };
export type RezkaOutputControl = { stage: string; allowed: string[]; fullReport: boolean; totalWasteOnly: boolean; freezeRequest?: string };
type Request = { index: number; input: Obj | null };
export type RezkaOutputState = { phase: 'loading' | 'edit' | 'saving' | 'print_pending' | 'done' | 'error' | 'invalid'; snapshot: RezkaOutputSnapshot | null;
  frames: RezkaFrameDraft[]; waste: RezkaOutputWaste; note: string; error: string; notice: string; completed: boolean; statuses: Record<number, string>; queued: number[];
  paused: boolean; processing: boolean; confirming: boolean; syncRequired: boolean; issuePrompted: number[]; includeBobina: boolean; fullReport: boolean; totalWasteOnly: boolean;
  freezeRequest: string; canReload: boolean; focus?: { index: number; field: RezkaOutputDeviation['field']; serial: number } };
type Dependencies<Printer> = { context: { apparatus: string; orderId: string; action: string; stage: string; includeBobina: boolean; autofill: boolean; printCount: number };
  current(): boolean; read(): Promise<RezkaOutputSnapshot>; control(): Promise<RezkaOutputControl>;
  save(body: Obj, current: () => boolean): Promise<Obj>; selectPrinter(): Promise<Printer>; reprint(frame: { batch_id: string; qr_payload: string }, printer: Printer, count: number): Promise<Obj>;
  printerFields(printer: Printer): Obj; print(result: Obj, printer: Printer): Promise<void>; confirm(deviation: RezkaOutputDeviation): Promise<boolean>;
  attempted(): void; committed(final: boolean): void };

const failure = (error: unknown, fallback: string) => {
  const code = (error as { code?: string })?.code;
  if (code === 'active_paddon_required') return 'worker.paddon.active.required';
  if (code === 'paddon_locked') return 'worker.paddon.locked_error';
  if (['paddon_not_found', 'paddon_invalid_input', 'paddon_item_already_assigned'].includes(code ?? '')) return 'worker.rezka.print.paddon_failed';
  return error instanceof Error && error.message.startsWith('worker.') ? error.message : fallback;
};
const cloneInput = (input: Obj) => Object.freeze({ ...input });

/** @v2 _RezkaFramePrint */
export class WorkerRezkaOutputWorkflow<Printer> {
  private state: RezkaOutputState;
  private listeners = new Set<() => void>();
  private requests: Request[] = [];
  private printer: Printer | null = null;
  private approvals = new Set<string>();
  private printed = new Set<number>();
  private exclusive = false;
  private loadGeneration = 0;
  private finalAttempted = false;
  private autofilled = false;
  private printOnly: { result: Obj; printer: Printer; expected: number; next: number; prepared: Obj[] | null } | null = null;
  constructor(private deps: Dependencies<Printer>) {
    this.state = { phase: 'loading', snapshot: null, frames: [], waste: { total: '', print: '', lamination: '', edge: '' }, note: '', error: '', notice: '', completed: false, statuses: {},
      queued: [], paused: false, processing: false, confirming: false, syncRequired: false, issuePrompted: [], includeBobina: deps.context.includeBobina,
      fullReport: false, totalWasteOnly: false, freezeRequest: '', canReload: true };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(change: Partial<RezkaOutputState>) { this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener()); }
  private current = () => this.deps.current() && this.state.phase !== 'invalid';
  private guard = () => { if (!this.current()) throw new Error('worker.error.sync'); };
  invalidate() { this.loadGeneration++; this.requests = []; this.update({ phase: 'invalid', processing: false, queued: [] }); }
  private saved(index: number) { return this.state.snapshot ? rezkaFrameAt(this.state.snapshot.report, index) : null; }
  private mutable(index: number) { return this.current() && this.state.phase === 'edit' && !this.finalAttempted && !this.state.syncRequired && !this.exclusive && !this.saved(index) && !this.state.queued.includes(index) && !!this.state.frames[index]; }
  private restore(snapshot: RezkaOutputSnapshot) {
    const old = this.state.snapshot;
    if (old && (snapshot.report.cycle_id !== old.report.cycle_id || snapshot.epoch !== old.epoch ||
        JSON.stringify(snapshot.kadr_counts) !== JSON.stringify(old.kadr_counts) || snapshot.revision < old.revision)) throw new Error('worker.error.sync');
    if (old?.report.frames.some(frame => {
      const latest = snapshot.report.frames.find(value => value.index === frame.index);
      return !latest || latest.batch_id !== frame.batch_id || latest.qr_payload !== frame.qr_payload || !!rezkaFrameIssueNote(latest) !== !!rezkaFrameIssueNote(frame);
    })) throw new Error('worker.error.sync');
    const frames = snapshot.kadr_counts.map((_, index) => {
      const saved = rezkaFrameAt(snapshot.report, index);
      return saved ? rezkaSavedDraft(saved) : { ...(this.state.frames[index] ?? emptyRezkaFrame()) };
    });
    const includeBobina = snapshot.report.include_bobina_in_net ?? this.state.includeBobina;
    const reference = snapshot.report.frames.find(frame => frame.index === snapshot.report.reference_frame_index) ??
      snapshot.report.frames.find(frame => !rezkaFrameIssueNote(frame) && !rezkaFramePeremotkaReason(frame));
    if (this.deps.context.autofill && !this.autofilled && reference && !rezkaFrameIssueNote(reference) && !rezkaFramePeremotkaReason(reference)) {
      const source = rezkaSavedDraft(reference);
      let complete = false; try { rezkaFrameInput(source, includeBobina); complete = true; } catch { /* Incomplete saved metrics cannot establish an autofill reference. */ }
      if (complete) {
        this.autofilled = true;
        for (let index = reference.index; index < frames.length; index++) {
          if (rezkaFrameAt(snapshot.report, index) || this.requests.some(request => request.index === index) || Object.values(frames[index]).some(value => value.trim())) continue;
          frames[index] = { ...source, bobina: includeBobina ? '' : source.bobina, note: '' };
        }
      }
    }
    this.update({ snapshot, frames, includeBobina, syncRequired: false });
  }
  private async refresh() { this.guard(); const snapshot = await this.deps.read(); this.guard(); this.restore(snapshot); return snapshot; }
  private async freshControl() {
    this.guard(); const control = await this.deps.control(); this.guard();
    if (control.stage !== this.deps.context.stage || !control.allowed.includes(this.deps.context.action)) throw new Error('worker.error.sync');
    this.update({ fullReport: control.fullReport, totalWasteOnly: control.totalWasteOnly, freezeRequest: control.freezeRequest ?? '' }); return control;
  }
  async load() {
    if (!this.current() || this.state.processing || this.exclusive || this.state.phase === 'done' || this.finalAttempted) return;
    const generation = ++this.loadGeneration; this.update({ phase: 'loading', error: '' });
    try {
      await this.freshControl(); const snapshot = await this.deps.read(); this.guard();
      if (generation !== this.loadGeneration) return;
      if (!snapshot.kadr_counts.length || snapshot.report.frames.some(frame => frame.index > snapshot.kadr_counts.length)) throw new Error('worker.error.sync');
      this.restore(snapshot); this.update({ phase: 'edit' });
    } catch (error) { if (this.current() && generation === this.loadGeneration) this.update({ phase: 'error', error: failure(error, 'worker.error.sync'), syncRequired: true }); }
  }
  change(index: number, field: keyof RezkaFrameDraft, value: string) {
    if (!this.mutable(index)) return;
    const frames = this.state.frames.map(frame => ({ ...frame })); frames[index][field] = value;
    if (this.deps.context.autofill && this.autofilled && field === 'kg' && this.state.snapshot) {
      const report = this.state.snapshot.report, reference = report.frames.find(frame => frame.index === report.reference_frame_index) ??
        report.frames.find(frame => !rezkaFrameIssueNote(frame) && !rezkaFramePeremotkaReason(frame));
      if (reference) {
        const input = rezkaSavedInput(reference), weight = rezkaQty(value), meter = weight == null ? null : weight * input.produced_qty / input.gross_qty;
        frames[index].meter = meter != null && Number.isFinite(meter) && meter > 0 ? String(meter) : '';
      }
    }
    this.update({ frames, error: '' });
  }
  changeWaste(field: keyof RezkaOutputWaste, value: string) { if (this.current() && this.state.phase === 'edit' && !this.finalAttempted && !this.exclusive) this.update({ waste: { ...this.state.waste, [field]: value }, error: '' }); }
  changeNote(note: string) { if (this.current() && this.state.phase === 'edit' && !this.finalAttempted && !this.exclusive) this.update({ note, error: '' }); }
  private status(index: number, value: string) { this.update({ statuses: { ...this.state.statuses, [index]: value } }); }
  private requestInput(index: number, reason = '') { return rezkaFrameInput(this.state.frames[index], this.state.includeBobina, reason); }
  private assertMode(input: Obj) {
    if (Object.hasOwn(input, 'bobina_kg') === this.state.includeBobina) throw Object.assign(new Error('rezka_bobina_mode_changed'), {
      code: 'rezka_bobina_mode_changed', diagnostics: { include_bobina_in_net: this.state.includeBobina } });
  }
  enqueue(index: number, peremotka = '') {
    if (!this.current() || !this.state.frames[index] || this.state.phase !== 'edit' || this.finalAttempted || this.state.syncRequired || this.state.freezeRequest || this.exclusive || this.saved(index)?.input.issue_note) return;
    if (this.state.paused) {
      if (this.requests[0]?.index === index && !this.state.processing && !peremotka) { this.update({ paused: false }); void this.drain(); }
      return;
    }
    if (this.requests.some(request => request.index === index)) return;
    try {
      const reason = peremotka.trim();
      if (peremotka && (!reason || [...reason].length > 250)) throw new Error('worker.rezka.print.peremotka_reason_required');
      if (reason && (!this.state.snapshot?.report.peremotka_supported || this.saved(index))) throw new Error('worker.rezka.print.peremotka_unsupported');
      const input = this.saved(index) ? null : cloneInput(this.requestInput(index, reason));
      this.requests.push({ index, input }); this.update({ queued: this.requests.map(request => request.index), error: '' }); void this.drain();
    } catch (error) { if (this.current()) this.status(index, failure(error, 'worker.rezka.print.save_failed')); }
  }
  private async confirm(pending: Map<number, Obj>) {
    for (let attempt = 0; attempt < 3; attempt++) {
      this.guard(); const report = this.state.snapshot!.report;
      const deviations = rezkaOutputDeviations(report, pending).filter(value => !this.approvals.has(value.approval));
      if (!deviations.length) return true;
      for (const deviation of deviations) {
        this.update({ confirming: true });
        let approved: boolean;
        try { approved = await this.deps.confirm(deviation); this.guard(); }
        finally { if (this.current()) this.update({ confirming: this.exclusive }); }
        if (!approved) { this.update({ focus: { index: deviation.index, field: deviation.field, serial: (this.state.focus?.serial ?? 0) + 1 } }); return false; }
        this.approvals.add(deviation.approval);
      }
      await this.refresh();
    }
    throw new Error('worker.error.sync');
  }
  private restoreResult(result: Obj, index: number, input: Obj) {
    const report: AdminRezkaOutputReport | null = result.rezka_output_report, old = this.state.snapshot;
    if (!report || !old || report.cycle_id !== old.report.cycle_id || report.frames.some(frame => frame.index > old.kadr_counts.length)) throw new Error('worker.error.sync');
    const saved = rezkaFrameAt(report, index);
    if (!saved || !rezkaSavedMatches(saved, input)) throw new Error('worker.error.sync');
    const cursor = result.has_snapshot_cursor === true;
    if (cursor && (result.epoch !== old.epoch || !Number.isInteger(result.rev) || result.rev < old.revision)) throw new Error('worker.error.sync');
    const mode = result.progress_batch?.payload_json?.include_bobina_in_net;
    this.restore({ ...old, revision: cursor ? result.rev : old.revision, report: { ...report, atomic_save_epoch: report.atomic_save_epoch || old.report.atomic_save_epoch,
      peremotka_supported: report.peremotka_supported || old.report.peremotka_supported,
      include_bobina_in_net: typeof mode === 'boolean' ? mode : report.include_bobina_in_net ?? old.report.include_bobina_in_net } });
    this.deps.committed(false); return saved;
  }
  private async perform(request: Request) {
    const { index, input } = request;
    await this.refresh(); const control = await this.freshControl();
    if (control.freezeRequest) throw new Error('worker.error.sync');
    let saved = this.saved(index), result: Obj | null = null;
    if (saved && (rezkaFrameIssueNote(saved) || input && !rezkaSavedMatches(saved, input))) throw new Error('worker.error.sync');
    const peremotka = !!input?.peremotka_reason;
    if (peremotka && !this.state.snapshot!.report.peremotka_supported) throw new Error('worker.rezka.print.peremotka_unsupported');
    if (!saved && input && !peremotka && !await this.confirm(new Map([[index, input]]))) { this.status(index, ''); return; }
    if (!peremotka) { this.printer ??= await this.deps.selectPrinter(); this.guard(); }
    if (!saved) {
      if (!input) throw new Error('worker.error.sync');
      // The picker/confirmation can outlive a stage. Recheck immediately before writing.
      const latestControl = await this.freshControl(); await this.refresh(); saved = this.saved(index);
      if (latestControl.freezeRequest) throw new Error('worker.error.sync');
      if (saved && !rezkaSavedMatches(saved, input)) throw new Error('worker.error.sync');
      if (!saved && !peremotka && !await this.confirm(new Map([[index, input]]))) { this.status(index, ''); return; }
      if (!saved) this.assertMode(input);
      if (!saved) {
        const snapshot = this.state.snapshot!, atomic = snapshot.report.atomic_save_epoch;
        this.deps.attempted(); this.guard();
        result = await this.deps.save({ apparatus: this.deps.context.apparatus, order_id: this.deps.context.orderId, action: 'roll_complete', include_control: true, uom: 'm',
          rezka_record_frame_index: index + 1, rezka_output_cycle: snapshot.report.cycle_id, ...(atomic ? { rezka_expected_epoch: atomic, rezka_expected_kadr_counts: [...snapshot.kadr_counts] } : {}),
          rezka_frames: [{ ...input }], ...(this.printer ? this.deps.printerFields(this.printer) : {}) }, this.current);
        this.guard(); saved = this.restoreResult(result, index, input); this.status(index, 'worker.rezka.print.saved');
        if (atomic && !result.progress_batch) throw new Error('worker.rezka.print.saved_print_failed');
      }
    }
    this.printer ??= await this.deps.selectPrinter(); this.guard();
    const jobs = result?.print_jobs?.length ? result.print_jobs : result?.print_job ? [result.print_job] : [];
    if (!jobs.length || jobs.length !== 1 || !this.validJob(jobs[0], saved!.qr_payload)) {
      result = await this.deps.reprint(saved!, this.printer, this.deps.context.printCount); this.guard();
      if (!result.ok || !result.print_job || !this.validJob(result.print_job, saved!.qr_payload)) throw new Error('worker.rezka.print.saved_print_failed');
    }
    await this.deps.print(result!, this.printer); this.guard(); this.printed.add(index); this.status(index, 'worker.rezka.print.printed');
  }
  private async drain() {
    if (this.state.processing || this.state.paused || this.exclusive || !this.current()) return;
    this.update({ processing: true });
    try {
      while (this.requests.length && !this.state.paused && this.current()) {
        const request = this.requests[0]; this.status(request.index, 'worker.rezka.print.printing');
        try { await this.perform(request); this.guard(); this.requests.shift(); this.update({ queued: this.requests.map(value => value.index) }); }
        catch (error) {
          if (!this.current()) return;
          if (this.bobinaConflict(error)) break;
          try { await this.refresh(); } catch { if (this.current()) this.update({ syncRequired: true }); }
          if (!this.current()) return;
          const saved = this.saved(request.index), mismatch = saved && request.input && !rezkaSavedMatches(saved, request.input);
          if (mismatch) this.update({ syncRequired: true });
          this.printer = null;
          const paddon = ['active_paddon_required', 'paddon_locked'].includes((error as { code?: string })?.code ?? '');
          this.status(request.index, this.state.syncRequired ? 'worker.rezka.print.sync_failed' : paddon ? failure(error, 'worker.rezka.print.paddon_failed') : saved ? 'worker.rezka.print.saved_print_failed' : failure(error, 'worker.rezka.print.save_failed'));
          this.update({ paused: true }); break;
        }
      }
    } finally { if (this.current()) this.update({ processing: false }); }
    if (this.current() && this.deps.context.action === 'pause' && !this.state.paused && !this.state.syncRequired &&
        this.state.frames.every((_, index) => this.saved(index) && !rezkaFrameIssueNote(this.saved(index)!) && this.printed.has(index))) await this.submit();
  }
  private bobinaConflict(error: any) {
    const mode = error?.diagnostics?.include_bobina_in_net;
    if (error?.code !== 'rezka_bobina_mode_changed' || typeof mode !== 'boolean') return false;
    this.requests = []; this.printer = null;
    this.update({ queued: [], paused: false, statuses: {}, includeBobina: mode, error: mode ? 'worker.rezka.bobina_mode.total_weight' : 'worker.rezka.bobina_mode.tare_required' });
    return true;
  }
  async saveIssue(index: number, note: string) {
    if (!this.mutable(index) || this.state.processing || this.requests.length || this.state.freezeRequest || !note.trim()) return;
    this.exclusive = true; this.update({ processing: true, confirming: true, error: '' });
    try {
      await this.refresh(); const control = await this.freshControl(); if (control.freezeRequest) throw new Error('worker.error.sync'); if (this.saved(index)) return;
      const input = { issue_note: note.trim() }; this.deps.attempted(); this.guard();
      const result = await this.deps.save({ apparatus: this.deps.context.apparatus, order_id: this.deps.context.orderId, action: 'roll_complete', include_control: true,
        rezka_record_frame_index: index + 1, rezka_output_cycle: this.state.snapshot!.report.cycle_id, rezka_frames: [input], uom: 'm' }, this.current);
      this.guard(); this.restoreResult(result, index, input); this.status(index, 'worker.rezka.print.issue_saved');
    } catch (error) {
      if (!this.current()) return;
      try { await this.refresh(); } catch { if (this.current()) this.update({ syncRequired: true }); }
      if (this.current()) this.status(index, this.state.syncRequired ? 'worker.rezka.print.sync_failed' : this.saved(index) ? rezkaFrameIssueNote(this.saved(index)!) ? 'worker.rezka.print.issue_saved' : 'worker.rezka.print.saved' : failure(error, 'worker.rezka.print.issue_save_failed'));
    } finally { this.exclusive = false; if (this.current()) this.update({ processing: false, confirming: false }); }
  }
  private validJob(job: Obj, qr: string) {
    return job.epc === qr && !!qr && job.print_count === this.deps.context.printCount && ['progress', 'opening_wip'].includes(String(job.label_kind).trim().toLowerCase());
  }
  private async finishPrinting(reselect = false) {
    const pending = this.printOnly!;
    if (reselect) { pending.printer = await this.deps.selectPrinter(); this.guard(); }
    const batches: Obj[] = pending.result.progress_batches?.length ? pending.result.progress_batches : pending.result.progress_batch ? [pending.result.progress_batch] : [];
    const jobs: Obj[] = pending.result.print_jobs?.length ? pending.result.print_jobs : pending.result.print_job ? [pending.result.print_job] : [];
    if (!pending.prepared || reselect) {
      const valid = jobs.length === pending.expected && new Set(jobs.map(job => job.epc)).size === pending.expected &&
        jobs.every(job => this.validJob(job, job.epc)) && (!batches.length || batches.length === jobs.length && batches.every(batch => jobs.some(job => job.epc === batch.qr_payload)));
      if (!reselect && valid) pending.prepared = jobs;
      else {
        if (batches.length !== pending.expected || new Set(batches.map(batch => batch.batch_id)).size !== pending.expected ||
            batches.some(batch => !batch.batch_id || !batch.qr_payload)) throw new Error('worker.rezka.print.saved_print_failed');
        const prepared: Obj[] = [];
        for (const batch of batches) {
          const result = await this.deps.reprint(batch as { batch_id: string; qr_payload: string }, pending.printer, this.deps.context.printCount); this.guard();
          if (!result.ok || !result.print_job || !this.validJob(result.print_job, batch.qr_payload)) throw new Error('worker.rezka.print.saved_print_failed');
          prepared.push(result.print_job);
        }
        pending.prepared = prepared;
      }
    }
    while (pending.next < pending.prepared.length) {
      await this.deps.print({ print_job: pending.prepared[pending.next] }, pending.printer); this.guard(); pending.next++;
    }
    this.printOnly = null;
  }
  async submit() {
    if (!this.current() || this.exclusive || this.state.processing || this.state.phase === 'done') return;
    if (this.printOnly) {
      this.exclusive = true; this.update({ phase: 'saving', confirming: true, error: '' });
      try { await this.finishPrinting(true); this.guard(); this.update({ phase: 'done' }); }
      catch { if (this.current()) this.update({ phase: 'print_pending', error: 'worker.rezka.print.saved_print_failed' }); }
      finally { this.exclusive = false; if (this.current()) this.update({ confirming: false }); } return;
    }
    if (this.finalAttempted) return;
    this.exclusive = true; this.update({ confirming: true, error: '' });
    try {
      const control = await this.freshControl(); await this.refresh();
      if (this.requests.some(request => request.input?.peremotka_reason && rezkaFramePeremotkaReason(this.saved(request.index) ?? { input: {} } as any) !== request.input.peremotka_reason)) throw new Error('worker.rezka.print.peremotka_pending');
      this.requests = []; this.update({ queued: [], paused: false });
      const issueMode = ['roll_complete', 'complete'].includes(this.deps.context.action) && !control.freezeRequest;
      const incomplete = this.state.frames.flatMap((draft, index) => {
        if (this.saved(index)) return [];
        try { this.requestInput(index); return []; } catch { return [index]; }
      });
      if (issueMode && incomplete.some(index => !this.state.issuePrompted.includes(index))) {
        this.update({ issuePrompted: [...new Set([...this.state.issuePrompted, ...incomplete])] }); return;
      }
      const allEmpty = this.state.frames.every(frame => ![frame.meter, frame.kg, frame.bobina, frame.diameter].some(value => value.trim()));
      const anyOutput = !allEmpty || Object.values(this.state.waste).some(value => value.trim());
      if (control.freezeRequest && !anyOutput && !this.state.note.trim()) throw new Error('worker.freeze.safe_stop.output_or_issue_required');
      if (control.freezeRequest && !anyOutput && this.state.note.trim()) {
        this.finalAttempted = true; this.deps.attempted(); this.update({ phase: 'saving', canReload: false });
        const result = await this.deps.save({ apparatus: this.deps.context.apparatus, order_id: this.deps.context.orderId, action: this.deps.context.action,
          freeze_request_id: control.freezeRequest, completion_request_note: this.state.note.trim(), include_control: true }, this.current);
        this.guard(); this.deps.committed(true); this.update({ phase: 'done', completed: !result.completion_request,
          notice: result.completion_request ? 'worker.notice.completion_request_sent' : 'worker.freeze.safe_stop.issue_success' }); return;
      }
      const frames = this.state.frames.map((draft, index) => {
        const saved = this.saved(index); if (saved) return rezkaSavedInput(saved);
        if (issueMode && incomplete.includes(index)) {
          const note = draft.note.trim() || (allEmpty ? this.state.note.trim() : '');
          if (note) return { issue_note: note };
        }
        try { return this.requestInput(index); }
        catch (error) { if (error instanceof Error && error.message.endsWith('bobina_exceeds_gross')) throw error;
          throw new Error(control.freezeRequest ? 'worker.freeze.safe_stop.output_incomplete' : this.deps.context.action === 'roll_complete' ? 'worker.freeze.safe_stop.output_or_issue_required' : 'worker.progress.qty.completion_reason'); }
      });
      if (!await this.confirm(new Map(frames.map((frame, index) => [index, frame])))) return;
      // Restoring a correction during confirmation must not leave stale saved metrics in the final request.
      const finalFrames = frames.map((frame, index) => this.saved(index) ? rezkaSavedInput(this.saved(index)!) : frame);
      const recordedBeforePicker = new Set(this.state.snapshot!.report.frames.map(frame => frame.index));
      const bodyInput = { ...this.deps.context,
        waste: this.state.waste, note: this.state.note, fullReport: this.deps.context.action === 'complete' && control.fullReport,
        totalWasteOnly: control.totalWasteOnly, freezeRequest: control.freezeRequest };
      rezkaOutputBody({ ...bodyInput, report: this.state.snapshot!.report, frames: finalFrames });
      const needsPrinter = finalFrames.some((frame, index) => !frame.issue_note && !this.saved(index));
      const printer = needsPrinter ? this.printer ?? await this.deps.selectPrinter() : null; this.guard();
      const latestControl = await this.freshControl(); await this.refresh();
      if (latestControl.fullReport !== control.fullReport || latestControl.totalWasteOnly !== control.totalWasteOnly || latestControl.freezeRequest !== control.freezeRequest) throw new Error('worker.error.sync');
      // Another writer's new slot cannot be silently replaced by an old draft.
      const newSlotConflict = () => finalFrames.some((frame, index) => this.saved(index) && !recordedBeforePicker.has(index + 1) && !rezkaSavedMatches(this.saved(index)!, frame));
      if (newSlotConflict()) throw new Error('worker.error.sync');
      if (!await this.confirm(new Map(finalFrames.map((frame, index) => [index, frame])))) return;
      if (newSlotConflict()) throw new Error('worker.error.sync');
      const submittedFrames = finalFrames.map((frame, index) => this.saved(index) ? rezkaSavedInput(this.saved(index)!) : frame);
      submittedFrames.forEach((frame, index) => { if (!frame.issue_note && !this.saved(index)) this.assertMode(frame); });
      const body = rezkaOutputBody({ ...bodyInput, report: this.state.snapshot!.report, frames: submittedFrames });
      const unsaved = submittedFrames.filter((frame, index) => !frame.issue_note && !this.saved(index)).length;
      this.update({ phase: 'saving', canReload: false }); this.deps.attempted(); this.finalAttempted = true; this.guard();
      const result = await this.deps.save({ ...body, ...(printer ? this.deps.printerFields(printer) : {}) }, this.current); this.guard();
      this.deps.committed(true);
      this.update({ completed: !result.completion_request, notice: result.completion_request ? 'worker.notice.completion_request_sent'
        : control.freezeRequest ? 'worker.freeze.safe_stop.healthy_success' : 'worker.rezka.print.saved' });
      if (printer && unsaved && !result.completion_request) {
        this.printOnly = { result, printer, expected: unsaved, next: 0, prepared: null }; await this.finishPrinting(); this.guard();
      }
      this.update({ phase: 'done' });
    } catch (error) {
      if (this.current()) {
        const modeChanged = this.bobinaConflict(error);
        const rejection = !this.printOnly && [400, 401, 403, 404, 409, 422].includes((error as { statusCode?: number })?.statusCode ?? 0);
        if (modeChanged || rejection) { this.finalAttempted = false; this.update({ canReload: true }); }
        this.update({ phase: this.printOnly ? 'print_pending' : this.finalAttempted ? 'error' : 'edit',
          error: modeChanged ? this.state.error : failure(error, this.printOnly ? 'worker.rezka.print.saved_print_failed' : 'worker.error.sync'),
          syncRequired: this.finalAttempted && !this.printOnly });
      }
    } finally { this.exclusive = false; if (this.current()) this.update({ confirming: false }); }
  }
}

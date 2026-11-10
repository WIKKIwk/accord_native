import type { confirmPaddonPrint } from './paddonConfirmPrintApi';
import type { adminPaddonPrintQr } from './paddonPrintApi';
import type { WorkerPrintJob } from './workerPrintJob';
import type { WorkerPaddon } from './workerPaddonModel';

export type WorkerPaddonPrintCompletion = Awaited<ReturnType<typeof confirmPaddonPrint>>;
type Dependencies<Printer> = { code: string; apparatus: string; current(): boolean; select(): Promise<Printer | null>;
  prepare(printer: Printer, current: () => boolean): Promise<Awaited<ReturnType<typeof adminPaddonPrintQr>>>;
  print(job: WorkerPrintJob, printer: Printer, current: () => boolean): Promise<void>;
  confirm(current: () => boolean): Promise<WorkerPaddonPrintCompletion>; refresh(): Promise<void>; changed(): void;
  chooseNext(completion: WorkerPaddonPrintCompletion): Promise<string | null>;
  successor(apparatus: string, current: () => boolean): Promise<WorkerPaddon>; notice(key: string, values?: Record<string, unknown>, error?: unknown): void };

/** @v2 _PaddonPrintWorkflow._printPaddonQr */
export class WorkerPaddonPrint<Printer> {
  private busy = false;
  constructor(private deps: Dependencies<Printer>) {}
  async run() {
    if (this.busy || !this.deps.current()) return;
    this.busy = true; let printed = false, confirmed = false;
    const check = () => { if (!this.deps.current()) throw new Error('session_scope_changed'); };
    try {
      const printer = await this.deps.select(); check(); if (!printer) return;
      const result = await this.deps.prepare(printer, this.deps.current); check();
      if (!result.ok || result.paddon.code !== this.deps.code || !result.print_job || result.qr_payload !== this.deps.code ||
          result.print_job.epc !== this.deps.code || result.print_job.label_kind.trim().toLowerCase() !== 'paddon_code') throw new Error('paddon_qr_print');
      await this.deps.print(result.print_job, printer, this.deps.current); check(); printed = true;
      if (!result.can_close_after_print || result.paddon.locked_at_unix != null) { this.deps.notice('worker.paddon.printed', { qr: result.qr_payload }); return; }
      const completion = await this.deps.confirm(this.deps.current); check(); confirmed = true; this.deps.changed();
      await this.deps.refresh(); check();
      if (!completion.newly_locked) return;
      const apparatus = await this.deps.chooseNext(completion); check(); if (!apparatus) return;
      const next = await this.deps.successor(apparatus, this.deps.current); check(); this.deps.changed();
      this.deps.notice('worker.paddon.next.created', { code: next.code });
    } catch (error) { if (this.deps.current()) this.deps.notice(confirmed ? 'worker.paddon.create_failed'
      : printed ? 'worker.paddon.print_confirm_failed' : 'worker.paddon.print_failed', {}, error); }
    finally { this.busy = false; }
  }
}

import { hasExactRpsBatchContext, rpsBatchActionErrorMessage } from './gscaleControlLogic';
import type { GScaleBatchSession } from './gscaleBatchModel';

export type GScaleBatchState = { resolved: boolean; batch: GScaleBatchSession | null; loading: boolean; error: string; startConflict: boolean };
type Response = { ok: boolean; batch: GScaleBatchSession };
export type GScaleBatchStateApi = { state(): Promise<Response>; stop(batchId: string, revision: number): Promise<Response> };
async function timed<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), milliseconds); })]); }
  finally { if (timer) clearTimeout(timer); }
}

/** Batch authority and request generations from _refreshRsBatchState and _applyRsBatchSession. */
export class GScaleBatchStateStore {
  private state: GScaleBatchState = { resolved: false, batch: null, loading: false, error: '', startConflict: false };
  private listeners = new Set<() => void>();
  private requestId = 0;
  private generation = 0;
  private lastErrorKey = '';
  private alive = true;
  constructor(private readonly api: GScaleBatchStateApi,
    private readonly options: { prepareAutomaticStop?: (batch: GScaleBatchSession) => () => boolean } = {}) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(value: Partial<GScaleBatchState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }

  /** @v2 _refreshRsBatchState */
  async refresh(reportError = false): Promise<void> {
    const request = ++this.requestId, generation = this.generation;
    try {
      const result = await timed(this.api.state(), 4000);
      if (!this.alive || request !== this.requestId || generation !== this.generation) return;
      this.apply(result.batch);
      if (reportError && !this.state.startConflict && !result.batch.last_error.trim()) this.update({ error: '' });
    } catch (error) {
      if (reportError && this.alive && request === this.requestId && generation === this.generation) {
        this.update({ error: rpsBatchActionErrorMessage(error) });
      }
    }
  }

  /** @v2 _applyRsBatchSession */
  apply(batch: GScaleBatchSession): void {
    if (!this.alive) return;
    this.generation++;
    this.update({ resolved: true, batch, ...(!batch.active ? { startConflict: false } : {}) });
    const detail = batch.last_error.trim();
    const key = detail ? `${batch.id}|${batch.last_error_at}|${detail}` : '';
    if (key && key !== this.lastErrorKey) {
      this.lastErrorKey = key;
      const message = `ERPNext tasdiqlashda xatolik yuz berdi: ${detail}`;
      this.update({ error: message });
      if (batch.active && hasExactRpsBatchContext(batch)) {
        const guard = this.options.prepareAutomaticStop?.(batch);
        queueMicrotask(() => {
          const current = this.state.batch;
          if (this.alive && this.state.resolved && current?.active && hasExactRpsBatchContext(current) && (!guard || guard())) {
            void this.stopAfterLateError(current, message, guard);
          }
        });
      }
    }
  }

  /** @v2 _stopRsBatch */
  async stop(busy = false): Promise<void> {
    if (busy || this.state.loading) return;
    const batch = this.state.batch;
    if (!this.state.resolved || !batch?.active || !hasExactRpsBatchContext(batch)) {
      this.update({ error: 'Faol batch holati tasdiqlanmagan. Qayta yuklang.' }); return;
    }
    this.update({ loading: true, error: '' });
    try {
      const result = await timed(this.api.stop(batch.id, batch.revision), 30000);
      if (!this.alive) return;
      this.apply(result.batch);
      this.update({ loading: false });
    } catch (error) { this.update({ loading: false, error: rpsBatchActionErrorMessage(error) }); }
  }

  private async stopAfterLateError(batch: GScaleBatchSession, message: string, guard?: () => boolean): Promise<void> {
    if (guard && !guard()) return;
    this.update({ loading: true, error: message });
    if (guard && !guard()) { this.update({ loading: false }); return; }
    try {
      const result = await timed(this.api.stop(batch.id, batch.revision), 30000);
      if (!this.alive) return;
      this.apply(result.batch);
    } catch { /* The error remains visible when V2 cannot stop the batch. */ }
    this.update({ loading: false, error: message });
  }

  reset(): void {
    this.generation++;
    this.requestId++;
    this.lastErrorKey = '';
    this.update({ resolved: false, batch: null, loading: false, error: '', startConflict: false });
  }

  dispose(): void { this.alive = false; this.generation++; this.requestId++; this.listeners.clear(); }
}

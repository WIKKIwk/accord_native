type Batch = Record<string, any>;
type Row = { id: string; title: string; subtitle: string };
export type WorkerPeremotkaState = { phase: 'closed' | 'loading' | 'ready' | 'error'; batches: readonly Batch[] };

/** The two header actions share one presentation owner, including queued taps. */
export function openWorkerCutPanel(panel: 'paddon' | 'peremotka', paddon: { getSnapshot(): { busy: boolean }; open(): Promise<void> }, peremotka: { getSnapshot(): { phase: string }; open(): Promise<void> }) {
  if (paddon.getSnapshot().busy || peremotka.getSnapshot().phase !== 'closed') return;
  void (panel === 'paddon' ? paddon.open() : peremotka.open());
}

/** @v2 formatRawQuantity */
export function workerRawQuantity(value: number): string {
  return Object.is(value, -0) ? '-0' : Number.isInteger(value) ? value.toFixed(0) : String(value);
}
export function workerPeremotkaRows(batches: readonly Batch[], text: (key: string, values?: Record<string, unknown>) => string): Row[] {
  return batches.map(row => {
    const payload = row.payload_json, number = payload.order_number, frame = payload.rezka_frame_index, reason = payload.peremotka_reason;
    return { id: row.batch_id, title: row.label_item_name, subtitle: [typeof number === 'string' && number.length ? `#${number}` : row.order_id,
      ...(typeof frame === 'number' && Number.isInteger(frame) ? [text('worker.rezka.print.peremotka_roll', { index: frame })] : []),
      `${workerRawQuantity(row.produced_qty)} ${row.uom}`, ...(typeof reason === 'string' ? [reason] : [])].join(' · ') };
  });
}

/** @v2 _showRezkaPeremotkaQueue */
export class WorkerPeremotka {
  private state: WorkerPeremotkaState = { phase: 'closed', batches: [] };
  private readonly listeners = new Set<() => void>();
  private visible = false;
  private retired = false;
  private request: AbortController | null = null;
  constructor(private readonly deps: { current(): boolean; read(signal: AbortSignal, current: () => boolean): Promise<readonly Batch[]> }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(state: WorkerPeremotkaState) { this.state = state; for (const listener of this.listeners) listener(); }
  setVisible(visible: boolean) { this.visible = visible; if (!visible && this.state.phase !== 'closed') this.close(); }
  async open() {
    if (!this.visible || this.retired || !this.deps.current() || this.state.phase !== 'closed') return;
    const request = new AbortController(); this.request = request;
    const current = () => !request.signal.aborted && this.request === request && !this.retired && this.visible && this.deps.current();
    this.patch({ phase: 'loading', batches: [] });
    try { const batches = await this.deps.read(request.signal, current); if (current()) this.patch({ phase: 'ready', batches }); }
    catch { if (current()) this.patch({ phase: 'error', batches: [] }); }
  }
  close() { this.request?.abort(); this.request = null; this.patch({ ...this.state, phase: 'closed' }); }
  invalidate() { this.retired = true; this.close(); this.patch({ phase: 'closed', batches: [] }); }
}

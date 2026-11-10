import type { adminRezkaAstatkaSnapshot, RezkaAstatkaInput } from './rezkaAstatkaApi';

type Snapshot = Awaited<ReturnType<typeof adminRezkaAstatkaSnapshot>>;
type Context = { apparatus: string; orderId: string };
type Control = { stage: string; totalWasteOnly: boolean };
export type RezkaAstatkaValues = Record<'total' | 'print' | 'lamination' | 'edge' | 'note', string>;
const numeric = (value: string) => value.trim() ? Number(value.trim().replaceAll(',', '.')) : NaN;

/** @v2 _ReadOnlyOrderDetailSheetState._runRezkaAstatkaReport */
export function rezkaAstatkaInput(context: Context, snapshot: Snapshot, control: Control, values: RezkaAstatkaValues, requestId: string): RezkaAstatkaInput {
  if (!snapshot.session_id || !snapshot.stage_node_id || (control.stage && control.stage !== snapshot.stage_node_id)) throw new Error('worker.rezka_astatka.changed');
  const total = numeric(values.total), bosma = numeric(values.print), lamination = numeric(values.lamination), edge = numeric(values.edge);
  if (![total, ...(!control.totalWasteOnly ? [bosma, lamination, edge] : [])].every(value => Number.isFinite(value) && value >= 0)) throw new Error('worker.daily.invalid_number');
  return { apparatus: context.apparatus, order_id: context.orderId, session_id: snapshot.session_id, stage_node_id: snapshot.stage_node_id,
    request_id: requestId, total_waste_only: control.totalWasteOnly, total_waste: total,
    ...(!control.totalWasteOnly ? { rezka_bosma_waste: bosma, rezka_lamination_waste: lamination, rezka_edge_waste: edge } : {}), description: values.note.trim() };
}

type State = { phase: 'loading' | 'edit' | 'pending' | 'saving' | 'done' | 'error'; values: RezkaAstatkaValues; totalWasteOnly: boolean; error: string };
type Dependencies = { context: Context; key: string; current(): boolean; newRequestId(): string;
  read(requestId: string): Promise<Snapshot>; control(): Promise<Control>; save(request: RezkaAstatkaInput, current: () => boolean): Promise<unknown>;
  store: { get(key: string): Promise<Record<string, unknown> | null>; set(key: string, request: Record<string, unknown> | null, expectedId?: string): Promise<void> };
  attempted(): void; committed(): void };

/** @v2 _ReadOnlyOrderDetailSheetState._runRezkaAstatkaReport */
export class WorkerRezkaAstatkaWorkflow {
  private state: State = { phase: 'loading', values: { total: '', print: '', lamination: '', edge: '', note: '' }, totalWasteOnly: false, error: '' };
  private listeners = new Set<() => void>();
  private request: RezkaAstatkaInput | null = null;
  private snapshot: Snapshot | null = null;
  private control: Control | null = null;
  private generation = 0;
  private loading = false;
  private retired = false;
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  current = () => !this.retired && this.deps.current();
  private set(state: State) { this.state = state; for (const listener of this.listeners) listener(); }
  invalidate() { this.retired = true; this.generation++; this.request = null; this.snapshot = null; this.control = null; this.set({ ...this.state, phase: 'error', error: '' }); }
  change = (field: keyof RezkaAstatkaValues, value: string) => {
    if (this.current() && this.state.phase === 'edit') this.set({ ...this.state, values: { ...this.state.values, [field]: value }, error: '' });
  };
  load = async () => {
    if (!this.current() || this.loading || ['saving', 'done'].includes(this.state.phase)) return;
    this.loading = true; const generation = ++this.generation;
    this.set({ ...this.state, phase: 'loading', error: '' });
    try {
      const saved = await this.deps.store.get(this.deps.key);
      if (!this.current() || generation !== this.generation) return;
      if (saved && (saved.apparatus !== this.deps.context.apparatus || saved.order_id !== this.deps.context.orderId ||
          typeof saved.request_id !== 'string' || saved.request_id.length < 8 || saved.request_id.length > 128 ||
          typeof saved.session_id !== 'string' || !saved.session_id.trim() || typeof saved.stage_node_id !== 'string' || !saved.stage_node_id.trim())) throw new Error('worker.error.sync');
      const snapshot = await this.deps.read(String(saved?.request_id ?? ''));
      if (!this.current() || generation !== this.generation) return;
      this.request = saved as unknown as RezkaAstatkaInput | null; this.snapshot = snapshot;
      if (snapshot.request_result) {
        this.deps.committed(); this.set({ ...this.state, phase: 'done' });
        if (saved) await this.deps.store.set(this.deps.key, null, String(saved.request_id));
      } else if (saved) this.set({ ...this.state, phase: 'pending' });
      else {
        const control = await this.deps.control();
        if (!this.current() || generation !== this.generation) return;
        if (!snapshot.session_id || !snapshot.stage_node_id || (control.stage && control.stage !== snapshot.stage_node_id)) throw new Error('worker.rezka_astatka.changed');
        this.control = control; this.set({ ...this.state, phase: 'edit', totalWasteOnly: control.totalWasteOnly });
      }
    } catch (reason) {
      if (this.current() && generation === this.generation) this.set({ ...this.state, phase: this.state.phase === 'done' ? 'done' : 'error', error: this.error(reason) });
    } finally { this.loading = false; }
  };
  private error(reason: unknown) { return reason instanceof Error && reason.message.startsWith('worker.') ? reason.message : 'worker.rezka_astatka.unconfirmed'; }
  submit = async () => {
    const state = this.state;
    if (!this.current() || !this.snapshot || !['edit', 'pending'].includes(state.phase)) return;
    const generation = this.generation;
    let attempted = false, committed = false;
    try {
      if (!this.request && !this.control) return;
      const request = this.request ?? rezkaAstatkaInput(this.deps.context, this.snapshot, this.control!, state.values, this.deps.newRequestId());
      this.set({ ...state, phase: 'saving', error: '' });
      if (!this.request) {
        await this.deps.store.set(this.deps.key, request as unknown as Record<string, unknown>);
        if (!this.current() || generation !== this.generation) return;
        this.request = request;
      }
      this.deps.attempted(); attempted = true;
      await this.deps.save(request, this.current); committed = true;
      if (this.current() && generation === this.generation) { this.deps.committed(); this.set({ ...this.state, phase: 'done' }); }
      await this.deps.store.set(this.deps.key, null, request.request_id);
      if (this.current() && generation === this.generation) this.request = null;
    } catch (reason) {
      const error = reason as { statusCode?: number; code?: string } | null;
      // V2 only discards a request once receipt lookup proves it was never recorded.
      if (attempted && !committed && error?.statusCode === 409 && error.code === 'queue_action_not_allowed' && this.current()) {
        try { await this.deps.store.set(this.deps.key, null, this.request?.request_id); this.request = null; } catch { /* Keep exact pending data if removal failed. */ }
      }
      if (this.current() && generation === this.generation) this.set({ ...this.state, phase: committed ? 'done' : attempted ? 'error' : 'edit', error: this.error(reason) });
    }
  };
}

import type { Session } from './auth';
import { apparatusUsesLaminationWorkflow } from './apparatusApi';
import { canReturnScannedWip, type ScannedWip } from './scannedWipApi';

/** @v2 _ReadOnlyOrderDetailSheetState._scannedWipStage */
export function scannedWipStage(control: Record<string, any>, map: Record<string, any>, apparatus: string): string {
  const confirmed = String(control.stage_node_id ?? '').trim();
  if (confirmed) return confirmed;
  const nodes = Array.isArray(map.nodes) ? map.nodes.filter((node: any) => node.apparatus_id === apparatus) : [];
  return nodes.length === 1 ? String(nodes[0].id ?? '').trim() : '';
}

/** @v2 _ReadOnlyOrderDetailSheetState._canReadScannedWips */
export function canReadScannedWips(session: Session, apparatus: string, operation: string, stage: string, detailPending: boolean) {
  return !detailPending && (apparatusUsesLaminationWorkflow(operation) || operation === 'cut') &&
    ['aparatchi', 'rezka_master'].includes(String(session.profile.role)) && session.capabilities.includes('apparatus.queue.read') &&
    session.assigned_apparatus.includes(apparatus) && !!stage;
}

export type ScannedWipState = { phase: 'loading' | 'ready' | 'error' | 'invalid'; items: ScannedWip[];
  writing: boolean; confirmation: ScannedWip | null; notice: string };

/** @v2 _ScannedWipHistorySheetState */
export class WorkerScannedWipsController {
  private state: ScannedWipState = { phase: 'loading', items: [], writing: false, confirmation: null, notice: '' };
  private listeners = new Set<() => void>();
  private generation = 0;
  private active = false;
  private mutationListener = () => {};
  constructor(private readonly deps: { current(): boolean; canManage(): boolean; read(): Promise<ScannedWip[]>;
    returnWip(item: ScannedWip): Promise<void> }) {}
  setMutationListener(listener: () => void) { this.mutationListener = listener; }
  getSnapshot = () => this.state;
  isCurrent = () => this.deps.current();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ScannedWipState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  activate() { this.active = true; void this.load(); }
  deactivate() { this.active = false; this.generation++; }
  invalidate() { this.generation++; this.update({ phase: 'invalid', items: [], confirmation: null, writing: false }); }
  canReturn = (item: ScannedWip) => this.active && this.deps.current() && this.state.phase === 'ready' &&
    !this.state.writing && this.deps.canManage() && this.state.items.includes(item) && canReturnScannedWip(item);
  private async timed<T>(action: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([action, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('WIP request timed out')), 20_000); })]); }
    finally { clearTimeout(timer); }
  }
  load = async () => {
    if (!this.active || this.state.writing) return;
    if (!this.deps.current()) { this.invalidate(); return; }
    const generation = ++this.generation;
    this.update({ phase: 'loading', items: [], confirmation: null });
    try {
      const items = await this.timed(this.deps.read());
      if (this.active && generation === this.generation && this.deps.current()) this.update({ phase: 'ready', items });
    } catch {
      if (this.active && generation === this.generation && this.deps.current()) this.update({ phase: 'error', items: [] });
    }
    if (this.active && !this.deps.current()) this.invalidate();
  };
  requestReturn = (item: ScannedWip) => { if (this.canReturn(item)) this.update({ confirmation: item }); };
  cancelReturn = () => { if (!this.state.writing) this.update({ confirmation: null }); };
  confirmReturn = async (item = this.state.confirmation) => {
    if (!item || !this.canReturn(item)) { this.cancelReturn(); return; }
    this.generation++;
    this.update({ writing: true, confirmation: null, notice: '' });
    let success = false;
    try { await this.timed(this.deps.returnWip(item)); success = true; }
    catch { /* A lost response can follow a committed return. Reconcile, never retry. */ }
    finally {
      if (this.deps.current()) this.mutationListener();
      if (this.active && this.deps.current()) {
        this.update({ writing: false, notice: `worker.scanned_wip.${success ? 'success' : 'failed'}` });
        await this.load();
      } else if (this.active) this.invalidate();
    }
  };
}

export function scannedWipLabels(item: ScannedWip) {
  return { state: `worker.scanned_wip.${item.state !== 'returned' && item.consume_state === 'unknown' ? 'unknown' : item.state}`,
    reason: `worker.scanned_wip.${item.blocked_reason === 'work_recorded' || item.blocked_reason === 'other_worker' ? item.blocked_reason : 'unavailable'}` };
}
